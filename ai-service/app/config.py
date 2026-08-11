"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AiServiceSettings(BaseSettings):
    """Runtime settings for the AI service.

    The ``AI_SERVICE_`` prefix keeps these variables separate from the
    existing LMS configuration.
    """

    app_name: str = "Lumen AI Service"
    environment: str = "development"
    jobs_database_path: Path = Path("ai_jobs.db")
    worker_poll_interval_seconds: float = Field(default=0.2, gt=0, le=5)
    fake_generation_delay_seconds: float = Field(default=0.15, ge=0, le=5)
    use_real_module_generator: bool = True
    
    # Ollama Local LLM Configuration (NO API KEY NEEDED)
    ollama_model: str = "qwen3.6:27b"
    ollama_request_timeout_seconds: float = Field(default=300, gt=0, le=600)
    
    reference_storage_path: Path = Path("reference_files")
    reference_max_file_size_bytes: int = Field(default=25 * 1024 * 1024, gt=0)
    reference_min_image_dimension: int = Field(default=100, ge=1)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="AI_SERVICE_",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_environment(self) -> "AiServiceSettings":
        """Ensure production environment has proper configuration."""

        if self.environment.lower() == "production":
            # In production, ensure we have a unique model name if needed
            # No API key validation needed for local Ollama
            pass
        return self


@lru_cache
def get_ai_service_settings() -> AiServiceSettings:
    """Load settings once and reuse them for the lifetime of the process."""

    return AiServiceSettings()
