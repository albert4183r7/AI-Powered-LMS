"""Deterministic tests for the real module generator using fake HTTP transport."""

import json

import httpx
import pytest

from app.providers.ecoapi import EcoApiClient, EcoApiTransientError
from app.schemas.generation import GenerationDepth, ModuleGenerationRequest, ModulePlan
from app.services.ecoapi_module_generator import EcoApiModuleGenerator, ModulePlanningError

TEST_API_KEY = "ek-test-secret-never-send"
TEST_BASE_URL = "https://provider.test/v1"
TEST_MODEL = "gpt-5.6-sol"


def build_valid_generation_request(
    depth: GenerationDepth = GenerationDepth.STANDARD,
) -> ModuleGenerationRequest:
    """Create a minimal valid request matching the schema contract."""

    return ModuleGenerationRequest(
        prompt="Create practical presales onboarding for new solution consultants.",
        output_language="English",
        depth=depth,
    )


def build_valid_module_plan_json(lesson_count: int = 5) -> str:
    """Return JSON that passes ModulePlan validation."""

    lessons = [
        {
            "title": f"Lesson {i}: Core concept",
            "description": f"A structured lesson on core concept {i} with practical applications.",
            "learning_objectives": [
                f"Explain core concept {i}",
                f"Apply core concept {i} in a practical scenario",
            ],
            "presentation_title": f"Presales Onboarding - Lesson {i}",
        }
        for i in range(1, lesson_count + 1)
    ]
    module_plan = {
        "title": "Presales Onboarding for Solution Consultants",
        "description": "A comprehensive onboarding module for new solution consultants.",
        "output_language": "English",
        "lessons": lessons,
    }
    return json.dumps(module_plan)


def build_provider_response(content: str) -> dict[str, object]:
    """Wrap model content in the observed EcoAPI chat completion envelope."""

    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": TEST_MODEL,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 200,
            "total_tokens": 300,
        },
    }


def build_ecoapi_module_generator(
    handler: httpx.MockTransport,
    *,
    max_repair_attempts: int = 2,
) -> EcoApiModuleGenerator:
    """Create a generator whose requests stay inside the test process."""

    ecoapi_client = EcoApiClient(
        base_url=TEST_BASE_URL,
        api_key=TEST_API_KEY,
        model=TEST_MODEL,
        timeout_seconds=5,
        http_client=httpx.Client(transport=handler),
    )
    return EcoApiModuleGenerator(
        ecoapi_client=ecoapi_client,
        max_repair_attempts=max_repair_attempts,
    )


def test_valid_json_response_returns_module_plan() -> None:
    """A well-formed JSON response should produce a validated ModulePlan."""

    valid_json = build_valid_module_plan_json()

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    generation_request = build_valid_generation_request()

    module_plan = generator.generate(generation_request)

    assert isinstance(module_plan, ModulePlan)
    assert len(module_plan.lessons) == 5
    assert module_plan.output_language == "English"
    assert module_plan.title == "Presales Onboarding for Solution Consultants"


def test_json_in_markdown_fences_is_extracted() -> None:
    """Models sometimes wrap JSON in code fences despite being told not to."""

    valid_json = build_valid_module_plan_json()
    fenced_content = f"```json\n{valid_json}\n```"

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=build_provider_response(fenced_content))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    module_plan = generator.generate(build_valid_generation_request())

    assert isinstance(module_plan, ModulePlan)
    assert len(module_plan.lessons) == 5


def test_json_in_plain_fences_is_extracted() -> None:
    """Code fences without a language specifier should also be handled."""

    valid_json = build_valid_module_plan_json()
    fenced_content = f"```\n{valid_json}\n```"

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=build_provider_response(fenced_content))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    module_plan = generator.generate(build_valid_generation_request())

    assert isinstance(module_plan, ModulePlan)


def test_repair_succeeds_after_invalid_first_response() -> None:
    """The generator should repair invalid output by re-prompting with errors."""

    call_count = 0
    valid_json = build_valid_module_plan_json()

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            # First response is invalid JSON.
            return httpx.Response(
                200,
                json=build_provider_response('{"invalid": "not a module plan"}'),
            )
        # Repair response is valid.
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    module_plan = generator.generate(build_valid_generation_request())

    assert isinstance(module_plan, ModulePlan)
    assert call_count == 2


