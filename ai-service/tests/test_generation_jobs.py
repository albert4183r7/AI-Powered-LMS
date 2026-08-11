"""End-to-end tests for the persisted fake generation-job workflow."""

import time
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import AiServiceSettings
from app.jobs.repository import GenerationJobRepository
from app.jobs.worker import GenerationWorker
from app.main import create_app
from app.schemas.generation import ModuleGenerationRequest, ModulePlan

INTERNAL_API_KEY = "local-development-internal-key-change-before-production"
INSTRUCTOR_HEADERS = {
    "X-Lumen-Internal-Key": INTERNAL_API_KEY,
    "X-Lumen-User-Id": "instructor-user-id",
}


class FailingModuleGenerator:
    """Test double that simulates a provider failure containing sensitive text."""

    def generate(self, generation_request: ModuleGenerationRequest) -> ModulePlan:
        raise RuntimeError(f"Provider rejected prompt: {generation_request.prompt}")


def build_test_client(database_path: Path) -> TestClient:
    """Create an isolated app whose worker uses a temporary SQLite file."""

    ai_service_settings = AiServiceSettings(
        jobs_database_path=database_path,
        worker_poll_interval_seconds=0.01,
        fake_generation_delay_seconds=0,
    )
    return TestClient(create_app(ai_service_settings))


def build_valid_generation_request_payload() -> dict[str, object]:
    """Return the smallest representative request accepted by the contract."""

    return {
        "prompt": "Create practical presales onboarding for new solution consultants.",
        "output_language": "English",
        "depth": "standard",
        "use_web_search": False,
        "reference_file_ids": [],
        "use_reference_visuals": True,
    }


def test_module_generation_job_completes_with_valid_plan(tmp_path: Path) -> None:
    """A queued request should eventually expose a validated module plan."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        create_generation_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
            headers=INSTRUCTOR_HEADERS,
        )

        assert create_generation_response.status_code == 202
        generation_job_id = create_generation_response.json()["id"]

        completed_generation_job: dict[str, object] | None = None
        for _ in range(100):
            generation_job_response = api_client.get(
                f"/v1/generations/{generation_job_id}",
                headers=INSTRUCTOR_HEADERS,
            )
            assert generation_job_response.status_code == 200
            generation_job_response_payload = generation_job_response.json()
            if generation_job_response_payload["status"] == "completed":
                completed_generation_job = generation_job_response_payload
                break
            time.sleep(0.01)

        assert completed_generation_job is not None
        assert completed_generation_job["progress"] == 100
        module_plan_payload = completed_generation_job["result"]
        assert isinstance(module_plan_payload, dict)
        assert module_plan_payload["output_language"] == "English"
        assert len(module_plan_payload["lessons"]) == 5


def test_module_generation_rejects_invalid_request(tmp_path: Path) -> None:
    """Invalid input should return 422 without creating a background job."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        invalid_request_response = api_client.post(
            "/v1/generations/modules",
            json={"prompt": "Too short", "output_language": "English"},
            headers=INSTRUCTOR_HEADERS,
        )

    assert invalid_request_response.status_code == 422


def test_generation_job_returns_not_found(tmp_path: Path) -> None:
    """Unknown job identifiers should return a clear HTTP 404 response."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        missing_job_response = api_client.get(
            "/v1/generations/missing-job",
            headers=INSTRUCTOR_HEADERS,
        )

    assert missing_job_response.status_code == 404
    assert missing_job_response.json()["detail"] == "Generation job not found."


def test_interrupted_running_job_is_requeued(tmp_path: Path) -> None:
    """Startup recovery should prevent jobs from remaining stuck as running."""

    generation_job_repository = GenerationJobRepository(tmp_path / "jobs.db")
    generation_job_repository.initialize_database()
    created_generation_job = generation_job_repository.create_generation_job(
        '{"prompt":"stored request"}',
        "instructor-user-id",
    )
    claimed_generation_job = generation_job_repository.claim_next_queued_job()

    assert claimed_generation_job is not None
    assert claimed_generation_job.status.value == "processing"

    generation_job_repository.requeue_interrupted_jobs()
    recovered_generation_job = generation_job_repository.get_generation_job(
        created_generation_job.id,
    )

    assert recovered_generation_job is not None
    assert recovered_generation_job.status.value == "queued"
    assert recovered_generation_job.progress == 0


def test_worker_stores_only_user_safe_error_message(tmp_path: Path) -> None:
    """Provider exception details must not be returned through the job API."""

    generation_job_repository = GenerationJobRepository(tmp_path / "jobs.db")
    generation_job_repository.initialize_database()
    generation_request = ModuleGenerationRequest.model_validate(
        build_valid_generation_request_payload(),
    )
    created_generation_job = generation_job_repository.create_generation_job(
        generation_request.model_dump_json(),
        "instructor-user-id",
    )
    generation_worker = GenerationWorker(
        generation_job_repository=generation_job_repository,
        module_generator=FailingModuleGenerator(),
        poll_interval_seconds=0.01,
    )

    generation_worker.start()
    try:
        failed_generation_job = None
        for _ in range(100):
            failed_generation_job = generation_job_repository.get_generation_job(
                created_generation_job.id,
            )
            if failed_generation_job is not None and failed_generation_job.status.value == "failed":
                break
            time.sleep(0.01)
    finally:
        generation_worker.stop()

    assert failed_generation_job is not None
    assert failed_generation_job.status.value == "failed"
    assert failed_generation_job.error == "Module generation failed. Please try again."
    assert "presales" not in failed_generation_job.error


def test_generation_endpoint_rejects_missing_internal_credentials(tmp_path: Path) -> None:
    """The Python service must not accept direct browser generation requests."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        unauthorized_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
        )

    assert unauthorized_response.status_code == 401
    assert unauthorized_response.json()["detail"] == "Invalid internal service credentials."


