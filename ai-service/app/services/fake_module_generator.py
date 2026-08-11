"""Deterministic module generator used before the model provider is connected."""

import time

from app.schemas.generation import (
    GenerationDepth,
    LessonPlan,
    ModuleGenerationRequest,
    ModulePlan,
)

LESSON_COUNT_BY_DEPTH: dict[GenerationDepth, int] = {
    GenerationDepth.SHORT: 3,
    GenerationDepth.STANDARD: 5,
    GenerationDepth.COMPREHENSIVE: 8,
}


class FakeModuleGenerator:
    """Create valid placeholder plans without network calls or model credits."""

    def __init__(self, step_delay_seconds: float = 0) -> None:
        self.step_delay_seconds = step_delay_seconds

    def generate(self, generation_request: ModuleGenerationRequest) -> ModulePlan:
        """Return deterministic content matching the real model's future contract."""

        if self.step_delay_seconds:
            time.sleep(self.step_delay_seconds)

        normalized_prompt = " ".join(generation_request.prompt.split())
        module_title = normalized_prompt.rstrip(". ")[:160]
        lesson_count = LESSON_COUNT_BY_DEPTH[generation_request.depth]

        lesson_plans = [
            LessonPlan(
                title=f"Lesson {lesson_number}: Core concept",
                description=(
                    f"A structured lesson for {normalized_prompt}, focused on practical "
                    f"concept {lesson_number} of {lesson_count}."
                )[:1_000],
                learning_objectives=[
                    f"Explain core concept {lesson_number}",
                    f"Apply core concept {lesson_number} in a practical scenario",
                ],
                presentation_title=f"{module_title} - Lesson {lesson_number}",
            )
            for lesson_number in range(1, lesson_count + 1)
        ]

        return ModulePlan(
            title=module_title,
            description=(
                f"Temporary validated module plan for the instruction: {normalized_prompt}"
            )[:2_000],
            output_language=generation_request.output_language,
            lessons=lesson_plans,
        )
