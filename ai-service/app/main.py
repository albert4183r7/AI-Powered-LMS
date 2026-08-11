"""FastAPI application entry point and dependency lifecycle."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.generations import generation_router
from app.api.references import references_router
from app.api.data_sources import router as data_sources_router
from app.config import AiServiceSettings, get_ai_service_settings
from app.ingestion.reference_ingestion_service import ReferenceIngestionService
from app.ingestion.reference_repository import ReferenceRepository
from app.jobs.repository import GenerationJobRepository
from app.jobs.worker import GenerationWorker
from app.providers.qwen import QwenClient
from app.services.embedding_service import EmbeddingService
from app.services.fake_module_generator import FakeModuleGenerator
from app.services.module_generator import ModuleGenerator
from app.services.ecoapi_module_generator import QwenModuleGenerator
from app.services.rag_service import RagService
from app.services.web_search_service import WebSearchService

LOGGER = logging.getLogger(__name__)


def _build_module_generator(
    ai_service_settings: AiServiceSettings,
) -> tuple[ModuleGenerator, QwenClient | None]:
    """Select the real or fake generator based on configuration.

    Returns the generator and an optional QwenClient that must be closed
    on shutdown when the real generator is active.
    """

    if ai_service_settings.use_real_module_generator:
        # Use local Qwen model via Ollama (no API key needed)
        qwen_client = QwenClient(
            model=ai_service_settings.qwen_model,
            timeout_seconds=ai_service_settings.qwen_request_timeout_seconds,
        )
        LOGGER.info("Module generator: QwenModuleGenerator (local Ollama provider).")
        return QwenModuleGenerator(qwen_client=qwen_client), qwen_client

    LOGGER.info("Module generator: FakeModuleGenerator (no provider calls).")
    return FakeModuleGenerator(
        step_delay_seconds=ai_service_settings.fake_generation_delay_seconds,
    ), None


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
        
        # Initialize embedding service and RAG.
        embedding_service = EmbeddingService()
        web_search_service = WebSearchService()
        rag_service = RagService(
            reference_repository=reference_repository, 
            embedding_service=embedding_service,
            web_search_service=web_search_service
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

        module_generator, qwen_client = _build_module_generator(ai_service_settings)

        generation_worker = GenerationWorker(
            generation_job_repository=generation_job_repository,
            module_generator=module_generator,
            poll_interval_seconds=ai_service_settings.worker_poll_interval_seconds,
        )
        application.state.generation_job_repository = generation_job_repository
        generation_worker.start()
        try:
            yield
        finally:
            generation_worker.stop()
            if qwen_client is not None:
                qwen_client.close()

    application = FastAPI(
        title=ai_service_settings.app_name,
        version="0.4.0",
        description="AI generation service for the Lumen LMS.",
        lifespan=lifespan,
    )
    application.state.ai_service_settings = ai_service_settings
    application.include_router(generation_router)
    application.include_router(references_router)
    application.include_router(data_sources_router)

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
