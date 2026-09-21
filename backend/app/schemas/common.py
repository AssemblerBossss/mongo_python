from typing import Any, Literal

from pydantic import BaseModel, Field


class CollectionInfo(BaseModel):
    """Информация о коллекции."""

    name: str
    count: int


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
    address_type: Literal["ip", "mac", "domain", "base_station"] | None = None


class CreateCollectionRequest(BaseModel):
    """Тело запроса на создание коллекции."""

    name: str = Field(min_length=1)


class ErrorResponse(BaseModel):
    """Единый формат ошибки API."""

    detail: str
    request_id: str | None = None


class IndexInfo(BaseModel):
    """Информация об индексе коллекции."""

    name: str
    key: dict[str, Any]
    unique: bool
    sparse: bool = False
    expireAfterSeconds: int | None = None


class CreateIndexRequest(BaseModel):
    keys: dict[str, int] = Field(min_length=1)
    options: dict[str, Any] = Field(default_factory=dict)


class CollectionStats(BaseModel):
    """Ключевые метрики коллекции"""

    count: int
    size: int
    avgObjSize: int = 0
    storageSize: int
    totalIndexSize: int
    totalSize: int
    nindexes: int
    capped: bool = False
    sharded: bool = False  # приходит только в шардированном кластере
    numOrphanDocs: int = 0  # приходит только в шардированном кластере
    indexSizes: dict[str, int] = Field(default_factory=dict)
