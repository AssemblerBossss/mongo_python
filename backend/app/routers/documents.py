"""Универсальные эндпоинты работы с документами произвольной коллекции."""
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_mongo_service
from app.schemas.common import DocumentsPage
from app.services.mongo_service import MongoService

router = APIRouter(prefix="/api")


@router.get("/collections/{name}/documents", response_model=DocumentsPage)
def get_documents(
    name: str,
    filter: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    sort_by: str = Query("_id"),
    sort_dir: int = Query(1),
    service: MongoService = Depends(get_mongo_service),
) -> DocumentsPage:
    """Возвращает страницу документов коллекции с фильтром, сортировкой и пагинацией."""
    query: dict[str, Any] = {}
    if filter:
        try:
            query = json.loads(filter)
        except json.JSONDecodeError:
            raise HTTPException(400, "Некорректный JSON в параметре filter")
        if not isinstance(query, dict):
            raise HTTPException(400, "filter должен быть JSON-объектом")
    documents, total = service.find(name, query, skip, limit, sort_by, sort_dir)
    return DocumentsPage(items=documents, total=total, skip=skip, limit=limit)


@router.post("/collections/{name}/documents", status_code=201)
def create_document(
    name: str, data: dict[str, Any], service: MongoService = Depends(get_mongo_service)
) -> dict[str, Any]:
    """Создаёт новый документ в коллекции."""
    return service.insert(name, data)


@router.get("/collections/{name}/documents/{doc_id}")
def get_document(
    name: str, doc_id: str, service: MongoService = Depends(get_mongo_service)
) -> dict[str, Any]:
    """Возвращает документ по идентификатору."""
    return service.get(name, doc_id)


@router.put("/collections/{name}/documents/{doc_id}")
def replace_document(
    name: str, doc_id: str, data: dict[str, Any], service: MongoService = Depends(get_mongo_service)
) -> dict[str, Any]:
    """Полностью заменяет документ."""
    return service.replace(name, doc_id, data)


@router.patch("/collections/{name}/documents/{doc_id}")
def patch_document(
    name: str, doc_id: str, data: dict[str, Any], service: MongoService = Depends(get_mongo_service)
) -> dict[str, Any]:
    """Частично обновляет документ через $set."""
    return service.patch(name, doc_id, data)


@router.delete("/collections/{name}/documents/{doc_id}", status_code=204)
def delete_document(
    name: str, doc_id: str, service: MongoService = Depends(get_mongo_service)
) -> None:
    """Удаляет документ."""
    service.delete(name, doc_id)