def test_repair_sends_validation_error_to_model() -> None:
    """The repair message should include the validation error for the model."""

    call_count = 0
    valid_json = build_valid_module_plan_json()
    repair_request_content: str | None = None

    def handle_request(request: httpx.Request) -> httpx.Response:
        nonlocal call_count, repair_request_content
        call_count += 1
        request_payload = json.loads(request.content)
        if call_count == 1:
            return httpx.Response(
                200,
                json=build_provider_response('{"broken": true}'),
            )
        # Capture the repair request messages.
        repair_request_content = json.dumps(request_payload.get("messages", []))
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    generator.generate(build_valid_generation_request())

    assert repair_request_content is not None
    assert "fix the error" in repair_request_content.lower()
    assert "validation" in repair_request_content.lower()


def test_persistent_invalid_output_raises_planning_error() -> None:
    """All repair attempts exhausted should raise ModulePlanningError."""

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=build_provider_response("This is not JSON at all."),
        )

    generator = build_ecoapi_module_generator(
        httpx.MockTransport(handle_request),
        max_repair_attempts=2,
    )

    with pytest.raises(ModulePlanningError, match="3 attempts"):
        generator.generate(build_valid_generation_request())


def test_zero_repair_attempts_fails_immediately_on_invalid_output() -> None:
    """With no repair budget, a single invalid response must raise immediately."""

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=build_provider_response("not json"),
        )

    generator = build_ecoapi_module_generator(
        httpx.MockTransport(handle_request),
        max_repair_attempts=0,
    )

    with pytest.raises(ModulePlanningError, match="1 attempts"):
        generator.generate(build_valid_generation_request())


def test_provider_transient_error_propagates() -> None:
    """Provider failures should not be swallowed by the repair logic."""

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": {"code": "server_error"}})

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))

    with pytest.raises(EcoApiTransientError):
        generator.generate(build_valid_generation_request())


def test_short_depth_produces_three_lesson_plan() -> None:
    """The prompt should communicate the correct target for short depth."""

    valid_json = build_valid_module_plan_json(lesson_count=3)
    captured_messages: list[dict[str, str]] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        request_payload = json.loads(request.content)
        captured_messages.extend(request_payload.get("messages", []))
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    module_plan = generator.generate(
        build_valid_generation_request(depth=GenerationDepth.SHORT),
    )

    assert len(module_plan.lessons) == 3
    user_message = next(m for m in captured_messages if m["role"] == "user")
    assert "target 3 lessons" in user_message["content"]


def test_comprehensive_depth_target_is_communicated() -> None:
    """The comprehensive depth should request 8 lessons in the user prompt."""

    valid_json = build_valid_module_plan_json(lesson_count=8)
    captured_messages: list[dict[str, str]] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        request_payload = json.loads(request.content)
        captured_messages.extend(request_payload.get("messages", []))
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    generator.generate(
        build_valid_generation_request(depth=GenerationDepth.COMPREHENSIVE),
    )

    user_message = next(m for m in captured_messages if m["role"] == "user")
    assert "target 8 lessons" in user_message["content"]


def test_output_language_appears_in_prompt() -> None:
    """The output language must reach the model so it writes in the right language."""

    valid_json = build_valid_module_plan_json()
    captured_messages: list[dict[str, str]] = []

    def handle_request(request: httpx.Request) -> httpx.Response:
        request_payload = json.loads(request.content)
        captured_messages.extend(request_payload.get("messages", []))
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    generator.generate(build_valid_generation_request())

    user_message = next(m for m in captured_messages if m["role"] == "user")
    assert "English" in user_message["content"]


def test_empty_content_triggers_repair() -> None:
    """An empty model response should attempt repair instead of crashing."""

    call_count = 0
    valid_json = build_valid_module_plan_json()

    def handle_request(_request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(200, json=build_provider_response(""))
        return httpx.Response(200, json=build_provider_response(valid_json))

    generator = build_ecoapi_module_generator(httpx.MockTransport(handle_request))
    module_plan = generator.generate(build_valid_generation_request())

    assert isinstance(module_plan, ModulePlan)
    assert call_count == 2


def test_negative_max_repair_attempts_is_rejected() -> None:
    """The constructor should reject nonsensical negative repair limits."""

    ecoapi_client = EcoApiClient(
        base_url=TEST_BASE_URL,
        api_key=TEST_API_KEY,
        model=TEST_MODEL,
        timeout_seconds=5,
        http_client=httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200))),
    )

    with pytest.raises(ValueError, match="non-negative"):
        EcoApiModuleGenerator(ecoapi_client=ecoapi_client, max_repair_attempts=-1)
