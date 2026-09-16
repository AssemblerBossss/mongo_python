import json
from typing import Annotated, Any

from fastapi import APIRouter, Query, HTTPException
from pydantic import TypeAdapter, ValidationError

from app.dependencies import MongoServiceDep
from app.errors import InvalidFilterError
from app.schemas.common import DocumentsPage, FilterCondition, FilterField
from app.schemas.query import AggregateRequest, SchemaAnalyzeRequest
from app.services.filters import build_mongo_query

router = APIRouter(prefix="/api")

_conditions_adapter = TypeAdapter(list[FilterCondition])


@router.get("/collections/{name}/filters", response_model=list[FilterField])
def get_filter_fields(name: str, service: MongoServiceDep) -> list[FilterField]:
    return service.list_filter_fields(name)


@router.get("/collections/{name}/documents", response_model=DocumentsPage)
def get_documents(
    name: str,
    service: MongoServiceDep,
    conditions: Annotated[str | None, Query()] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
    sort_by: Annotated[str, Query()] = "_id",
    sort_dir: Annotated[int, Query()] = 1,
) -> DocumentsPage:
    query: dict[str, Any] = {}
    if conditions:
        try:
            parsed = _conditions_adapter.validate_json(conditions)
        except ValidationError as exc:
            raise InvalidFilterError(f"Некорректные условия фильтра: {exc}") from exc
        query = build_mongo_query(parsed)
    documents, total = service.find(
        collection=name,
        query=query,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return DocumentsPage(items=documents, total=total, skip=skip, limit=limit)


@router.post("/collections/{name}/documents", status_code=201)
def create_document(
    name: str, data: dict[str, Any] | list[dict[str, Any]], service: MongoServiceDep
) -> dict[str, Any]:
    if isinstance(data, list):
        for doc in data:
            service.insert(name, doc)
        return {"success": True, "message": f"Imported {len(data)} document(s)"}
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

@router.post("/collections/{name}/aggregate")
def run_aggregation(
    name: str, payload: AggregateRequest, service: MongoServiceDep
) -> dict[str, Any]:
    return service.run_aggregation(name, payload.pipeline, payload.limit)


@router.post("/collections/{name}/schema")
def analyze_schema(
    name: str, payload: SchemaAnalyzeRequest, service: MongoServiceDep
) -> dict[str, Any]:
    return service.analyze_schema(name, payload.sampleSize)
