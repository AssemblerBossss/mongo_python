import json
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query

from app.dependencies import MongoServiceDep
from app.schemas.common import DocumentsPage

router = APIRouter(prefix="/api")


@router.get("/collections/{name}/documents", response_model=DocumentsPage)
def get_documents(
    name: str,
    service: MongoServiceDep,
    filter: Annotated[str | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
    sort_by: Annotated[str, Query()] = "_id",
    sort_dir: Annotated[int, Query()] = 1,
) -> DocumentsPage:
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
def create_document(name: str, data: dict[str, Any], service: MongoServiceDep) -> dict[str, Any]:
    return service.insert(name, data)


@router.get("/collections/{name}/documents/{doc_id}")
def get_document(name: str, doc_id: str, service: MongoServiceDep) -> dict[str, Any]:
    return service.get(name, doc_id)


@router.put("/collections/{name}/documents/{doc_id}")
def replace_document(
    name: str, doc_id: str, data: dict[str, Any], service: MongoServiceDep
) -> dict[str, Any]:
    return service.replace(name, doc_id, data)


@router.patch("/collections/{name}/documents/{doc_id}")
def patch_document(
    name: str, doc_id: str, data: dict[str, Any], service: MongoServiceDep
) -> dict[str, Any]:
    return service.patch(name, doc_id, data)


@router.delete("/collections/{name}/documents/{doc_id}", status_code=204)
def delete_document(name: str, doc_id: str, service: MongoServiceDep) -> None:
    service.delete(name, doc_id)
