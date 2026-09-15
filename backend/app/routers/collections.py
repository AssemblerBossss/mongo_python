from fastapi import APIRouter

from app.dependencies import MongoServiceDep
from app.schemas.common import CollectionInfo, CreateCollectionRequest, FieldInfo

router = APIRouter(prefix="/api")


@router.get("/collections", response_model=list[CollectionInfo])
def list_collections(service: MongoServiceDep) -> list[CollectionInfo]:
    return service.list_collections()


@router.post("/collections", status_code=201, response_model=CollectionInfo)
def create_collection(
    payload: CreateCollectionRequest, service: MongoServiceDep
) -> CollectionInfo:
    service.create_collection(payload.name)
    return CollectionInfo(name=payload.name, count=0)


@router.delete("/collections/{name}", status_code=204)
def drop_collection(name: str, service: MongoServiceDep) -> None:
    service.drop_collection(name)


@router.get("/collections/{name}/fields", response_model=list[FieldInfo])
def get_fields(name: str, service: MongoServiceDep) -> list[FieldInfo]:
    return service.infer_fields(name)
