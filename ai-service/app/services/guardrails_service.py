"""Basic content policy checking for generated modules."""

import logging
from typing import Any

from app.schemas.generation import ModulePlan

LOGGER = logging.getLogger(__name__)

# Very basic sample blocklist for demonstration of guardrails
PROHIBITED_KEYWORDS = {
    "hate speech",
    "kill yourself",
    "make a bomb",
    "illegal",
    "explicit sexual",
}

class ContentPolicyViolationError(ValueError):
    """Raised when generated content violates the platform content policy."""


class GuardrailsService:
    """Enforce content policy rules on AI-generated outputs."""

    def __init__(self, blocklist: set[str] | None = None) -> None:
        self._blocklist = blocklist if blocklist is not None else PROHIBITED_KEYWORDS

    def validate_plan(self, module_plan: ModulePlan) -> None:
        """Check if the generated module plan contains prohibited content.
        
        Raises ContentPolicyViolationError if violations are found.
        """
        
        texts_to_check = [
            module_plan.title,
            module_plan.description,
        ]
        
        for lesson in module_plan.lessons:
            texts_to_check.append(lesson.title)
            texts_to_check.append(lesson.description)
            texts_to_check.extend(lesson.learning_objectives)
            texts_to_check.append(lesson.presentation_title)
            
        for text in texts_to_check:
            self._check_text(text)
            
        LOGGER.info("Module plan passed guardrails content policy validation.")

    def _check_text(self, text: str) -> None:
        if not text:
            return
            
        text_lower = text.lower()
        for keyword in self._blocklist:
            if keyword in text_lower:
                LOGGER.warning("Content policy violation detected: keyword '%s'", keyword)
                raise ContentPolicyViolationError(
                    f"Generated content violated the safety policy. Found prohibited terminology."
                )
