from typing import Annotated, Any

from fastapi import APIRouter, Query

from app.dependencies import MongoServiceDep
from app.schemas.common import DocumentsPage, DocumentsPagination, FilterField
from app.schemas.query import AggregateRequest, SchemaAnalyzeRequest
from app.services.query_safety import parse_json_object

router = APIRouter(prefix="/api")


@router.get("/collections/{name}/filters", response_model=list[FilterField])
def get_filter_fields(name: str, service: MongoServiceDep) -> list[FilterField]:
    return service.list_filter_fields(name)


@router.get("/collections/{name}/documents", response_model=DocumentsPage)
def get_documents(
    name: str,
    service: MongoServiceDep,
    filter: Annotated[str, Query()] = "{}",
    project: Annotated[str, Query()] = "{}",
    sort: Annotated[str, Query()] = "{}",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
) -> DocumentsPage:
    query = parse_json_object(filter, "Filter")
    projection = parse_json_object(project, "Project")
    sort_obj = parse_json_object(sort, "Sort")
    skip = (page - 1) * limit
    documents, total = service.find(
        collection=name,
        query=query,
        projection=projection,
        sort=sort_obj,
        skip=skip,
        limit=limit,
    )
    pages = max(1, -(-total // limit))
    return DocumentsPage(
        documents=documents,
        pagination=DocumentsPagination(
            total=total, pages=pages, page=page, limit=limit
        ),
    )


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
