"""Эндпоинт массовой загрузки результатов сканирования, сгруппированных по доменам."""
from fastapi import APIRouter, Depends

from app.dependencies import get_import_service
from app.schemas.imports import ImportPayload, ImportSummary
from app.services.import_service import ImportService

router = APIRouter(prefix="/api")


@router.post("/collections/{name}/import", response_model=ImportSummary, status_code=201)
def import_documents(
    name: str, payload: ImportPayload, service: ImportService = Depends(get_import_service)
) -> ImportSummary:
    """Фильтрует и загружает результаты сканирования доменов в коллекцию."""
    return service.import_records(name, payload)
