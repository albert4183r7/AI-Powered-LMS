"""Validated schemas for reference file ingestion and visual catalog."""

from datetime import datetime

from pydantic import Field

from app.schemas.generation import StrictSchema


class ReferenceFileUploadResponse(StrictSchema):
    """Returned to the LMS after a reference file is ingested."""

    file_id: str
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)
    extracted_text_length: int = Field(ge=0)
    extracted_image_count: int = Field(ge=0)


class ReferenceFileMetadata(StrictSchema):
    """Public metadata for a stored reference file."""

    file_id: str
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)
    extracted_text_length: int = Field(ge=0)
    extracted_image_count: int = Field(ge=0)
    created_at: datetime


class ExtractedImageMetadata(StrictSchema):
    """Public metadata for one image extracted from a reference."""

    image_id: str
    source_file_id: str
    source_page: int = Field(ge=0)
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    format: str
    storage_path: str
    created_at: datetime


class ExtractedImageListResponse(StrictSchema):
    """List of images extracted from one reference file."""

    images: list[ExtractedImageMetadata]
