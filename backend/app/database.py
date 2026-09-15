from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.config import get_settings


def _build_connection_string(settings) -> str:
    """Строит connection string с учётом наличия учётных данных."""
    if settings.mongo_username and settings.mongo_password:
        return (
            f"mongodb://{settings.mongo_username}:{settings.mongo_password}"
            f"@{settings.mongo_host}:{settings.mongo_port}/{settings.mongo_db}"
            f"?authSource={settings.mongo_auth_source}"
        )
    return f"mongodb://{settings.mongo_host}:{settings.mongo_port}/{settings.mongo_db}"


@lru_cache
def get_mongo_client() -> MongoClient:
    settings = get_settings()
    return MongoClient(_build_connection_string(settings), serverSelectionTimeoutMS=5000)


def get_database() -> Database:
    settings = get_settings()
    return get_mongo_client()[settings.mongo_db]


def ping(client: MongoClient) -> bool:
    """Проверяет доступность MongoDB (используется в /ready)."""
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False
