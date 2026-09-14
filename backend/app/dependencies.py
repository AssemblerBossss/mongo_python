"""DI-зависимости FastAPI."""
from fastapi import Depends
from pymongo.database import Database

from app.config import Settings, get_settings
from app.database import get_database
from app.repositories.mongo_repository import MongoRepository
from app.services.import_service import ImportService
from app.services.mongo_service import MongoService


def get_settings_dep() -> Settings:
    """Зависимость для получения настроек приложения."""
    return get_settings()


def get_db(settings: Settings = Depends(get_settings_dep)) -> Database:
    """Зависимость для получения объекта базы данных."""
    return get_database()


def get_mongo_repository(db: Database = Depends(get_db)) -> MongoRepository:
    """Зависимость для получения репозитория MongoDB."""
    return MongoRepository(db)


def get_mongo_service(repo: MongoRepository = Depends(get_mongo_repository)) -> MongoService:
    """Зависимость для получения сервисного слоя MongoService."""
    return MongoService(repo)


def get_import_service(repo: MongoRepository = Depends(get_mongo_repository)) -> ImportService:
    """Зависимость для получения сервисного слоя ImportService."""
    return ImportService(repo)
