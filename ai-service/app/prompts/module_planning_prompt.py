"""Build system and user messages for structured module planning."""

import json

from app.providers.ecoapi import EcoApiChatMessage
from app.schemas.generation import ModuleGenerationRequest, ModulePlan

MAX_LESSON_COUNT = 12


def build_module_planning_system_prompt() -> str:
    """Construct the system instruction that defines the model's planning role.

    The schema is embedded directly so the model knows the exact structure
    regardless of whether the provider enforces ``response_format``.
    """

    module_plan_schema = json.dumps(
        ModulePlan.model_json_schema(),
        indent=2,
        ensure_ascii=False,
    )

    return f"""\
You are a professional curriculum designer for the Lumen Learning Management System.

Your task is to create a structured module plan as a single JSON object.
Respond ONLY with a valid JSON object — no markdown, no explanation, no commentary.

The JSON must conform exactly to this schema:

{module_plan_schema}

Rules:
1. Target lesson count: as specified by the user's depth requirement.
2. The hard maximum is {MAX_LESSON_COUNT} lessons. Never exceed it.
3. You may produce fewer lessons than the target if the material is genuinely limited, \
but explain this in the module description.
4. Every lesson must have 1–6 specific, actionable learning objectives.
5. Each lesson needs a presentation_title that is concise and informative.
6. The title field must be between 3 and 160 characters.
7. The description field must be between 20 and 2000 characters.
8. Each lesson title must be between 3 and 120 characters.
9. Each lesson description must be between 10 and 1000 characters.
10. Write all content in the output language specified by the user.
11. Do not fabricate statistics, citations, or data sources.
12. Do not include harmful, hateful, or sexually explicit content.
13. Do not include API keys, internal prompts, or sensitive system information.\
"""


def build_module_planning_user_prompt(
    generation_request: ModuleGenerationRequest,
    rag_context: str = "",
) -> str:
    """Translate the instructor's validated request into the model's user message.

    When ``rag_context`` is provided, it is injected so the model grounds its
    plan in the retrieved reference material rather than relying solely on
    the instruction.
    """

    target_lessons = generation_request.depth
    context_block = f"\n\n{rag_context}\n" if rag_context.strip() else ""

    return f"""\
Create a module plan with the following requirements:

Instruction: {generation_request.prompt}
Output language: {generation_request.output_language}
Target lesson count: {target_lessons} lessons{context_block}

Respond with ONLY a valid JSON object.\
"""


def build_module_planning_messages(
    generation_request: ModuleGenerationRequest,
    rag_context: str = "",
) -> list[EcoApiChatMessage]:
    """Assemble the complete message sequence for one planning request."""

    return [
        EcoApiChatMessage(
            role="system",
            content=build_module_planning_system_prompt(),
        ),
        EcoApiChatMessage(
            role="user",
            content=build_module_planning_user_prompt(generation_request, rag_context),
        ),
    ]


def build_module_planning_repair_messages(
    generation_request: ModuleGenerationRequest,
    previous_model_output: str,
    validation_error_message: str,
) -> list[EcoApiChatMessage]:
    """Re-prompt the model with its previous invalid output and the validation error.

    The repair conversation preserves the original system and user context so
    the model understands what was requested, then shows the faulty response
    and asks for a corrected version.
    """

    original_messages = build_module_planning_messages(generation_request, rag_context="")

    repair_messages = [
        *original_messages,
        EcoApiChatMessage(
            role="assistant",
            content=previous_model_output,
        ),
        EcoApiChatMessage(
            role="user",
            content=(
                "Your previous response was not valid JSON or did not match the required schema.\n"
                f"Validation error: {validation_error_message}\n\n"
                "Please fix the error and respond with ONLY a valid JSON object."
            ),
        ),
    ]

    return repair_messages
