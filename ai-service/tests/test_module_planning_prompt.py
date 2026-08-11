"""Unit tests for module planning prompt construction."""

from app.prompts.module_planning_prompt import (
    LESSON_TARGET_BY_DEPTH,
    build_module_planning_messages,
    build_module_planning_repair_messages,
    build_module_planning_system_prompt,
    build_module_planning_user_prompt,
)
from app.schemas.generation import GenerationDepth, ModuleGenerationRequest


def build_sample_generation_request(
    depth: GenerationDepth = GenerationDepth.STANDARD,
) -> ModuleGenerationRequest:
    """Create a minimal valid request for prompt construction tests."""

    return ModuleGenerationRequest(
        prompt="Create a practical presales onboarding course for solution consultants.",
        output_language="English",
        depth=depth,
    )


def test_system_prompt_contains_module_plan_json_schema() -> None:
    """The model needs the schema to produce structurally valid output."""

    system_prompt = build_module_planning_system_prompt()
    assert '"ModulePlan"' in system_prompt or '"title"' in system_prompt
    assert '"LessonPlan"' in system_prompt or '"learning_objectives"' in system_prompt


def test_system_prompt_contains_lesson_targets_for_each_depth() -> None:
    """The model should know how many lessons to produce for each depth level."""

    system_prompt = build_module_planning_system_prompt()
    for depth, target in LESSON_TARGET_BY_DEPTH.items():
        assert f"{depth.value}: {target} lessons" in system_prompt


def test_system_prompt_states_maximum_lesson_count() -> None:
    """The hard cap of 12 lessons prevents oversized module plans."""

    system_prompt = build_module_planning_system_prompt()
    assert "12" in system_prompt


def test_user_prompt_includes_instructor_prompt_and_language() -> None:
    """The model must receive the instructor's instruction and output language."""

    generation_request = build_sample_generation_request()
    user_prompt = build_module_planning_user_prompt(generation_request)

    assert "presales onboarding" in user_prompt
    assert "English" in user_prompt
    assert "standard" in user_prompt


def test_user_prompt_includes_correct_depth_target() -> None:
    """The user message should tell the model the target lesson count."""

    for depth, target in LESSON_TARGET_BY_DEPTH.items():
        generation_request = build_sample_generation_request(depth=depth)
        user_prompt = build_module_planning_user_prompt(generation_request)
        assert f"target {target} lessons" in user_prompt


def test_message_sequence_has_system_and_user_roles() -> None:
    """The message list must start with system and end with user."""

    generation_request = build_sample_generation_request()
    messages = build_module_planning_messages(generation_request)

    assert len(messages) == 2
    assert messages[0].role == "system"
    assert messages[1].role == "user"


def test_repair_messages_include_original_context_and_error() -> None:
    """Repair prompts must carry the original request and the validation error."""

    generation_request = build_sample_generation_request()
    repair_messages = build_module_planning_repair_messages(
        generation_request,
        previous_model_output='{"invalid": true}',
        validation_error_message="Schema validation errors:\n  - ('title',): Field required",
    )

    assert len(repair_messages) == 4
    assert repair_messages[0].role == "system"
    assert repair_messages[1].role == "user"
    assert repair_messages[2].role == "assistant"
    assert repair_messages[2].content == '{"invalid": true}'
    assert repair_messages[3].role == "user"
    assert "Field required" in repair_messages[3].content
    assert "fix the error" in repair_messages[3].content.lower()
