"""Validation tests for module-generation data contracts."""

import pytest
from pydantic import ValidationError

from app.schemas.generation import (
    GenerationDepth,
    ModuleGenerationRequest,
    ModulePlan,
)


def create_lesson(lesson_number: int) -> dict[str, object]:
    """Create a valid lesson payload for module-plan boundary tests."""

    return {
        "title": f"Lesson {lesson_number}",
        "description": "A practical introduction to the lesson topic.",
        "learning_objectives": ["Explain the core concept"],
        "presentation_title": f"Lesson {lesson_number} presentation",
    }


def test_generation_request_applies_safe_defaults() -> None:
    """Optional controls should use the agreed first-version behavior."""

    generation_request = ModuleGenerationRequest(
        prompt="Create onboarding training for new sales employees.",
        output_language="English",
    )

    assert generation_request.depth is GenerationDepth.STANDARD
    assert generation_request.use_web_search is False
    assert generation_request.reference_file_ids == []
    assert generation_request.use_reference_visuals is True


def test_generation_request_rejects_short_prompt() -> None:
    """A vague prompt should fail before consuming model credits."""

    with pytest.raises(ValidationError):
        ModuleGenerationRequest(prompt="Sales course", output_language="English")


def test_generation_request_rejects_duplicate_reference_files() -> None:
    """The same document should never be processed twice in one job."""

    with pytest.raises(ValidationError, match="must be unique"):
        ModuleGenerationRequest(
            prompt="Create onboarding training for new sales employees.",
            output_language="English",
            reference_file_ids=["file-1", "file-1"],
        )


def test_generation_request_rejects_unknown_fields() -> None:
    """Typos and unsupported client fields must not be silently ignored."""

    with pytest.raises(ValidationError):
        ModuleGenerationRequest(
            prompt="Create onboarding training for new sales employees.",
            output_language="English",
            publish_immediately=True,
        )


def test_module_plan_rejects_more_than_twelve_lessons() -> None:
    """Model output must respect the lesson-count hard limit."""

    with pytest.raises(ValidationError):
        ModulePlan(
            title="Sales onboarding",
            description="A complete onboarding module for new sales employees.",
            output_language="English",
            lessons=[create_lesson(number) for number in range(1, 14)],
        )
