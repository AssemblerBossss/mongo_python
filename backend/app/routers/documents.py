import asyncio
import re
from typing import Annotated, Any

from fastapi import APIRouter, Query

from app.dependencies import MongoServiceDep
from app.schemas.common import DocumentsPage, DocumentsPagination
from app.services.address_classifier import classify_address, normalize_address
from app.services.import_service import ADDRESS_FIELD
from app.services.query_safety import parse_json_object

router = APIRouter(prefix="/api")


@router.get("/collections/{name}/documents", response_model=DocumentsPage)
async def get_documents(
    name: str,
    service: MongoServiceDep,
    filter: Annotated[str, Query()] = "{}",
    project: Annotated[str, Query()] = "{}",
    sort: Annotated[str, Query()] = "{}",
    address: Annotated[str | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
) -> DocumentsPage:
    address_type: str | None = None
    if address is not None and address.strip():
        address = normalize_address(address)
        address_type = classify_address(address)
        query = {ADDRESS_FIELD: {"$regex": re.escape(address), "$options": "i"}}
    else:
        query = parse_json_object(filter, "Filter")
    projection = parse_json_object(project, "Project")
    sort_obj = parse_json_object(sort, "Sort")
    skip = (page - 1) * limit
    documents, total = await service.find(
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
        address_type=address_type,
        pagination=DocumentsPagination(
            total=total, pages=pages, page=page, limit=limit
        ),
    )


@router.post("/collections/{name}/documents", status_code=201)
async def create_document(
    name: str, data: dict[str, Any] | list[dict[str, Any]], service: MongoServiceDep
) -> dict[str, Any]:
    if isinstance(data, list):
        await asyncio.gather(*(service.insert(name, doc) for doc in data))
        return {"success": True, "message": f"Imported {len(data)} document(s)"}
    return await service.insert(name, data)


@router.get("/collections/{name}/documents/{doc_id}")
async def get_document(
    name: str, doc_id: str, service: MongoServiceDep
) -> dict[str, Any]:
    return await service.get(name, doc_id)


@router.patch("/collections/{name}/documents/{doc_id}")
async def patch_document(
    name: str, doc_id: str, data: dict[str, Any], service: MongoServiceDep
) -> dict[str, Any]:
    return await service.patch(collection=name, doc_id=doc_id, data=data)


@router.delete("/collections/{name}/documents/{doc_id}", status_code=204)
async def delete_document(name: str, doc_id: str, service: MongoServiceDep) -> None:
    await service.delete(collection=name, doc_id=doc_id)
