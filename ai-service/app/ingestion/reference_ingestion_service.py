"""Orchestrate the full reference file ingestion pipeline.

This service now supports Visual RAG by ingesting images with CLIP embeddings.
"""

import json
import logging
from pathlib import Path
from uuid import uuid4

from app.ingestion.file_validator import (
    FileValidationError,
    ValidatedFile,
    validate_reference_file,
)
from app.ingestion.image_extractor import (
    ExtractedImage,
    extract_images,
    save_extracted_images,
)
from app.ingestion.rag_service import RagService
from app.ingestion.reference_repository import ReferenceRepository, StoredReferenceFile
from app.ingestion.text_extractor import TextChunk, extract_text

LOGGER = logging.getLogger(__name__)


class ReferenceIngestionError(RuntimeError):
    """A validation or extraction failure with a user-safe message."""

    def __init__(self, message: str, *, code: str) -> None:
        super().__init__(message)
        self.code = code


class ReferenceIngestionService:
    """Validate, store, and extract content from one uploaded reference file."""

    def __init__(
        self,
        reference_repository: ReferenceRepository,
        storage_directory: Path,
        rag_service: RagService | None = None,
        *,
        max_file_size_bytes: int,
        min_image_dimension: int,
    ) -> None:
        self._reference_repository = reference_repository
        self._storage_directory = storage_directory
        self._rag_service = rag_service
        self._max_file_size_bytes = max_file_size_bytes
        self._min_image_dimension = min_image_dimension

    def ingest_reference_file(
        self,
        filename: str,
        content: bytes,
        owner_user_id: str,
    ) -> StoredReferenceFile:
        """Run the complete ingestion pipeline for one uploaded file.

        1. Validate the file (extension, size, magic bytes, encryption)
        2. Store the raw file with a safe UUID filename
        3. Extract text chunks with source provenance
        4. Extract images filtered by minimum dimension
        5. Ingest text into RAG system with embeddings
        6. Ingest images into Visual RAG with CLIP embeddings
        7. Persist all metadata to the database

        Raises ``ReferenceIngestionError`` on validation or extraction failure.
        """

        # Step 1: Validate.
        validation_result = validate_reference_file(
            filename,
            content,
            max_file_size_bytes=self._max_file_size_bytes,
        )
        if isinstance(validation_result, FileValidationError):
            raise ReferenceIngestionError(
                validation_result.message,
                code=validation_result.code.value,
            )

        validated_file: ValidatedFile = validation_result
        file_id = str(uuid4())

        # Step 2: Store the raw file.
        file_storage_directory = self._storage_directory / file_id
        file_storage_directory.mkdir(parents=True, exist_ok=True)
        stored_filename = f"original{validated_file.extension}"
        stored_file_path = file_storage_directory / stored_filename
        stored_file_path.write_bytes(validated_file.content)

        # Step 3: Extract text.
        text_chunks = self._safe_extract_text(validated_file)
        total_text_length = sum(len(chunk.content) for chunk in text_chunks)

        # Save extracted text as JSON for Phase 9 to consume.
        extracted_text_path: str | None = None
        if text_chunks:
            text_data = [
                {
                    "content": chunk.content,
                    "source_page": chunk.source_page,
                    "source_location": chunk.source_location,
                }
                for chunk in text_chunks
            ]
            text_file_path = file_storage_directory / "extracted_text.json"
            text_file_path.write_text(
                json.dumps(text_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            extracted_text_path = str(text_file_path)

        # Step 3b: Ingest text into RAG system if enabled.
        if self._rag_service and text_chunks:
            try:
                text_with_pages = [
                    (chunk.content, chunk.source_page) for chunk in text_chunks
                ]
                ingested_count = self._rag_service.ingest_reference_chunks(
                    file_id=file_id,
                    owner_user_id=owner_user_id,
                    text_with_pages=text_with_pages,
                )
                LOGGER.info(
                    "RAG text ingestion completed for file %s: %d chunks",
                    file_id,
                    ingested_count,
                )
            except Exception as e:
                LOGGER.warning(
                    "RAG text ingestion failed for file %s: %s",
                    file_id,
                    e,
                    exc_info=True,
                )
                # Continue without failing the entire ingestion

        # Step 4: Extract images.
        extracted_images = self._safe_extract_images(validated_file)
        image_paths: dict[str, str] = {}
        if extracted_images:
            images_directory = file_storage_directory / "images"
            image_paths = save_extracted_images(extracted_images, images_directory)

        # Step 4b: Ingest images into Visual RAG if enabled.
        if self._rag_service and extracted_images:
            try:
                for image in extracted_images:
                    image_path = image_paths.get(image.image_id, "")
                    if image_path:
                        # Generate a simple caption based on page info
                        caption = f"Image from page {image.source_page} of {validated_file.original_filename}"
                        
                        success = self._rag_service.ingest_image_with_embedding(
                            file_id=file_id,
                            owner_user_id=owner_user_id,
                            image_id=image.image_id,
                            image_path=image_path,
                            source_page=image.source_page,
                            caption=caption,
                        )
                        if success:
                            LOGGER.info(
                                "Visual RAG ingestion completed for image %s",
                                image.image_id,
                            )
            except Exception as e:
                LOGGER.warning(
                    "Visual RAG image ingestion failed for file %s: %s",
                    file_id,
                    e,
                    exc_info=True,
                )
                # Continue without failing the entire ingestion

        # Step 5: Persist metadata.
        stored_reference = self._reference_repository.store_reference_file(
            file_id=file_id,
            owner_user_id=owner_user_id,
            original_filename=validated_file.original_filename,
            content_type=validated_file.content_type,
            size_bytes=validated_file.size_bytes,
            storage_path=str(stored_file_path),
            extracted_text_path=extracted_text_path,
            extracted_text_length=total_text_length,
            extracted_image_count=len(extracted_images),
        )

        for image in extracted_images:
            image_storage_path = image_paths.get(image.image_id, "")
            self._reference_repository.store_extracted_image(
                image_id=image.image_id,
                file_id=file_id,
                source_page=image.source_page,
                width=image.width,
                height=image.height,
                image_format=image.image_format,
                storage_path=image_storage_path,
            )

        LOGGER.info(
            "Reference file ingested: file_id=%s text_length=%d images=%d",
            file_id,
            total_text_length,
            len(extracted_images),
        )

        return stored_reference

    def _safe_extract_text(self, validated_file: ValidatedFile) -> list[TextChunk]:
        """Extract text without failing the entire ingestion on parser errors."""

        try:
            return extract_text(validated_file.content, validated_file.extension)
        except Exception:
            LOGGER.warning(
                "Text extraction failed for %s, continuing without text.",
                validated_file.original_filename,
                exc_info=True,
            )
            return []

    def _safe_extract_images(self, validated_file: ValidatedFile) -> list[ExtractedImage]:
        """Extract images without failing the entire ingestion on parser errors."""

        try:
            return extract_images(
                validated_file.content,
                validated_file.extension,
                min_dimension=self._min_image_dimension,
            )
        except Exception:
            LOGGER.warning(
                "Image extraction failed for %s, continuing without images.",
                validated_file.original_filename,
                exc_info=True,
            )
            return []

    def delete_reference_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> bool:
        """Delete a reference file and all its extracted data from disk and database."""

        # Get the file info before deleting from DB.
        reference = self._reference_repository.get_reference_file_for_owner(file_id, owner_user_id)
        if reference is None:
            return False

        # Delete from database first.
        deleted = self._reference_repository.delete_reference_file(file_id, owner_user_id)
        if not deleted:
            return False

        # Clean up the file storage directory.
        file_storage_directory = self._storage_directory / file_id
        if file_storage_directory.exists():
            import shutil

            shutil.rmtree(file_storage_directory, ignore_errors=True)

        LOGGER.info("Reference file deleted: file_id=%s", file_id)
        return True
