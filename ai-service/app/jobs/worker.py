"""Single-worker execution loop for persisted generation jobs."""

import logging
from threading import Event, Thread

from app.jobs.repository import GenerationJobRepository, StoredGenerationJob
from app.schemas.generation import ModuleGenerationRequest
from app.services.module_generator import ModuleGenerator
from app.services.guardrails_service import GuardrailsService, ContentPolicyViolationError
from app.services.presentation_generator import PresentationGenerator
from app.ingestion.rag_service import RagService

LOGGER = logging.getLogger(__name__)
WORKER_SHUTDOWN_TIMEOUT_SECONDS = 5


class GenerationWorker:
    """Process queued jobs one at a time so generation remains predictable."""

    def __init__(
        self,
        generation_job_repository: GenerationJobRepository,
        module_generator: ModuleGenerator,
        guardrails_service: GuardrailsService,
        presentation_generator: PresentationGenerator,
        poll_interval_seconds: float,
        rag_service: RagService | None = None,
    ) -> None:
        self._generation_job_repository = generation_job_repository
        self._module_generator = module_generator
        self._guardrails_service = guardrails_service
        self._presentation_generator = presentation_generator
        self._rag_service = rag_service
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

            rag_context = ""
            if self._rag_service and generation_request.reference_file_ids:
                try:
                    rag_context = self._rag_service.build_rag_context(
                        query=generation_request.prompt,
                        file_ids=generation_request.reference_file_ids,
                        owner_user_id=stored_generation_job.owner_user_id,
                    )
                except Exception as rag_error:
                    LOGGER.warning(
                        "RAG context retrieval failed for job %s: %s",
                        stored_generation_job.id,
                        type(rag_error).__name__,
                    )

            module_plan = self._module_generator.generate(generation_request, rag_context)
            
            # Validate output against content policy
            self._guardrails_service.validate_plan(module_plan)
            
            # Generate presentations for each lesson
            for lesson in module_plan.lessons:
                presentation_meta = self._presentation_generator.generate(lesson, module_plan.title)
                # Ensure the presentations list exists
                if not hasattr(lesson, 'presentations'):
                    lesson.presentations = []
                lesson.presentations.append(presentation_meta)
            
            self._generation_job_repository.mark_generation_job_completed(
                stored_generation_job.id,
                module_plan.model_dump_json(),
            )
        except ContentPolicyViolationError as policy_error:
            LOGGER.error(
                "Generation job %s blocked by content policy: %s",
                stored_generation_job.id,
                str(policy_error),
            )
            self._generation_job_repository.mark_generation_job_failed(
                stored_generation_job.id,
                "Module generation failed due to safety policy violation. Please revise your request.",
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
