"""Точка входа к БД для REST API.

Подключение к MongoDB не переизобретается — используется учебный класс
MongoDBConnection из python_project/database.py. Сервисный слой (MongoService)
строится на его методах (get_collection, find, count, insert_many), в точности
как это делают solution.py и examples.py.
"""
from functools import lru_cache

from python_project.database import MongoDBConnection

from app.config import settings
from app.services.mongo_service import MongoService


@lru_cache
def get_connection() -> MongoDBConnection:
    connection = MongoDBConnection(
        host=settings.mongo_host,
        port=settings.mongo_port,
        username=settings.mongo_username,
        password=settings.mongo_password,
        db_name=settings.mongo_db,
    )
    connection.connect()
    return connection


def get_service() -> MongoService:
    return MongoService(get_connection())
