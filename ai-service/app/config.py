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
    use_real_module_generator: bool = False
    
    # Qwen Model Configuration (Local via Ollama - NO API KEY NEEDED)
    qwen_model: str = "qwen3.6:27b"
    qwen_request_timeout_seconds: float = Field(default=120, gt=0, le=600)
    
    internal_api_key: SecretStr = SecretStr(
        "local-development-internal-key-change-before-production",
    )
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
    def reject_development_key_in_production(self) -> "AiServiceSettings":
        """Prevent production from starting with the documented local-only key."""

        if (
            self.environment.lower() == "production"
            and self.internal_api_key.get_secret_value()
            == "local-development-internal-key-change-before-production"
        ):
            raise ValueError("A unique internal API key is required in production.")
        return self


@lru_cache
def get_ai_service_settings() -> AiServiceSettings:
    """Load settings once and reuse them for the lifetime of the process."""

    return AiServiceSettings()
