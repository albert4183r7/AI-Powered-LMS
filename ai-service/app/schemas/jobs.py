"""Public schemas for background generation jobs."""

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.schemas.generation import ModulePlan, StrictSchema


class GenerationJobStatus(StrEnum):
    """Lifecycle states exposed to the LMS."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"


class GenerationJobStage(StrEnum):
    """User-facing progress stages for module generation."""

    QUEUED = "queued"
    ANALYZING_REFERENCES = "analyzing_references"
    PLANNING = "planning_module"
    GENERATING_PRESENTATIONS = "generating_presentations"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLING = "cancelling"
    CANCELLED = "cancelled"


class ModuleGenerationJobResponse(StrictSchema):
    """Current state and optional result of one module-generation job."""

    id: str
    status: GenerationJobStatus
    stage: GenerationJobStage
    progress: int = Field(ge=0, le=100)
    result: ModulePlan | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
