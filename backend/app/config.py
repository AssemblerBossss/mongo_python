"""Конфигурация приложения через переменные окружения."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения. Читаются из ENV с префиксом APP_ и файла .env."""

    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    mongo_host: str = "localhost"
    mongo_port: int = 27017
    mongo_username: str = "admin"
    mongo_password: str = "admin"
    mongo_db: str = "datasets"
    mongo_auth_source: str = "admin"

    cors_allow_origins: list[str] = ["http://localhost:5173"]

    log_level: str = "INFO"
    environment: str = "local"


@lru_cache
def get_settings() -> Settings:
    """Возвращает закэшированный экземпляр настроек."""
    return Settings()
