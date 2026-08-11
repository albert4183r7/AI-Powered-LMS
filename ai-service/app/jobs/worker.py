"""Single-worker execution loop for persisted generation jobs."""

import logging
from threading import Event, Thread

from app.jobs.repository import GenerationJobRepository, StoredGenerationJob
from app.schemas.generation import ModuleGenerationRequest
from app.services.module_generator import ModuleGenerator

LOGGER = logging.getLogger(__name__)
WORKER_SHUTDOWN_TIMEOUT_SECONDS = 5


class GenerationWorker:
    """Process queued jobs one at a time so generation remains predictable."""

    def __init__(
        self,
        generation_job_repository: GenerationJobRepository,
        module_generator: ModuleGenerator,
        poll_interval_seconds: float,
    ) -> None:
        self._generation_job_repository = generation_job_repository
        self._module_generator = module_generator
        self._poll_interval_seconds = poll_interval_seconds
        self._stop_event = Event()
        self._worker_thread = Thread(
            target=self._run,
            name="generation-worker",
            daemon=True,
        )

    def start(self) -> None:
        """Recover interrupted work and start the polling thread."""

        self._generation_job_repository.requeue_interrupted_jobs()
        self._worker_thread.start()

    def stop(self) -> None:
        """Ask the worker to stop and wait briefly for a clean shutdown."""

        self._stop_event.set()
        self._worker_thread.join(timeout=WORKER_SHUTDOWN_TIMEOUT_SECONDS)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            stored_generation_job = self._generation_job_repository.claim_next_queued_job()
            if stored_generation_job is None:
                self._stop_event.wait(self._poll_interval_seconds)
                continue
            self._process_generation_job(stored_generation_job)

    def _process_generation_job(
        self,
        stored_generation_job: StoredGenerationJob,
    ) -> None:
        try:
            generation_request = ModuleGenerationRequest.model_validate_json(
                stored_generation_job.request_json,
            )
            module_plan = self._module_generator.generate(generation_request)
            self._generation_job_repository.mark_generation_job_completed(
                stored_generation_job.id,
                module_plan.model_dump_json(),
            )
        except Exception as generation_error:
            # Log only the exception type because exception messages may contain input data.
            LOGGER.error(
                "Module generation job failed with error type %s.",
                type(generation_error).__name__,
                extra={"generation_job_id": stored_generation_job.id},
            )
            self._generation_job_repository.mark_generation_job_failed(
                stored_generation_job.id,
                "Module generation failed. Please try again.",
            )
