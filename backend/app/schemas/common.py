from typing import Any, Literal

from pydantic import BaseModel, Field


class CollectionInfo(BaseModel):
    """Информация о коллекции."""

    name: str
    count: int


class FieldInfo(BaseModel):
    """Информация о поле документа, выведенная по выборке данных."""

    name: str
    types: list[str]


class DocumentsPagination(BaseModel):
    """Метаданные пагинации для страницы документов."""

    total: int
    pages: int
    page: int
    limit: int


class DocumentsPage(BaseModel):
    """Страница документов с пагинацией."""

    documents: list[dict[str, Any]]
    pagination: DocumentsPagination


class CreateCollectionRequest(BaseModel):
    """Тело запроса на создание коллекции."""

    name: str = Field(min_length=1)


class ErrorResponse(BaseModel):
    """Единый формат ошибки API."""

    detail: str
    request_id: str | None = None


FilterOperator = Literal[
    "eq", "ne", "in", "contains", "exists", "gt", "gte", "lt", "lte", "between"
]


class FilterCondition(BaseModel):
    """Одно условие фильтра: поле (dot-path) + оператор + значение."""

    field: str
    operator: FilterOperator
    value: Any


class FilterField(BaseModel):
    """Описание одного поля, доступного для фильтра, для построения UI."""

    field: str
    types: list[str]
    operators: list[FilterOperator]
    enumerable: bool
    values: list[Any] | None = None