def test_generation_job_is_visible_only_to_its_owner(tmp_path: Path) -> None:
    """A valid internal caller cannot read another instructor's generation job."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        create_generation_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
            headers=INSTRUCTOR_HEADERS,
        )
        generation_job_id = create_generation_response.json()["id"]

        other_instructor_response = api_client.get(
            f"/v1/generations/{generation_job_id}",
            headers={
                "X-Lumen-Internal-Key": INTERNAL_API_KEY,
                "X-Lumen-User-Id": "different-instructor-id",
            },
        )

    assert other_instructor_response.status_code == 404
    assert other_instructor_response.json()["detail"] == "Generation job not found."


def test_generation_job_can_be_cancelled_during_processing(tmp_path: Path) -> None:
    """A processing fake job must finish as cancelled rather than completed."""

    ai_service_settings = AiServiceSettings(
        jobs_database_path=tmp_path / "jobs.db",
        worker_poll_interval_seconds=0.01,
        fake_generation_delay_seconds=0.2,
    )
    with TestClient(create_app(ai_service_settings)) as api_client:
        create_generation_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
            headers=INSTRUCTOR_HEADERS,
        )
        generation_job_id = create_generation_response.json()["id"]

        processing_generation_job: dict[str, object] | None = None
        for _ in range(100):
            status_response = api_client.get(
                f"/v1/generations/{generation_job_id}",
                headers=INSTRUCTOR_HEADERS,
            )
            if status_response.json()["status"] == "processing":
                processing_generation_job = status_response.json()
                break
            time.sleep(0.01)

        assert processing_generation_job is not None
        cancel_response = api_client.post(
            f"/v1/generations/{generation_job_id}/cancel",
            headers=INSTRUCTOR_HEADERS,
        )
        assert cancel_response.status_code == 200
        assert cancel_response.json()["status"] == "cancelling"

        cancelled_generation_job: dict[str, object] | None = None
        for _ in range(100):
            status_response = api_client.get(
                f"/v1/generations/{generation_job_id}",
                headers=INSTRUCTOR_HEADERS,
            )
            if status_response.json()["status"] == "cancelled":
                cancelled_generation_job = status_response.json()
                break
            time.sleep(0.01)

        assert cancelled_generation_job is not None
        assert cancelled_generation_job["result"] is None


def test_generation_job_cancellation_is_owner_scoped(tmp_path: Path) -> None:
    """Cancellation must not reveal or mutate another instructor's job."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        create_generation_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
            headers=INSTRUCTOR_HEADERS,
        )
        generation_job_id = create_generation_response.json()["id"]

        cancel_response = api_client.post(
            f"/v1/generations/{generation_job_id}/cancel",
            headers={
                "X-Lumen-Internal-Key": INTERNAL_API_KEY,
                "X-Lumen-User-Id": "different-instructor-id",
            },
        )

    assert cancel_response.status_code == 404
    assert cancel_response.json()["detail"] == "Generation job not found."


def test_completed_generation_job_cannot_be_cancelled(tmp_path: Path) -> None:
    """Terminal completed work should return a stable conflict response."""

    with build_test_client(tmp_path / "jobs.db") as api_client:
        create_generation_response = api_client.post(
            "/v1/generations/modules",
            json=build_valid_generation_request_payload(),
            headers=INSTRUCTOR_HEADERS,
        )
        generation_job_id = create_generation_response.json()["id"]

        for _ in range(100):
            status_response = api_client.get(
                f"/v1/generations/{generation_job_id}",
                headers=INSTRUCTOR_HEADERS,
            )
            if status_response.json()["status"] == "completed":
                break
            time.sleep(0.01)

        cancel_response = api_client.post(
            f"/v1/generations/{generation_job_id}/cancel",
            headers=INSTRUCTOR_HEADERS,
        )

    assert cancel_response.status_code == 409
    assert cancel_response.json()["detail"] == "Generation job can no longer be cancelled."


def test_cancellation_wins_over_late_worker_failure(tmp_path: Path) -> None:
    """A provider failure after cancellation must not leave the job cancelling."""

    generation_job_repository = GenerationJobRepository(tmp_path / "jobs.db")
    generation_job_repository.initialize_database()
    created_generation_job = generation_job_repository.create_generation_job(
        '{"prompt":"stored request"}',
        "instructor-user-id",
    )
    claimed_generation_job = generation_job_repository.claim_next_queued_job()
    assert claimed_generation_job is not None

    cancelling_generation_job = generation_job_repository.request_generation_job_cancellation(
        created_generation_job.id,
        "instructor-user-id",
    )
    assert cancelling_generation_job is not None
    assert cancelling_generation_job.status.value == "cancelling"

    generation_job_repository.mark_generation_job_failed(
        created_generation_job.id,
        "Module generation failed. Please try again.",
    )
    cancelled_generation_job = generation_job_repository.get_generation_job(
        created_generation_job.id,
    )

    assert cancelled_generation_job is not None
    assert cancelled_generation_job.status.value == "cancelled"
    assert cancelled_generation_job.error is None
