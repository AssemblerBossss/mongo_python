"""DI-зависимости FastAPI."""
from fastapi import Depends
from pymongo.database import Database

from app.config import Settings, get_settings
from app.database import get_database
from app.services.mongo_service import MongoService


def get_settings_dep() -> Settings:
    """Зависимость для получения настроек приложения."""
    return get_settings()


def get_db(settings: Settings = Depends(get_settings_dep)) -> Database:
    """Зависимость для получения объекта базы данных."""
    return get_database()


def get_mongo_service(db: Database = Depends(get_db)) -> MongoService:
    """Зависимость для получения сервисного слоя MongoService."""
    return MongoService(db)
