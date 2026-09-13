"""Универсальные эндпоинты работы с коллекциями."""
from fastapi import APIRouter, Depends

from app.dependencies import get_mongo_service
from app.schemas.common import CollectionInfo, CreateCollectionRequest, FieldInfo
from app.services.mongo_service import MongoService

router = APIRouter(prefix="/api")


@router.get("/collections", response_model=list[CollectionInfo])
def list_collections(service: MongoService = Depends(get_mongo_service)) -> list[CollectionInfo]:
    """Возвращает список коллекций с количеством документов."""
    return service.list_collections()


@router.post("/collections", status_code=201, response_model=CollectionInfo)
def create_collection(
    payload: CreateCollectionRequest, service: MongoService = Depends(get_mongo_service)
) -> CollectionInfo:
    """Создаёт новую коллекцию."""
    service.create_collection(payload.name)
    return CollectionInfo(name=payload.name, count=0)


@router.delete("/collections/{name}", status_code=204)
def drop_collection(name: str, service: MongoService = Depends(get_mongo_service)) -> None:
    """Удаляет коллекцию."""
    service.drop_collection(name)


@router.get("/collections/{name}/fields", response_model=list[FieldInfo])
def get_fields(name: str, service: MongoService = Depends(get_mongo_service)) -> list[FieldInfo]:
    """Возвращает список полей коллекции, выведенный по выборке документов."""
    return service.infer_fields(name)
