"""Module-generation job endpoints."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.jobs.repository import GenerationJobRepository, StoredGenerationJob
from app.schemas.generation import ModuleGenerationRequest, ModulePlan
from app.schemas.jobs import GenerationJobStatus, ModuleGenerationJobResponse
from app.security.internal_auth import InternalRequestContext, require_internal_request

generation_router = APIRouter(prefix="/v1/generations", tags=["generations"])


def get_generation_job_repository(request: Request) -> GenerationJobRepository:
    """Read the repository created during the FastAPI application lifespan."""

    return cast(GenerationJobRepository, request.app.state.generation_job_repository)


def build_generation_job_response(
    stored_generation_job: StoredGenerationJob,
) -> ModuleGenerationJobResponse:
    """Convert persisted JSON into the validated public response model."""

    module_plan = (
        ModulePlan.model_validate_json(stored_generation_job.result_json)
        if stored_generation_job.result_json
        else None
    )
    return ModuleGenerationJobResponse(
        id=stored_generation_job.id,
        status=stored_generation_job.status,
        stage=stored_generation_job.stage,
        progress=stored_generation_job.progress,
        result=module_plan,
        error=stored_generation_job.error,
        created_at=stored_generation_job.created_at,
        updated_at=stored_generation_job.updated_at,
    )


@generation_router.post(
    "/modules",
    response_model=ModuleGenerationJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def create_module_generation(
    generation_request: ModuleGenerationRequest,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ModuleGenerationJobResponse:
    """Validate and enqueue a complete draft-module generation request."""

    generation_job_repository = get_generation_job_repository(request)
    stored_generation_job = generation_job_repository.create_generation_job(
        generation_request.model_dump_json(),
        internal_request_context.user_id,
    )
    return build_generation_job_response(stored_generation_job)


@generation_router.get(
    "/{generation_job_id}",
    response_model=ModuleGenerationJobResponse,
)
def get_module_generation(
    generation_job_id: str,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ModuleGenerationJobResponse:
    """Return progress or the completed module plan for one job."""

    stored_generation_job = get_generation_job_repository(
        request,
    ).get_generation_job_for_owner(
        generation_job_id,
        internal_request_context.user_id,
    )
    if stored_generation_job is None:
        raise HTTPException(status_code=404, detail="Generation job not found.")
    return build_generation_job_response(stored_generation_job)


@generation_router.post(
    "/{generation_job_id}/cancel",
    response_model=ModuleGenerationJobResponse,
)
def cancel_module_generation(
    generation_job_id: str,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ModuleGenerationJobResponse:
    """Request cancellation without exposing whether another owner's job exists."""

    stored_generation_job = get_generation_job_repository(
        request,
    ).request_generation_job_cancellation(
        generation_job_id,
        internal_request_context.user_id,
    )
    if stored_generation_job is None:
        raise HTTPException(status_code=404, detail="Generation job not found.")
    if stored_generation_job.status in {
        GenerationJobStatus.COMPLETED,
        GenerationJobStatus.FAILED,
    }:
        raise HTTPException(
            status_code=409,
            detail="Generation job can no longer be cancelled.",
        )
    return build_generation_job_response(stored_generation_job)
