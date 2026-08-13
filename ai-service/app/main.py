"""FastAPI application entry point and dependency lifecycle."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.api.generations import generation_router
from app.api.references import references_router
from app.config import AiServiceSettings, get_ai_service_settings
from app.ingestion.reference_ingestion_service import ReferenceIngestionService
from app.ingestion.reference_repository import ReferenceRepository
from app.jobs.repository import GenerationJobRepository
from app.jobs.worker import GenerationWorker
from app.providers.ecoapi import EcoApiClient
from app.ingestion.embedding_service import EmbeddingService
from app.ingestion.rag_service import RagService
from app.services.module_generator import ModuleGenerator
from app.services.ecoapi_module_generator import EcoApiModuleGenerator
from app.services.guardrails_service import GuardrailsService
from app.services.presentation_generator import PresentationGenerator

LOGGER = logging.getLogger(__name__)


def _build_module_generator(
    ai_service_settings: AiServiceSettings,
) -> tuple[ModuleGenerator, EcoApiClient | None]:
    """Select the real or fake generator based on configuration.

    Returns the generator and an optional EcoApiClient that must be closed
    on shutdown when the real generator is active.
    """

    ecoapi_client = EcoApiClient(
        base_url=ai_service_settings.ollama_base_url,
        api_key="ollama", # Local Ollama ignores this
        model=ai_service_settings.ollama_model,
        timeout_seconds=ai_service_settings.request_timeout_seconds,
    )
    LOGGER.info("Module generator: EcoApiModuleGenerator (Ollama provider).")
    return EcoApiModuleGenerator(ecoapi_client=ecoapi_client), ecoapi_client


def create_app(settings: AiServiceSettings | None = None) -> FastAPI:
    """Build an application with replaceable settings for isolated tests."""

    ai_service_settings = settings or get_ai_service_settings()

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        generation_job_repository = GenerationJobRepository(
            ai_service_settings.jobs_database_path,
        )
        generation_job_repository.initialize_database()

        # Initialize reference ingestion.
        reference_repository = ReferenceRepository(
            ai_service_settings.jobs_database_path,
        )
        reference_repository.initialize_tables()
        
        module_generator, ecoapi_client = _build_module_generator(ai_service_settings)
        
        # Initialize embedding service and RAG.
        embedding_service = EmbeddingService()
        rag_service = RagService(
            reference_repository=reference_repository, 
            embedding_service=embedding_service,
        )
        
        reference_ingestion_service = ReferenceIngestionService(
            reference_repository=reference_repository,
            storage_directory=ai_service_settings.reference_storage_path,
            rag_service=rag_service,
            max_file_size_bytes=ai_service_settings.reference_max_file_size_bytes,
            min_image_dimension=ai_service_settings.reference_min_image_dimension,
        )
        application.state.reference_repository = reference_repository
        application.state.reference_ingestion_service = reference_ingestion_service
        application.state.rag_service = rag_service


        # Guardrails Service
        guardrails_service = GuardrailsService()

        # Presentation Generator
        presentation_generator = PresentationGenerator(
            upload_dir=ai_service_settings.reference_storage_path.parent / "uploads" if ai_service_settings.reference_storage_path else "../../uploads",
            ecoapi_client=ecoapi_client
        )

        # Start background worker.
        generation_worker = GenerationWorker(
            generation_job_repository=generation_job_repository,
            module_generator=module_generator,
            guardrails_service=guardrails_service,
            presentation_generator=presentation_generator,
            poll_interval_seconds=ai_service_settings.worker_poll_interval_seconds,
            rag_service=rag_service,
        )
        application.state.generation_job_repository = generation_job_repository
        generation_worker.start()
        try:
            yield
        finally:
            generation_worker.stop()
            if ecoapi_client is not None:
                ecoapi_client.close()

    application = FastAPI(
        title=ai_service_settings.app_name,
        version="0.4.0",
        description="AI generation service for the Lumen LMS.",
        lifespan=lifespan,
    )
    application.state.ai_service_settings = ai_service_settings
    application.include_router(generation_router)
    application.include_router(references_router)
    
    upload_dir = ai_service_settings.reference_storage_path.parent / "uploads" if ai_service_settings.reference_storage_path else Path("../../uploads").resolve()
    upload_dir.mkdir(parents=True, exist_ok=True)
    application.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

    @application.get("/health", tags=["system"])
    def health_check() -> dict[str, str]:
        """Report whether the service has started successfully."""

        return {
            "status": "ok",
            "service": ai_service_settings.app_name,
            "environment": ai_service_settings.environment,
        }

    return application


app = create_app()
