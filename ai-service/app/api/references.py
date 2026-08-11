"""Reference file upload and metadata endpoints."""

from typing import Annotated, cast

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status

from app.ingestion.reference_ingestion_service import (
    ReferenceIngestionError,
    ReferenceIngestionService,
)
from app.ingestion.reference_repository import ReferenceRepository
from app.schemas.references import (
    ExtractedImageListResponse,
    ExtractedImageMetadata,
    ReferenceFileMetadata,
    ReferenceFileUploadResponse,
)
from app.security.internal_auth import InternalRequestContext, require_internal_request

references_router = APIRouter(prefix="/v1/references", tags=["references"])


def _get_ingestion_service(request: Request) -> ReferenceIngestionService:
    """Read the ingestion service created during the FastAPI application lifespan."""

    return cast(ReferenceIngestionService, request.app.state.reference_ingestion_service)


def _get_reference_repository(request: Request) -> ReferenceRepository:
    """Read the reference repository from application state."""

    return cast(ReferenceRepository, request.app.state.reference_repository)


@references_router.post(
    "/upload",
    response_model=ReferenceFileUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_reference_file(
    file: UploadFile,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ReferenceFileUploadResponse:
    """Validate, store, and extract content from one uploaded reference file."""

    if file.filename is None or not file.filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A filename is required.",
        )

    content = await file.read()
    ingestion_service = _get_ingestion_service(request)

    try:
        stored_reference = ingestion_service.ingest_reference_file(
            filename=file.filename,
            content=content,
            owner_user_id=internal_request_context.user_id,
        )
    except ReferenceIngestionError as ingestion_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(ingestion_error),
        ) from ingestion_error

    return ReferenceFileUploadResponse(
        file_id=stored_reference.file_id,
        filename=stored_reference.original_filename,
        content_type=stored_reference.content_type,
        size_bytes=stored_reference.size_bytes,
        extracted_text_length=stored_reference.extracted_text_length,
        extracted_image_count=stored_reference.extracted_image_count,
    )


@references_router.get(
    "/{file_id}",
    response_model=ReferenceFileMetadata,
)
def get_reference_file_metadata(
    file_id: str,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ReferenceFileMetadata:
    """Return metadata for one owned reference file."""

    reference_repository = _get_reference_repository(request)
    stored_reference = reference_repository.get_reference_file_for_owner(
        file_id,
        internal_request_context.user_id,
    )
    if stored_reference is None:
        raise HTTPException(status_code=404, detail="Reference file not found.")

    return ReferenceFileMetadata(
        file_id=stored_reference.file_id,
        filename=stored_reference.original_filename,
        content_type=stored_reference.content_type,
        size_bytes=stored_reference.size_bytes,
        extracted_text_length=stored_reference.extracted_text_length,
        extracted_image_count=stored_reference.extracted_image_count,
        created_at=stored_reference.created_at,
    )


@references_router.get(
    "/{file_id}/images",
    response_model=ExtractedImageListResponse,
)
def get_reference_file_images(
    file_id: str,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> ExtractedImageListResponse:
    """List extracted images for one owned reference file."""

    reference_repository = _get_reference_repository(request)
    stored_images = reference_repository.get_extracted_images_for_file(
        file_id,
        internal_request_context.user_id,
    )

    return ExtractedImageListResponse(
        images=[
            ExtractedImageMetadata(
                image_id=image.image_id,
                source_file_id=image.file_id,
                source_page=image.source_page,
                width=image.width,
                height=image.height,
                format=image.format,
                storage_path=image.storage_path,
                created_at=image.created_at,
            )
            for image in stored_images
        ]
    )


@references_router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_reference_file(
    file_id: str,
    request: Request,
    internal_request_context: Annotated[
        InternalRequestContext,
        Depends(require_internal_request),
    ],
) -> None:
    """Delete a reference file and all its extracted data."""

    ingestion_service = _get_ingestion_service(request)
    deleted = ingestion_service.delete_reference_file(
        file_id,
        internal_request_context.user_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Reference file not found.")
