from fastapi import APIRouter

from app.dependencies import MongoServiceDep
from app.schemas import CreateIndexRequest, IndexInfo, CollectionStats
from app.schemas.common import CollectionInfo, CreateCollectionRequest, FieldInfo

router = APIRouter(prefix="/api")


@router.get("/collections", response_model=list[CollectionInfo])
async def list_collections(service: MongoServiceDep) -> list[CollectionInfo]:
    return await service.list_collections()


@router.post("/collections", status_code=201, response_model=CollectionInfo)
async def create_collection(
    payload: CreateCollectionRequest, service: MongoServiceDep
) -> CollectionInfo:
    await service.create_collection(payload.name)
    return CollectionInfo(name=payload.name, count=0)


@router.delete("/collections/{name}", status_code=204)
async def drop_collection(name: str, service: MongoServiceDep) -> None:
    await service.drop_collection(name)


@router.get("/collections/{name}/indexes", response_model=list[IndexInfo])
async def list_indexes(name: str, service: MongoServiceDep) -> list[IndexInfo]:
    return await service.list_indexes(name)


@router.post("/collections/{name}/indexes", status_code=201)
async def create_index(
    name: str, payload: CreateIndexRequest, service: MongoServiceDep
) -> dict[str, str]:
    index_name = await service.create_index(
        collection=name, keys=payload.keys, options=payload.options
    )
    return {"name": index_name}


@router.delete("/collections/{name}/indexes/{index_name}", status_code=204)
async def drop_index(name: str, index_name: str, service: MongoServiceDep) -> None:
    await service.drop_index(collection=name, index_name=index_name)


@router.get("/collections/{name}/fields", response_model=list[FieldInfo])
async def get_fields(name: str, service: MongoServiceDep) -> list[FieldInfo]:
    return await service.infer_fields(name)


@router.get("/collections/{name}/stats", response_model=CollectionStats)
async def get_collection_stats(name: str, service: MongoServiceDep) -> CollectionStats:
    return await service.collection_stats(name)
