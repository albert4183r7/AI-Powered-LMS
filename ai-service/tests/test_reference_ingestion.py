"""Integration tests for the reference ingestion pipeline and repository."""

from pathlib import Path

import pytest

from app.ingestion.reference_ingestion_service import (
    ReferenceIngestionError,
    ReferenceIngestionService,
)
from app.ingestion.reference_repository import ReferenceRepository


def build_ingestion_service(
    database_path: Path,
    storage_directory: Path,
) -> tuple[ReferenceIngestionService, ReferenceRepository]:
    """Create an isolated ingestion service with temporary storage."""

    repository = ReferenceRepository(database_path)
    repository.initialize_tables()
    service = ReferenceIngestionService(
        reference_repository=repository,
        storage_directory=storage_directory,
        max_file_size_bytes=25 * 1024 * 1024,
        min_image_dimension=100,
    )
    return service, repository


def test_ingest_valid_txt_file(tmp_path: Path) -> None:
    """A plain text file should be stored with extracted text metadata."""

    service, repository = build_ingestion_service(
        tmp_path / "db.sqlite",
        tmp_path / "refs",
    )
    content = b"This is a training document about presales onboarding."

    stored = service.ingest_reference_file("guide.txt", content, "instructor-1")

    assert stored.original_filename == "guide.txt"
    assert stored.content_type == "text/plain"
    assert stored.size_bytes == len(content)
    assert stored.extracted_text_length > 0
    assert stored.extracted_image_count == 0

    # Verify database persistence.
    retrieved = repository.get_reference_file_for_owner(stored.file_id, "instructor-1")
    assert retrieved is not None
    assert retrieved.original_filename == "guide.txt"


def test_ingest_rejects_unsupported_extension(tmp_path: Path) -> None:
    """Files with unsupported extensions should raise ReferenceIngestionError."""

    service, _ = build_ingestion_service(tmp_path / "db.sqlite", tmp_path / "refs")

    with pytest.raises(ReferenceIngestionError, match="Unsupported file type"):
        service.ingest_reference_file("script.exe", b"MZ\x90\x00", "instructor-1")


def test_ingest_rejects_oversized_file(tmp_path: Path) -> None:
    """Files exceeding the size limit should be rejected."""

    repository = ReferenceRepository(tmp_path / "db.sqlite")
    repository.initialize_tables()
    service = ReferenceIngestionService(
        reference_repository=repository,
        storage_directory=tmp_path / "refs",
        max_file_size_bytes=100,
        min_image_dimension=100,
    )

    with pytest.raises(ReferenceIngestionError, match="size limit"):
        service.ingest_reference_file("big.txt", b"x" * 200, "instructor-1")


def test_owner_scoped_retrieval(tmp_path: Path) -> None:
    """Files should only be visible to their owner."""

    service, repository = build_ingestion_service(
        tmp_path / "db.sqlite",
        tmp_path / "refs",
    )
    stored = service.ingest_reference_file("doc.txt", b"Content", "instructor-1")

    # Owner can see it.
    assert repository.get_reference_file_for_owner(stored.file_id, "instructor-1") is not None
    # Other user cannot.
    assert repository.get_reference_file_for_owner(stored.file_id, "instructor-2") is None


def test_delete_reference_file_removes_all_data(tmp_path: Path) -> None:
    """Deletion should remove database records and storage files."""

    service, repository = build_ingestion_service(
        tmp_path / "db.sqlite",
        tmp_path / "refs",
    )
    stored = service.ingest_reference_file("doc.txt", b"Content", "instructor-1")
    storage_dir = tmp_path / "refs" / stored.file_id

    assert storage_dir.exists()

    deleted = service.delete_reference_file(stored.file_id, "instructor-1")
    assert deleted is True
    assert repository.get_reference_file_for_owner(stored.file_id, "instructor-1") is None
    assert not storage_dir.exists()


def test_delete_nonexistent_file_returns_false(tmp_path: Path) -> None:
    """Deleting a file that doesn't exist should return False."""

    service, _ = build_ingestion_service(tmp_path / "db.sqlite", tmp_path / "refs")
    assert service.delete_reference_file("nonexistent", "instructor-1") is False


def test_delete_other_users_file_returns_false(tmp_path: Path) -> None:
    """Deleting another user's file should return False."""

    service, _ = build_ingestion_service(tmp_path / "db.sqlite", tmp_path / "refs")
    stored = service.ingest_reference_file("doc.txt", b"Content", "instructor-1")

    assert service.delete_reference_file(stored.file_id, "instructor-2") is False


def test_batch_lookup_by_ids(tmp_path: Path) -> None:
    """Batch ID lookup should return only owned files."""

    service, repository = build_ingestion_service(
        tmp_path / "db.sqlite",
        tmp_path / "refs",
    )
    file1 = service.ingest_reference_file("doc1.txt", b"Content 1", "instructor-1")
    file2 = service.ingest_reference_file("doc2.txt", b"Content 2", "instructor-1")
    file3 = service.ingest_reference_file("doc3.txt", b"Content 3", "instructor-2")

    # Owner 1 requests all three IDs but should only get two.
    results = repository.get_reference_files_by_ids_for_owner(
        [file1.file_id, file2.file_id, file3.file_id],
        "instructor-1",
    )
    result_ids = {r.file_id for r in results}
    assert file1.file_id in result_ids
    assert file2.file_id in result_ids
    assert file3.file_id not in result_ids


def test_extracted_text_saved_as_json(tmp_path: Path) -> None:
    """The extracted text should be persisted as a JSON file for Phase 9."""

    service, _ = build_ingestion_service(tmp_path / "db.sqlite", tmp_path / "refs")
    stored = service.ingest_reference_file(
        "doc.txt",
        b"Training content for solution consultants.",
        "instructor-1",
    )

    assert stored.extracted_text_path is not None
    text_file = Path(stored.extracted_text_path)
    assert text_file.exists()
    assert "Training content" in text_file.read_text(encoding="utf-8")
