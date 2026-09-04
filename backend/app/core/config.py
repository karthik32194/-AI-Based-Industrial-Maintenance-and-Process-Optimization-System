"""
Application configuration using Pydantic Settings.
All values are loaded from environment variables or .env file.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "AI Maintenance & Optimization System"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "development"

    # API
    api_prefix: str = "/api"
    secret_key: str = "changeme-use-a-strong-secret-key-in-production"
    access_token_expire_minutes: int = 60
    algorithm: str = "HS256"

    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/ai_maintenance_db"

    # OpenAI / LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # RAG
    rag_chunk_size: int = 512
    rag_chunk_overlap: int = 64
    rag_top_k: int = 5

    # ML
    ml_model_path: str = "models/"
    ml_anomaly_contamination: float = 0.1

    # Logging
    log_level: str = "INFO"
    log_format: str = "json"


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


settings = get_settings()
