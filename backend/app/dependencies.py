from typing import Annotated

from fastapi import Depends
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.config import Settings, get_settings
from app.database import get_database, get_mongo_client
from app.repositories.mongo_repository import MongoRepository
from app.services.import_service import ImportService
from app.services.mongo_service import MongoService


def get_settings_dep() -> Settings:
    return get_settings()


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]


def get_db(settings: SettingsDep) -> AsyncDatabase:
    return get_database()


DatabaseDep = Annotated[AsyncDatabase, Depends(get_db)]

MongoClientDep = Annotated[AsyncMongoClient, Depends(get_mongo_client)]


def get_mongo_repository(db: DatabaseDep) -> MongoRepository:
    return MongoRepository(db)


MongoRepositoryDep = Annotated[MongoRepository, Depends(get_mongo_repository)]


def get_mongo_service(repo: MongoRepositoryDep) -> MongoService:
    return MongoService(repo)


MongoServiceDep = Annotated[MongoService, Depends(get_mongo_service)]


def get_import_service(repo: MongoRepositoryDep) -> ImportService:
    return ImportService(repo)


ImportServiceDep = Annotated[ImportService, Depends(get_import_service)]
