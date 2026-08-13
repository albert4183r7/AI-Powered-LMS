"""Module generator that calls Google Gemini API and validates structured JSON output."""

import json
import logging
import re

from pydantic import ValidationError

from app.prompts.module_planning_prompt import (
    build_module_planning_messages,
    build_module_planning_repair_messages,
)
from app.providers.gemini import GeminiClient
from app.schemas.generation import ModuleGenerationRequest, ModulePlan

LOGGER = logging.getLogger(__name__)

DEFAULT_MAX_REPAIR_ATTEMPTS = 2
DEFAULT_PLANNING_MAX_TOKENS = 4096


class ModulePlanningError(RuntimeError):
    """The model failed to produce a valid module plan after all attempts."""


class GeminiModuleGenerator:
    """Generate validated module plans using Google Gemini API.

    Since the tested model does not enforce ``response_format``, this generator
    requests JSON via the prompt, extracts it from potential markdown fences,
    validates the result, and retries with error feedback when validation fails.
    """

    def __init__(
        self,
        gemini_client: GeminiClient,
        *,
        max_repair_attempts: int = DEFAULT_MAX_REPAIR_ATTEMPTS,
        planning_max_tokens: int = DEFAULT_PLANNING_MAX_TOKENS,
    ) -> None:
        if max_repair_attempts < 0:
            raise ValueError("max_repair_attempts must be non-negative.")
        self._gemini_client = gemini_client
        self._max_repair_attempts = max_repair_attempts
        self._planning_max_tokens = planning_max_tokens

    def generate(self, generation_request: ModuleGenerationRequest, rag_context: str = "") -> ModulePlan:
        """Call the model and validate or repair the response up to a bounded limit.

        Raises ``ModulePlanningError`` when all attempts are exhausted, or
        propagates ``QwenError`` for provider-level failures.
        """

        messages = build_module_planning_messages(generation_request, rag_context)

        completion = self._gemini_client.create_chat_completion(
            messages,
            max_tokens=self._planning_max_tokens,
        )
        self._log_token_usage(completion.usage)

        raw_content = completion.content or ""
        extracted_json = self._extract_json_from_content(raw_content)

        module_plan = self._try_validate_module_plan(extracted_json)
        if module_plan is not None:
            return module_plan

        # Bounded repair: re-prompt the model with its error.
        last_validation_error = self._get_validation_error_message(extracted_json)
        for repair_attempt in range(1, self._max_repair_attempts + 1):
            LOGGER.info(
                "Module planning repair attempt %d of %d.",
                repair_attempt,
                self._max_repair_attempts,
            )

            repair_messages = build_module_planning_repair_messages(
                generation_request,
                raw_content,
                last_validation_error,
            )

            repair_completion = self._gemini_client.create_chat_completion(
                repair_messages,
                max_tokens=self._planning_max_tokens,
            )
            self._log_token_usage(repair_completion.usage)

            raw_content = repair_completion.content or ""
            extracted_json = self._extract_json_from_content(raw_content)

            module_plan = self._try_validate_module_plan(extracted_json)
            if module_plan is not None:
                LOGGER.info("Module planning repair succeeded on attempt %d.", repair_attempt)
                return module_plan

            last_validation_error = self._get_validation_error_message(extracted_json)

        raise ModulePlanningError(
            f"Module planning failed after {self._max_repair_attempts + 1} attempts. "
            "The model could not produce a valid module plan."
        )

    @staticmethod
    def _extract_json_from_content(content: str) -> str:
        """Extract JSON from markdown code fences if present.

        Models sometimes wrap JSON output in ```json ... ``` fences even when
        instructed not to. This method handles that common case.
        """

        stripped_content = content.strip()
        json_fence_pattern = re.compile(
            r"```(?:json)?\s*\n?(.*?)\n?\s*```",
            re.DOTALL,
        )
        fence_match = json_fence_pattern.search(stripped_content)
        if fence_match:
            return fence_match.group(1).strip()
        return stripped_content

    @staticmethod
    def _try_validate_module_plan(json_text: str) -> ModulePlan | None:
        """Return a validated plan or None when the text is not valid."""

        try:
            return ModulePlan.model_validate_json(json_text)
        except (ValidationError, ValueError):
            return None

    @staticmethod
    def _get_validation_error_message(json_text: str) -> str:
        """Produce a user-safe validation error for repair prompting."""

        try:
            ModulePlan.model_validate_json(json_text)
            return "No error."
        except ValidationError as validation_error:
            # Limit error detail to avoid sending extremely long messages back.
            error_messages = [
                f"  - {error['loc']}: {error['msg']}" for error in validation_error.errors()[:5]
            ]
            return "Schema validation errors:\n" + "\n".join(error_messages)
        except (ValueError, json.JSONDecodeError):
            return "The response is not valid JSON."

    @staticmethod
    def _log_token_usage(usage: object | None) -> None:
        """Record token counts for observability without logging prompt content."""

        if usage is None:
            return
        # The usage object is GeminiTokenUsage but we access attributes safely.
        prompt_tokens = getattr(usage, "prompt_tokens", None)
        completion_tokens = getattr(usage, "completion_tokens", None)
        total_tokens = getattr(usage, "total_tokens", None)
        LOGGER.info(
            "Gemini API token usage: prompt=%s completion=%s total=%s",
            prompt_tokens,
            completion_tokens,
            total_tokens,
        )
