from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.schemas.common import ErrorResponse

logger = logging.getLogger(__name__)


class DocumentNotFoundError(Exception):
    """Документ или коллекция не найдены."""


class CollectionNotFoundError(DocumentNotFoundError):
    """Коллекция не найдена (специализация DocumentNotFoundError)."""


class InvalidObjectIdError(Exception):
    """Некорректный формат идентификатора документа."""


class CollectionExistsError(Exception):
    """Коллекция с таким именем уже существует."""


class EmptyImportPayloadError(Exception):
    """После фильтрации не осталось ни одной записи для импорта."""


class InvalidImportFileError(Exception):
    """Загруженный файл не является валидным JSON со списком результатов сканирования."""


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(InvalidObjectIdError)
    async def handle_invalid_object_id(request: Request, exc: InvalidObjectIdError) -> JSONResponse:
        return _error_response(request, 400, str(exc))

    @app.exception_handler(CollectionExistsError)
    async def handle_collection_exists(request: Request, exc: CollectionExistsError) -> JSONResponse:
        return _error_response(request, 409, str(exc))

    @app.exception_handler(EmptyImportPayloadError)
    async def handle_empty_import(request: Request, exc: EmptyImportPayloadError) -> JSONResponse:
        return _error_response(request, 400, str(exc))

    @app.exception_handler(InvalidImportFileError)
    async def handle_invalid_import_file(request: Request, exc: InvalidImportFileError) -> JSONResponse:
        return _error_response(request, 400, str(exc))

    @app.exception_handler(DocumentNotFoundError)
    async def handle_not_found(request: Request, exc: DocumentNotFoundError) -> JSONResponse:
        return _error_response(request, 404, str(exc))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Необработанное исключение", exc_info=exc)
        return _error_response(request, 500, "Внутренняя ошибка сервера")


def _error_response(request: Request, status_code: int, detail: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    body = ErrorResponse(detail=detail, request_id=request_id)
    return JSONResponse(status_code=status_code, content=body.model_dump())
