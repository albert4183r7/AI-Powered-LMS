"""Contract tests for the EcoAPI adapter using an in-memory HTTP transport."""

import json

import httpx
import pytest

from app.providers.ecoapi import (
    EcoApiAccessError,
    EcoApiAuthenticationError,
    EcoApiChatMessage,
    EcoApiClient,
    EcoApiRateLimitError,
    EcoApiRequestError,
    EcoApiResponseError,
    EcoApiTransientError,
)

TEST_API_KEY = "ek-test-secret-never-send"
TEST_BASE_URL = "https://provider.test/v1"
TEST_MODEL = "gpt-5.6-sol"


def build_ecoapi_client(handler: httpx.MockTransport) -> EcoApiClient:
    """Create an adapter whose requests never leave the test process."""

    return EcoApiClient(
        base_url=TEST_BASE_URL,
        api_key=TEST_API_KEY,
        model=TEST_MODEL,
        timeout_seconds=5,
        http_client=httpx.Client(transport=handler),
    )


def test_chat_completion_maps_request_and_usage() -> None:
    """The adapter should send the observed contract and validate its response."""

    def handle_request(request: httpx.Request) -> httpx.Response:
        assert request.url == f"{TEST_BASE_URL}/chat/completions"
        assert request.headers["authorization"] == f"Bearer {TEST_API_KEY}"
        request_payload = json.loads(request.content)
        assert request_payload == {
            "model": TEST_MODEL,
            "messages": [{"role": "user", "content": "Reply with OK."}],
            "stream": False,
            "max_tokens": 8,
        }
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "model": TEST_MODEL,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": "OK"},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 5,
                    "completion_tokens": 1,
                    "total_tokens": 6,
                },
            },
        )

    completion = build_ecoapi_client(
        httpx.MockTransport(handle_request),
    ).create_chat_completion(
        [EcoApiChatMessage(role="user", content="Reply with OK.")],
        max_tokens=8,
    )

    assert completion.content == "OK"
    assert completion.finish_reason == "stop"
    assert completion.usage is not None
    assert completion.usage.total_tokens == 6
    assert completion.tool_calls == ()


def test_chat_completion_maps_tool_call() -> None:
    """Observed EcoAPI tool calls should become provider-neutral values."""

    tool_definition: dict[str, object] = {
        "type": "function",
        "function": {
            "name": "get_probe_value",
            "description": "Return a fixed value.",
            "parameters": {"type": "object", "properties": {}},
        },
    }

    def handle_request(request: httpx.Request) -> httpx.Response:
        request_payload = json.loads(request.content)
        assert request_payload["tools"] == [tool_definition]
        assert request_payload["tool_choice"] == "required"
        return httpx.Response(
            200,
            json={
                "id": "chatcmpl-tool-test",
                "object": "chat.completion",
                "model": TEST_MODEL,
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [
                                {
                                    "id": "call-test",
                                    "type": "function",
                                    "function": {
                                        "name": "get_probe_value",
                                        "arguments": "{}",
                                    },
                                }
                            ],
                        },
                        "finish_reason": "tool_calls",
                    }
                ],
            },
        )

    completion = build_ecoapi_client(
        httpx.MockTransport(handle_request),
    ).create_chat_completion(
        [EcoApiChatMessage(role="user", content="Call the tool.")],
        tools=[tool_definition],
        tool_choice="required",
    )

    assert completion.finish_reason == "tool_calls"
    assert completion.content is None
    assert completion.tool_calls[0].name == "get_probe_value"
    assert completion.tool_calls[0].arguments_json == "{}"


@pytest.mark.parametrize(
    ("status_code", "expected_error_type", "expected_retryable"),
    [
        (400, EcoApiRequestError, False),
        (401, EcoApiAuthenticationError, False),
        (403, EcoApiAccessError, False),
        (429, EcoApiRateLimitError, True),
        (500, EcoApiTransientError, True),
    ],
)
def test_provider_http_errors_are_normalized(
    status_code: int,
    expected_error_type: type[Exception],
    expected_retryable: bool,
) -> None:
    """Callers should not depend on EcoAPI's raw status or error message."""

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            status_code,
            json={
                "error": {
                    "code": "provider_code",
                    "message": "Provider detail that must not become the exception message.",
                    "type": "new_api_error",
                }
            },
        )

    with pytest.raises(expected_error_type) as raised_error:
        build_ecoapi_client(
            httpx.MockTransport(handle_request),
        ).create_chat_completion(
            [EcoApiChatMessage(role="user", content="Probe")],
        )

    normalized_error = raised_error.value
    assert isinstance(normalized_error, expected_error_type)
    assert normalized_error.retryable is expected_retryable
    assert "Provider detail" not in str(normalized_error)


def test_timeout_is_retryable_and_does_not_expose_request() -> None:
    """Timeouts should be safe to retry without leaking message content."""

    def handle_request(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("private prompt", request=request)

    with pytest.raises(EcoApiTransientError) as raised_error:
        build_ecoapi_client(
            httpx.MockTransport(handle_request),
        ).create_chat_completion(
            [EcoApiChatMessage(role="user", content="Sensitive instructor prompt")],
        )

    assert raised_error.value.retryable is True
    assert "Sensitive" not in str(raised_error.value)
    assert "private prompt" not in str(raised_error.value)


def test_invalid_success_response_is_rejected() -> None:
    """A 200 response is not success until its contract validates."""

    def handle_request(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"choices": []})

    with pytest.raises(EcoApiResponseError):
        build_ecoapi_client(
            httpx.MockTransport(handle_request),
        ).create_chat_completion(
            [EcoApiChatMessage(role="user", content="Probe")],
        )


def test_base_url_must_use_provider_v1_contract() -> None:
    """The old /api base URL would produce 405 after client path joining."""

    with pytest.raises(ValueError, match="must end with /v1"):
        EcoApiClient(
            base_url="https://www.ecoapi.ai/api",
            api_key=TEST_API_KEY,
            model=TEST_MODEL,
            timeout_seconds=5,
        )
