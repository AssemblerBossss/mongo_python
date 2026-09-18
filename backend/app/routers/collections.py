from typing import Any

from fastapi import APIRouter

from app.dependencies import MongoServiceDep
from app.schemas import CreateIndexRequest, IndexInfo
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


@router.get("/collections/{name}/indexes", response_model=list[IndexInfo])
def list_indexes(name: str, service: MongoServiceDep) -> list[IndexInfo]:
    return service.list_indexes(name)


@router.post("/collections/{name}/indexes", status_code=201)
def create_index(
    name: str, payload: CreateIndexRequest, service: MongoServiceDep
) -> dict[str, str]:
    index_name = service.create_index(
        collection=name, keys=payload.keys, options=payload.options
    )
    return {"name": index_name}


@router.delete("/collections/{name}/indexes/{index_name}", status_code=204)
def drop_index(name: str, index_name: str, service: MongoServiceDep) -> None:
    service.drop_index(collection=name, index_name=index_name)


@router.get("/collections/{name}/fields", response_model=list[FieldInfo])
def get_fields(name: str, service: MongoServiceDep) -> list[FieldInfo]:
    return service.infer_fields(name)


@router.get("/collections/{name}/stats")
def get_collection_stats(name: str, service: MongoServiceDep) -> dict[str, Any]:
    return {"stats": service.collection_stats(name)}
