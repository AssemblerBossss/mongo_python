from typing import Any

from pydantic import BaseModel, Field


class CollectionInfo(BaseModel):
    """Информация о коллекции."""

    name: str
    count: int


class FieldInfo(BaseModel):
    """Информация о поле документа, выведенная по выборке данных."""

    name: str
    types: list[str]


class DocumentsPage(BaseModel):
    """Страница документов с пагинацией."""

    items: list[dict[str, Any]]
    total: int
    skip: int
    limit: int


class CreateCollectionRequest(BaseModel):
    """Тело запроса на создание коллекции."""

    name: str = Field(min_length=1)


class ErrorResponse(BaseModel):
    """Единый формат ошибки API."""

    detail: str
    request_id: str | None = None
