"""Data contracts for AI-assisted module generation."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictSchema(BaseModel):
    """Reject unknown fields and normalize surrounding whitespace."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)




class ModuleGenerationRequest(StrictSchema):
    """Instructor choices sent by the LMS when starting generation."""

    prompt: str = Field(min_length=20, max_length=5_000)
    output_language: str = Field(min_length=2, max_length=50)
    depth: int = Field(default=5, ge=1, le=10)
    use_web_search: bool = False
    reference_file_ids: list[str] = Field(default_factory=list, max_length=20)
    use_reference_visuals: bool = True

    @field_validator("reference_file_ids")
    @classmethod
    def validate_reference_file_ids(cls, file_ids: list[str]) -> list[str]:
        """Reject blank or duplicate reference identifiers."""

        normalized_file_ids = [file_id.strip() for file_id in file_ids]
        if any(not file_id for file_id in normalized_file_ids):
            raise ValueError("Reference file IDs cannot be blank.")
        if len(normalized_file_ids) != len(set(normalized_file_ids)):
            raise ValueError("Reference file IDs must be unique.")
        return normalized_file_ids


class LessonPlan(StrictSchema):
    """Planned lesson content before its presentation is rendered."""

    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=1_000)
    learning_objectives: list[str] = Field(min_length=1, max_length=6)
    presentation_title: str = Field(min_length=3, max_length=120)
    presentations: list[dict] = Field(default_factory=list)

    @field_validator("learning_objectives")
    @classmethod
    def validate_learning_objectives(cls, objectives: list[str]) -> list[str]:
        """Keep every learning objective useful and presentation-friendly."""

        normalized_objectives = [objective.strip() for objective in objectives]
        if any(len(objective) < 3 for objective in normalized_objectives):
            raise ValueError("Learning objectives must contain at least 3 characters.")
        return normalized_objectives


class ModulePlan(StrictSchema):
    """Validated module containing the LMS's flat lesson sequence."""

    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=20, max_length=2_000)
    output_language: str = Field(min_length=2, max_length=50)
    lessons: list[LessonPlan] = Field(min_length=1, max_length=12)
