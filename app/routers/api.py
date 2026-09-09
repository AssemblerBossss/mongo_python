"""REST API: тонкие ручки, вся логика — в MongoService."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_service
from app.services.mongo_service import (
    CollectionExistsError,
    DocumentNotFoundError,
    InvalidObjectIdError,
    MongoService,
)

router = APIRouter(prefix="/api")


# ---------- Коллекции ----------

@router.get("/collections")
def list_collections(service: MongoService = Depends(get_service)):
    return service.list_collections()


@router.post("/collections", status_code=201)
def create_collection(payload: dict, service: MongoService = Depends(get_service)):
    name = str(payload.get("name", "")).strip()
    if not name:
        raise HTTPException(400, "Укажите имя коллекции")
    try:
        service.create_collection(name)
    except CollectionExistsError as e:
        raise HTTPException(409, str(e))
    return {"name": name}


@router.delete("/collections/{name}", status_code=204)
def drop_collection(name: str, service: MongoService = Depends(get_service)):
    try:
        service.drop_collection(name)
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/collections/{name}/fields")
def get_fields(name: str, service: MongoService = Depends(get_service)):
    return service.get_sample_fields(name)


# ---------- Документы ----------

@router.get("/collections/{name}/documents")
def get_documents(
    name: str,
    filter: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    sort_by: str = Query("_id"),
    sort_dir: int = Query(1),
    service: MongoService = Depends(get_service),
):
    query = {}
    if filter:
        try:
            query = json.loads(filter)
        except json.JSONDecodeError:
            raise HTTPException(400, "Некорректный JSON в параметре filter")
        if not isinstance(query, dict):
            raise HTTPException(400, "filter должен быть JSON-объектом")
    documents, total = service.get_documents(name, query, skip, limit, sort_by, sort_dir)
    return {"items": documents, "total": total, "skip": skip, "limit": limit}


@router.post("/collections/{name}/documents", status_code=201)
def create_document(name: str, data: dict, service: MongoService = Depends(get_service)):
    return service.create_document(name, data)


@router.get("/collections/{name}/documents/{doc_id}")
def get_document(name: str, doc_id: str, service: MongoService = Depends(get_service)):
    try:
        return service.get_document(name, doc_id)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.put("/collections/{name}/documents/{doc_id}")
def update_document(name: str, doc_id: str, data: dict, service: MongoService = Depends(get_service)):
    try:
        return service.update_document(name, doc_id, data)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))


@router.delete("/collections/{name}/documents/{doc_id}", status_code=204)
def delete_document(name: str, doc_id: str, service: MongoService = Depends(get_service)):
    try:
        service.delete_document(name, doc_id)
    except InvalidObjectIdError as e:
        raise HTTPException(400, str(e))
    except DocumentNotFoundError as e:
        raise HTTPException(404, str(e))
