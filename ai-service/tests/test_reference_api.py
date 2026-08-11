"""End-to-end tests for the reference file ingestion API endpoints."""

from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import AiServiceSettings
from app.main import create_app

INTERNAL_API_KEY = "local-development-internal-key-change-before-production"
INSTRUCTOR_HEADERS = {
    "X-Lumen-Internal-Key": INTERNAL_API_KEY,
    "X-Lumen-User-Id": "instructor-1",
}
OTHER_USER_HEADERS = {
    "X-Lumen-Internal-Key": INTERNAL_API_KEY,
    "X-Lumen-User-Id": "instructor-2",
}

VALID_TXT_CONTENT = b"This is a training document about presales onboarding strategies."
VALID_PDF_CONTENT = b"%PDF-1.4\nMinimal PDF content for testing."


def build_test_client(tmp_path: Path) -> TestClient:
    """Create an isolated app with a temporary database and storage directory."""

    settings = AiServiceSettings(
        jobs_database_path=tmp_path / "db.sqlite",
        reference_storage_path=tmp_path / "refs",
        worker_poll_interval_seconds=0.01,
        fake_generation_delay_seconds=0,
    )
    return TestClient(create_app(settings))


def upload_txt_file(
    api_client: TestClient,
    content: bytes = VALID_TXT_CONTENT,
    filename: str = "guide.txt",
    headers: dict[str, str] | None = None,
) -> dict[str, object]:
    """Helper to upload a TXT file and return the parsed response body."""

    response = api_client.post(
        "/v1/references/upload",
        files={"file": (filename, BytesIO(content), "text/plain")},
        headers=headers or INSTRUCTOR_HEADERS,
    )
    return response


def test_upload_valid_txt_returns_201(tmp_path: Path) -> None:
    """A valid TXT upload should return HTTP 201 with file metadata."""

    with build_test_client(tmp_path) as api_client:
        response = upload_txt_file(api_client)

    assert response.status_code == 201
    body = response.json()
    assert "file_id" in body
    assert body["filename"] == "guide.txt"
    assert body["content_type"] == "text/plain"
    assert body["size_bytes"] == len(VALID_TXT_CONTENT)
    assert body["extracted_text_length"] > 0
    assert isinstance(body["file_id"], str)
    assert len(body["file_id"]) > 0


def test_upload_valid_pdf_returns_201(tmp_path: Path) -> None:
    """A valid PDF upload should return HTTP 201."""

    with build_test_client(tmp_path) as api_client:
        response = api_client.post(
            "/v1/references/upload",
            files={"file": ("report.pdf", BytesIO(VALID_PDF_CONTENT), "application/pdf")},
            headers=INSTRUCTOR_HEADERS,
        )

    assert response.status_code == 201
    assert response.json()["filename"] == "report.pdf"


def test_upload_unsupported_file_returns_422(tmp_path: Path) -> None:
    """A file with an unsupported extension should return HTTP 422."""

    with build_test_client(tmp_path) as api_client:
        response = api_client.post(
            "/v1/references/upload",
            files={"file": ("script.exe", BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
            headers=INSTRUCTOR_HEADERS,
        )

    assert response.status_code == 422
    assert "Unsupported file type" in response.json().get("detail", "")


def test_upload_oversized_file_returns_422(tmp_path: Path) -> None:
    """A file exceeding the size limit should return HTTP 422."""

    settings = AiServiceSettings(
        jobs_database_path=tmp_path / "db.sqlite",
        reference_storage_path=tmp_path / "refs",
        reference_max_file_size_bytes=50,
        worker_poll_interval_seconds=0.01,
        fake_generation_delay_seconds=0,
    )
    with TestClient(create_app(settings)) as api_client:
        response = api_client.post(
            "/v1/references/upload",
            files={"file": ("big.txt", BytesIO(b"x" * 200), "text/plain")},
            headers=INSTRUCTOR_HEADERS,
        )

    assert response.status_code == 422
    assert "size limit" in response.json().get("detail", "")


def test_upload_rejects_missing_internal_auth(tmp_path: Path) -> None:
    """Requests without internal authentication should be rejected."""

    with build_test_client(tmp_path) as api_client:
        response = api_client.post(
            "/v1/references/upload",
            files={"file": ("guide.txt", BytesIO(VALID_TXT_CONTENT), "text/plain")},
        )

    assert response.status_code == 401


def test_get_metadata_returns_file_info(tmp_path: Path) -> None:
    """Metadata endpoint should return info for the owner's file."""

    with build_test_client(tmp_path) as api_client:
        upload_response = upload_txt_file(api_client)
        file_id = upload_response.json()["file_id"]

        metadata_response = api_client.get(
            f"/v1/references/{file_id}",
            headers=INSTRUCTOR_HEADERS,
        )

    assert metadata_response.status_code == 200
    body = metadata_response.json()
    assert body["file_id"] == file_id
    assert body["filename"] == "guide.txt"
    assert "created_at" in body


def test_get_metadata_returns_404_for_other_user(tmp_path: Path) -> None:
    """Another user should not be able to retrieve someone else's file metadata."""

    with build_test_client(tmp_path) as api_client:
        upload_response = upload_txt_file(api_client)
        file_id = upload_response.json()["file_id"]

        other_response = api_client.get(
            f"/v1/references/{file_id}",
            headers=OTHER_USER_HEADERS,
        )

    assert other_response.status_code == 404


def test_get_images_returns_empty_list_for_txt(tmp_path: Path) -> None:
    """A TXT file should have no extracted images."""

    with build_test_client(tmp_path) as api_client:
        upload_response = upload_txt_file(api_client)
        file_id = upload_response.json()["file_id"]

        images_response = api_client.get(
            f"/v1/references/{file_id}/images",
            headers=INSTRUCTOR_HEADERS,
        )

    assert images_response.status_code == 200
    assert images_response.json()["images"] == []


def test_delete_reference_returns_204(tmp_path: Path) -> None:
    """Deleting an owned reference should return HTTP 204."""

    with build_test_client(tmp_path) as api_client:
        upload_response = upload_txt_file(api_client)
        file_id = upload_response.json()["file_id"]

        delete_response = api_client.delete(
            f"/v1/references/{file_id}",
            headers=INSTRUCTOR_HEADERS,
        )
        assert delete_response.status_code == 204

        # Subsequent metadata request should return 404.
        metadata_response = api_client.get(
            f"/v1/references/{file_id}",
            headers=INSTRUCTOR_HEADERS,
        )
        assert metadata_response.status_code == 404


def test_delete_returns_404_for_nonexistent_file(tmp_path: Path) -> None:
    """Deleting a file that doesn't exist should return HTTP 404."""

    with build_test_client(tmp_path) as api_client:
        response = api_client.delete(
            "/v1/references/nonexistent-id",
            headers=INSTRUCTOR_HEADERS,
        )

    assert response.status_code == 404


def test_delete_returns_404_for_other_users_file(tmp_path: Path) -> None:
    """A user cannot delete another user's reference file."""

    with build_test_client(tmp_path) as api_client:
        upload_response = upload_txt_file(api_client)
        file_id = upload_response.json()["file_id"]

        delete_response = api_client.delete(
            f"/v1/references/{file_id}",
            headers=OTHER_USER_HEADERS,
        )
        assert delete_response.status_code == 404

        # Owner's file should still be intact.
        metadata_response = api_client.get(
            f"/v1/references/{file_id}",
            headers=INSTRUCTOR_HEADERS,
        )
        assert metadata_response.status_code == 200
