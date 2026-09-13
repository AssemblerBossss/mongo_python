# Каркас MongoDB Admin: полный код по файлам

Ниже — готовый код для каждого файла итоговой структуры. Файлы проекта (backend/,
frontend/, scripts/) НЕ изменены — весь код собран здесь, применить его в реальные
файлы нужно вручную (скопировать содержимое блока в файл по указанному пути).

Структура каталогов уже создана заранее (см. предыдущую версию плана / `git status`).

---

## 1. Краткий план

- Backend: FastAPI + PyMongo, DI через `Depends`, pydantic-settings, глобальный
  обработчик ошибок, request-id логирование, health/ready, универсальный `MongoService`
  без единого упоминания домена, точки расширения (`policy.py`).
- Frontend: Vite + React 18 + TS + React Router + TanStack Query + Tailwind, все таблицы
  и формы строятся по метаданным `/api/collections/{name}/fields`.
- `scripts/`: учебные файлы перенесены как есть, требуется одна правка импорта
  (см. §5) — раньше `database.py` лежал рядом, теперь он называется `mongo_connection.py`.
- API-пути не изменены, добавлен `PATCH /api/collections/{name}/documents/{id}`.

---

## 2. Backend

### `backend/app/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/app/config.py`
```python
"""Конфигурация приложения через переменные окружения."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки приложения. Читаются из ENV с префиксом APP_ и файла .env."""

    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    mongo_host: str = "localhost"
    mongo_port: int = 27017
    mongo_username: str = "admin"
    mongo_password: str = "admin"
    mongo_db: str = "datasets"
    mongo_auth_source: str = "admin"

    cors_allow_origins: list[str] = ["http://localhost:5173"]

    log_level: str = "INFO"
    environment: str = "local"


@lru_cache
def get_settings() -> Settings:
    """Возвращает закэшированный экземпляр настроек."""
    return Settings()
```

### `backend/app/database.py`
```python
"""Подключение к MongoDB через PyMongo (без учебных обёрток)."""
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import PyMongoError

from app.config import get_settings


def _build_connection_string(settings) -> str:
    """Строит connection string с учётом наличия учётных данных."""
    if settings.mongo_username and settings.mongo_password:
        return (
            f"mongodb://{settings.mongo_username}:{settings.mongo_password}"
            f"@{settings.mongo_host}:{settings.mongo_port}/{settings.mongo_db}"
            f"?authSource={settings.mongo_auth_source}"
        )
    return f"mongodb://{settings.mongo_host}:{settings.mongo_port}/{settings.mongo_db}"


@lru_cache
def get_mongo_client() -> MongoClient:
    """Возвращает закэшированный клиент MongoDB."""
    settings = get_settings()
    return MongoClient(_build_connection_string(settings), serverSelectionTimeoutMS=5000)


def get_database() -> Database:
    """Возвращает объект базы данных для работы с коллекциями."""
    settings = get_settings()
    return get_mongo_client()[settings.mongo_db]


def ping(client: MongoClient) -> bool:
    """Проверяет доступность MongoDB (используется в /ready)."""
    try:
        client.admin.command("ping")
        return True
    except PyMongoError:
        return False
```

### `backend/app/errors.py`
```python
"""Доменные исключения и их отображение в HTTP-ответы."""
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


def register_exception_handlers(app: FastAPI) -> None:
    """Регистрирует обработчики доменных исключений на уровне приложения."""

    @app.exception_handler(InvalidObjectIdError)
    async def handle_invalid_object_id(request: Request, exc: InvalidObjectIdError) -> JSONResponse:
        return _error_response(request, 400, str(exc))

    @app.exception_handler(CollectionExistsError)
    async def handle_collection_exists(request: Request, exc: CollectionExistsError) -> JSONResponse:
        return _error_response(request, 409, str(exc))

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
```

### `backend/app/logging_config.py`
```python
"""Настройка логирования и middleware с request-id."""
from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.request")


def setup_logging(level: str = "INFO") -> None:
    """Настраивает базовое логирование приложения."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Прокидывает X-Request-ID через запрос/ответ и логирует параметры запроса."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id

        start = time.monotonic()
        response: Response = await call_next(request)
        duration_ms = round((time.monotonic() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s (%.2f ms) request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response
```

### `backend/app/main.py`
```python
"""Точка входа FastAPI-приложения."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.errors import register_exception_handlers
from app.logging_config import RequestIdMiddleware, setup_logging
from app.routers import collections, documents, health


def create_app() -> FastAPI:
    """Собирает и настраивает FastAPI-приложение."""
    settings = get_settings()
    setup_logging(settings.log_level)

    app = FastAPI(
        title="Mongo Admin API",
        description="Универсальный REST API для администрирования произвольных коллекций MongoDB",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(collections.router)
    app.include_router(documents.router)

    return app


app = create_app()
```

### `backend/app/dependencies.py`
```python
"""DI-зависимости FastAPI."""
from fastapi import Depends
from pymongo.database import Database

from app.config import Settings, get_settings
from app.database import get_database
from app.services.mongo_service import MongoService


def get_settings_dep() -> Settings:
    """Зависимость для получения настроек приложения."""
    return get_settings()


def get_db(settings: Settings = Depends(get_settings_dep)) -> Database:
    """Зависимость для получения объекта базы данных."""
    return get_database()


def get_mongo_service(db: Database = Depends(get_db)) -> MongoService:
    """Зависимость для получения сервисного слоя MongoService."""
    return MongoService(db)
```

### `backend/app/routers/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/app/routers/health.py`
```python
"""Health/readiness-проверки."""
from fastapi import APIRouter, Depends, HTTPException
from pymongo import MongoClient

from app.database import get_mongo_client, ping

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness-проверка: приложение поднято."""
    return {"status": "ok"}


@router.get("/ready")
def ready(client: MongoClient = Depends(get_mongo_client)) -> dict[str, str]:
    """Readiness-проверка: MongoDB доступна."""
    if not ping(client):
        raise HTTPException(status_code=503, detail="MongoDB недоступна")
    return {"status": "ok"}
```

### `backend/app/routers/collections.py`
```python
"""Универсальные эндпоинты работы с коллекциями."""
from fastapi import APIRouter, Depends

from app.dependencies import get_mongo_service
from app.schemas.common import CollectionInfo, CreateCollectionRequest, FieldInfo
from app.services.mongo_service import MongoService

router = APIRouter(prefix="/api")


@router.get("/collections", response_model=list[CollectionInfo])
def list_collections(service: MongoService = Depends(get_mongo_service)) -> list[CollectionInfo]:
    """Возвращает список коллекций с количеством документов."""
    return service.list_collections()


@router.post("/collections", status_code=201, response_model=CollectionInfo)
def create_collection(
    payload: CreateCollectionRequest, service: MongoService = Depends(get_mongo_service)
) -> CollectionInfo:
    """Создаёт новую коллекцию."""
    service.create_collection(payload.name)
    return CollectionInfo(name=payload.name, count=0)


@router.delete("/collections/{name}", status_code=204)
def drop_collection(name: str, service: MongoService = Depends(get_mongo_service)) -> None:
    """Удаляет коллекцию."""
    service.drop_collection(name)


@router.get("/collections/{name}/fields", response_model=list[FieldInfo])
def get_fields(name: str, service: MongoService = Depends(get_mongo_service)) -> list[FieldInfo]:
    """Возвращает список полей коллекции, выведенный по выборке документов."""
    return service.infer_fields(name)
```

### `backend/app/routers/documents.py`
```python
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
```

### `backend/app/services/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/app/services/policy.py`
```python
"""Точки расширения для будущей доменной логики.

Модуль намеренно не содержит доменных правил — только интерфейсы и no-op
реализации по умолчанию. Когда домен станет известен, сюда добавляются
конкретные политики и хуки для нужных коллекций.
"""
from __future__ import annotations

from typing import Any, Protocol


class CollectionPolicy(Protocol):
    """Политика доступа к коллекции."""

    def can_read(self, collection: str) -> bool:
        ...

    def can_write(self, collection: str) -> bool:
        ...

    def can_delete(self, collection: str) -> bool:
        ...


class AllowAllPolicy:
    """Политика по умолчанию — разрешает все операции над любой коллекцией."""

    def can_read(self, collection: str) -> bool:
        return True

    def can_write(self, collection: str) -> bool:
        return True

    def can_delete(self, collection: str) -> bool:
        return True


def before_write(collection: str, data: dict[str, Any]) -> dict[str, Any]:
    """Хук перед записью документа. По умолчанию не изменяет данные."""
    return data


def after_write(collection: str, document: dict[str, Any]) -> dict[str, Any]:
    """Хук после записи документа. По умолчанию не изменяет документ."""
    return document


# Точка расширения: сюда регистрируются политики для конкретных коллекций,
# например KNOWN_COLLECTIONS["users"] = UsersPolicy().
KNOWN_COLLECTIONS: dict[str, CollectionPolicy] = {}
```

### `backend/app/services/mongo_service.py`
```python
"""Обобщённый сервисный слой поверх PyMongo, независимый от домена."""
from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database

from app.errors import CollectionExistsError, DocumentNotFoundError, InvalidObjectIdError
from app.schemas.common import CollectionInfo, FieldInfo
from app.services import policy as policy_module
from app.services.policy import AllowAllPolicy, CollectionPolicy
from app.utils.serialization import serialize_document


class MongoService:
    """Универсальные CRUD-операции над произвольными коллекциями MongoDB."""

    def __init__(self, db: Database, policy: CollectionPolicy | None = None) -> None:
        self.db = db
        self.policy = policy or AllowAllPolicy()

    # ---------- Коллекции ----------

    def list_collections(self) -> list[CollectionInfo]:
        """Возвращает список коллекций с количеством документов в каждой."""
        names = sorted(self.db.list_collection_names())
        return [
            CollectionInfo(name=name, count=self.db[name].count_documents({}))
            for name in names
        ]

    def create_collection(self, name: str) -> None:
        """Создаёт новую коллекцию."""
        if name in self.db.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{name}' уже существует")
        self.db.create_collection(name)

    def drop_collection(self, name: str) -> None:
        """Удаляет коллекцию."""
        if name not in self.db.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")
        self.db.drop_collection(name)

    def infer_fields(self, collection: str, sample_size: int = 25) -> list[FieldInfo]:
        """Определяет набор полей и их типы по выборке документов."""
        fields: dict[str, set[str]] = {}
        cursor = self.db[collection].find().limit(sample_size)
        for doc in cursor:
            for key, value in doc.items():
                fields.setdefault(key, set()).add(type(value).__name__)
        return [FieldInfo(name=name, types=sorted(types)) for name, types in fields.items()]

    # ---------- Документы ----------

    @staticmethod
    def _to_object_id(doc_id: str) -> ObjectId:
        try:
            return ObjectId(doc_id)
        except (InvalidId, TypeError):
            raise InvalidObjectIdError(f"Некорректный идентификатор документа: {doc_id}")

    def find(
        self,
        collection: str,
        query: dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "_id",
        sort_dir: int = 1,
    ) -> tuple[list[dict[str, Any]], int]:
        """Возвращает страницу документов и их общее количество по фильтру."""
        query = query or {}
        col = self.db[collection]
        total = col.count_documents(query)
        cursor = col.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
        documents = [serialize_document(doc) for doc in cursor]
        return documents, total

    def get(self, collection: str, doc_id: str) -> dict[str, Any]:
        """Возвращает документ по идентификатору."""
        object_id = self._to_object_id(doc_id)
        doc = self.db[collection].find_one({"_id": object_id})
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    def insert(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        """Создаёт новый документ."""
        data = policy_module.before_write(collection, dict(data))
        data.pop("_id", None)
        result = self.db[collection].insert_one(data)
        document = self.get(collection, str(result.inserted_id))
        return policy_module.after_write(collection, document)

    def replace(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Полностью заменяет документ (PUT)."""
        object_id = self._to_object_id(doc_id)
        data = policy_module.before_write(collection, dict(data))
        data.pop("_id", None)
        result = self.db[collection].replace_one({"_id": object_id}, data)
        if result.matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        document = self.get(collection, doc_id)
        return policy_module.after_write(collection, document)

    def patch(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        """Частично обновляет документ через $set (PATCH)."""
        object_id = self._to_object_id(doc_id)
        data = policy_module.before_write(collection, dict(data))
        data.pop("_id", None)
        result = self.db[collection].update_one({"_id": object_id}, {"$set": data})
        if result.matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        document = self.get(collection, doc_id)
        return policy_module.after_write(collection, document)

    def delete(self, collection: str, doc_id: str) -> None:
        """Удаляет документ."""
        object_id = self._to_object_id(doc_id)
        result = self.db[collection].delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
```

### `backend/app/schemas/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/app/schemas/common.py`
```python
"""Общие Pydantic-модели, независимые от домена."""
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
```

### `backend/app/utils/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/app/utils/serialization.py`
```python
"""Сериализация значений MongoDB в JSON-совместимые типы."""
from datetime import datetime
from typing import Any

from bson import ObjectId


def serialize_value(value: Any) -> Any:
    """Преобразует значения MongoDB (ObjectId, datetime, ...) в JSON-совместимые."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_value(v) for v in value]
    if isinstance(value, dict):
        return serialize_document(value)
    return value


def serialize_document(doc: dict) -> dict:
    """Сериализует документ целиком."""
    return {key: serialize_value(value) for key, value in doc.items()}
```

---

## 3. Backend: тесты

### `backend/tests/__init__.py`
```python
```
(пустой файл, маркер пакета)

### `backend/tests/conftest.py`
```python
"""Общие фикстуры для тестов backend."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_mongo_service
from app.main import create_app
from app.services.mongo_service import MongoService


@pytest.fixture
def mongo_service_mock() -> MagicMock:
    """Мок сервисного слоя MongoService."""
    return MagicMock(spec=MongoService)


@pytest.fixture
def client(mongo_service_mock: MagicMock) -> TestClient:
    """TestClient с подменённым MongoService."""
    app = create_app()
    app.dependency_overrides[get_mongo_service] = lambda: mongo_service_mock
    return TestClient(app)
```

### `backend/tests/test_health.py`
```python
"""Тесты health/ready эндпоинтов."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.database import get_mongo_client
from app.main import create_app
from app.routers import health as health_router


def test_health_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health_router, "ping", lambda _client: True)
    app = create_app()
    app.dependency_overrides[get_mongo_client] = lambda: MagicMock()
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 200


def test_ready_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health_router, "ping", lambda _client: False)
    app = create_app()
    app.dependency_overrides[get_mongo_client] = lambda: MagicMock()
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 503
```

### `backend/tests/test_collections.py`
```python
"""Smoke-тест списка коллекций (с моком MongoService, без реальной Mongo)."""
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.schemas.common import CollectionInfo


def test_list_collections(client: TestClient, mongo_service_mock: MagicMock) -> None:
    mongo_service_mock.list_collections.return_value = [
        CollectionInfo(name="sample", count=3),
    ]

    response = client.get("/api/collections")

    assert response.status_code == 200
    assert response.json() == [{"name": "sample", "count": 3}]
```

---

## 4. Backend: конфигурация окружения и сборки

### `backend/pyproject.toml`
```toml
[project]
name = "mongo-admin-backend"
version = "0.1.0"
description = "Универсальный REST API для администрирования коллекций MongoDB"
requires-python = ">=3.12"
dependencies = [
    "fastapi==0.115.0",
    "uvicorn[standard]==0.30.6",
    "pymongo==4.6.0",
    "pydantic==2.9.2",
    "pydantic-settings==2.5.2",
]

[project.optional-dependencies]
dev = [
    "pytest==8.3.3",
    "httpx==0.27.2",
    "mypy==1.11.2",
    "ruff==0.6.9",
]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.mypy]
python_version = "3.12"
strict = true

[tool.ruff]
line-length = 100
target-version = "py312"
```
После заполнения удалить временный `backend/requirements.txt.orig` (версии уже перенесены сюда).

### `backend/.env.example`
```
APP_MONGO_HOST=localhost
APP_MONGO_PORT=27017
APP_MONGO_USERNAME=admin
APP_MONGO_PASSWORD=admin
APP_MONGO_DB=datasets
APP_MONGO_AUTH_SOURCE=admin
APP_CORS_ALLOW_ORIGINS=["http://localhost:5173"]
APP_LOG_LEVEL=INFO
APP_ENVIRONMENT=local
```

### `backend/Dockerfile`
```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder

WORKDIR /install

RUN pip install --no-cache-dir --target=/install \
    fastapi==0.115.0 \
    "uvicorn[standard]==0.30.6" \
    pymongo==4.6.0 \
    pydantic==2.9.2 \
    pydantic-settings==2.5.2

FROM python:3.12-slim

RUN useradd --create-home appuser
WORKDIR /app

ENV PYTHONPATH=/usr/local/lib/python3.12/site-packages
COPY --from=builder /install /usr/local/lib/python3.12/site-packages
COPY app ./app

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 5. scripts/ — необходимая правка импорта

`python_project/database.py` был переименован в `scripts/mongo_connection.py`. Файлы
`scripts/examples.py` и `scripts/solution.py` импортировали его как соседний модуль
`database` — это единственное, что нужно поправить (без изменения остальной логики):

`scripts/examples.py`, строка 18 — было:
```python
from database import MongoDBConnection
```
стало:
```python
from mongo_connection import MongoDBConnection
```

`scripts/solution.py`, строка 1 — было:
```python
from database import MongoDBConnection
```
стало:
```python
from mongo_connection import MongoDBConnection
```

Остальной код `examples.py`/`solution.py`/`generate_data.py`/`mongo_connection.py` не менять —
это учебные файлы вне рантайма приложения, домена они не диктуют.

---

## 6. docker-compose.yml (корень)

```yaml
services:
  mongo:
    hostname: mongo
    image: mongo:8
    ports:
      - 27017:27017
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin
      MONGO_INITDB_DATABASE: datasets
    volumes:
      - mongo_data:/data/db
      - ./datasets:/var/opt/mongo/datasets
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s

  backend:
    build: ./backend
    hostname: backend
    ports:
      - 8000:8000
    environment:
      APP_MONGO_HOST: mongo
      APP_MONGO_PORT: 27017
      APP_MONGO_USERNAME: admin
      APP_MONGO_PASSWORD: admin
      APP_MONGO_DB: datasets
      APP_CORS_ALLOW_ORIGINS: '["http://localhost:5173"]'
    depends_on:
      mongo:
        condition: service_healthy

  frontend:
    build: ./frontend
    hostname: frontend
    ports:
      - 5173:5173
    environment:
      VITE_API_BASE_URL: http://localhost:8000
    depends_on:
      - backend

volumes:
  mongo_data:
```
(Frontend поднимается в dev-режиме через `vite --host` — см. `frontend/Dockerfile` ниже;
для прод-раздачи через Nginx потребуется отдельный multi-stage Dockerfile — не входит в этот план.)

---

## 7. Frontend

### `frontend/package.json`
```json
{
  "name": "mongo-admin-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "@tanstack/react-query": "^5.56.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^8.5.0",
    "@typescript-eslint/parser": "^8.5.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.2",
    "postcss": "^8.4.47",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.6.2",
    "vite": "^5.4.6"
  }
}
```

### `frontend/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### `frontend/vite.config.ts`
```ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL ?? "http://localhost:8000";

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api": {
          target: apiBaseUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
```

### `frontend/index.html`
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mongo Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `frontend/.eslintrc.cjs`
```js
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "react-hooks"],
  ignorePatterns: ["dist", ".eslintrc.cjs"],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
  },
};
```

### `frontend/.prettierrc`
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100
}
```

### `frontend/.env.example`
```
VITE_API_BASE_URL=http://localhost:8000
```

### `frontend/tailwind.config.js` (доп. файл, нужен Tailwind — не был создан ранее как заглушка)
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

### `frontend/postcss.config.js` (доп. файл)
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### `frontend/Dockerfile` (доп. файл, нужен для docker-compose)
```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## 8. Frontend: src/

### `frontend/src/vite-env.d.ts` (доп. файл, нужен для типов import.meta.env)
```ts
/// <reference types="vite/client" />
```

### `frontend/src/index.css` (доп. файл, подключается из main.tsx)
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### `frontend/src/api/types.ts`
```ts
export interface CollectionInfo {
  name: string;
  count: number;
}

export interface FieldInfo {
  name: string;
  types: string[];
}

export interface DocumentsPage {
  items: Record<string, unknown>[];
  total: number;
  skip: number;
  limit: number;
}

export interface ApiError {
  detail: string;
  request_id?: string | null;
}

export interface DocumentsQueryParams {
  filter?: string;
  skip?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: number;
}
```

### `frontend/src/api/client.ts`
```ts
import type { ApiError } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.detail);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiError;
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      payload = { detail: response.statusText };
    }
    throw new ApiRequestError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
```

### `frontend/src/api/collections.ts`
```ts
import { apiFetch } from "./client";
import type { CollectionInfo, FieldInfo } from "./types";

export function getCollections(): Promise<CollectionInfo[]> {
  return apiFetch<CollectionInfo[]>("/api/collections");
}

export function createCollection(name: string): Promise<CollectionInfo> {
  return apiFetch<CollectionInfo>("/api/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function dropCollection(name: string): Promise<void> {
  return apiFetch<void>(`/api/collections/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export function getCollectionFields(name: string): Promise<FieldInfo[]> {
  return apiFetch<FieldInfo[]>(`/api/collections/${encodeURIComponent(name)}/fields`);
}
```

### `frontend/src/api/documents.ts`
```ts
import { apiFetch } from "./client";
import type { DocumentsPage, DocumentsQueryParams } from "./types";

function buildQuery(params: DocumentsQueryParams): string {
  const search = new URLSearchParams();
  if (params.filter) search.set("filter", params.filter);
  if (params.skip !== undefined) search.set("skip", String(params.skip));
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.sortBy) search.set("sort_by", params.sortBy);
  if (params.sortDir !== undefined) search.set("sort_dir", String(params.sortDir));
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function getDocuments(
  collection: string,
  params: DocumentsQueryParams = {},
): Promise<DocumentsPage> {
  return apiFetch<DocumentsPage>(
    `/api/collections/${encodeURIComponent(collection)}/documents${buildQuery(params)}`,
  );
}

export function getDocument(collection: string, id: string): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`);
}

export function createDocument(
  collection: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function replaceDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function patchDocument(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteDocument(collection: string, id: string): Promise<void> {
  return apiFetch(`/api/collections/${encodeURIComponent(collection)}/documents/${id}`, {
    method: "DELETE",
  });
}
```

### `frontend/src/hooks/useCollections.ts`
```ts
import { useQuery } from "@tanstack/react-query";
import { getCollections } from "../api/collections";
import type { CollectionInfo } from "../api/types";

export function useCollections() {
  return useQuery<CollectionInfo[]>({
    queryKey: ["collections"],
    queryFn: getCollections,
  });
}
```

### `frontend/src/hooks/useCollectionFields.ts`
```ts
import { useQuery } from "@tanstack/react-query";
import { getCollectionFields } from "../api/collections";
import type { FieldInfo } from "../api/types";

export function useCollectionFields(name: string) {
  return useQuery<FieldInfo[]>({
    queryKey: ["fields", name],
    queryFn: () => getCollectionFields(name),
    enabled: Boolean(name),
  });
}
```

### `frontend/src/hooks/useDocuments.ts`
```ts
import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "../api/documents";
import type { DocumentsPage, DocumentsQueryParams } from "../api/types";

export function useDocuments(collection: string, params: DocumentsQueryParams) {
  return useQuery<DocumentsPage>({
    queryKey: ["documents", collection, params],
    queryFn: () => getDocuments(collection, params),
    enabled: Boolean(collection),
  });
}
```

### `frontend/src/hooks/useDocument.ts`
```ts
import { useQuery } from "@tanstack/react-query";
import { getDocument } from "../api/documents";

export function useDocument(collection: string, id: string) {
  return useQuery<Record<string, unknown>>({
    queryKey: ["document", collection, id],
    queryFn: () => getDocument(collection, id),
    enabled: Boolean(collection) && Boolean(id),
  });
}
```

### `frontend/src/lib/json.ts`
```ts
export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export function tryParseJson(input: string): JsonParseResult {
  if (!input.trim()) {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(input) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Некорректный JSON" };
  }
}
```

### `frontend/src/lib/format.ts`
```ts
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function truncate(text: string, maxLength = 80): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
```

### `frontend/src/components/FieldRenderer.tsx`
```tsx
import type { ReactNode } from "react";
import { formatValue } from "../lib/format";

export type FieldType = "string" | "number" | "boolean" | "object" | "array" | "unknown";

interface FieldRendererProps {
  value: unknown;
}

// Точка расширения: добавляйте свои рендереры по типу поля сюда.
const renderers: Record<FieldType, (value: unknown) => ReactNode> = {
  string: (value) => <span>{String(value)}</span>,
  number: (value) => <span>{String(value)}</span>,
  boolean: (value) => <span>{value ? "true" : "false"}</span>,
  object: (value) => <code>{formatValue(value)}</code>,
  array: (value) => <code>{formatValue(value)}</code>,
  unknown: (value) => <span>{formatValue(value)}</span>,
};

function resolveType(value: unknown): FieldType {
  if (value === null || value === undefined) return "unknown";
  if (Array.isArray(value)) return "array";
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") return type;
  if (type === "object") return "object";
  return "unknown";
}

export function FieldRenderer({ value }: FieldRendererProps): JSX.Element {
  const type = resolveType(value);
  return <>{renderers[type](value)}</>;
}

export { renderers as fieldRenderers };
```

### `frontend/src/components/EmptyState.tsx`
```tsx
interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-gray-500">
      <p className="text-lg font-medium">{title}</p>
      {description && <p className="text-sm">{description}</p>}
    </div>
  );
}
```

### `frontend/src/components/ConfirmDialog.tsx`
```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-2 text-sm text-gray-600">{description}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
}
```

### `frontend/src/components/ErrorBoundary.tsx`
```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Необработанная ошибка UI", error, info);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="m-4 rounded border border-red-300 bg-red-50 p-4 text-red-700">
          <p className="font-medium">Что-то пошло не так</p>
          <p className="text-sm">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### `frontend/src/components/Pagination.tsx`
```tsx
interface PaginationProps {
  skip: number;
  limit: number;
  total: number;
  onSkipChange: (skip: number) => void;
}

export function Pagination({ skip, limit, total, onSkipChange }: PaginationProps): JSX.Element {
  const hasPrev = skip > 0;
  const hasNext = skip + limit < total;

  return (
    <div className="flex items-center justify-between py-2 text-sm text-gray-600">
      <span>
        {skip + 1}–{Math.min(skip + limit, total)} из {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!hasPrev}
          className="rounded border px-2 py-1 disabled:opacity-40"
          onClick={() => onSkipChange(Math.max(0, skip - limit))}
        >
          Назад
        </button>
        <button
          type="button"
          disabled={!hasNext}
          className="rounded border px-2 py-1 disabled:opacity-40"
          onClick={() => onSkipChange(skip + limit)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
```

### `frontend/src/components/FilterBar.tsx`
```tsx
import { useState } from "react";
import { tryParseJson } from "../lib/json";

interface FilterBarProps {
  value: string;
  onApply: (filter: string) => void;
}

export function FilterBar({ value, onApply }: FilterBarProps): JSX.Element {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  function handleApply(): void {
    const result = tryParseJson(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onApply(draft);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border px-2 py-1 font-mono text-sm"
          placeholder='{"field": "value"}'
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
          onClick={handleApply}
        >
          Применить
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
```

### `frontend/src/components/Sidebar.tsx`
```tsx
import { NavLink } from "react-router-dom";
import { useCollections } from "../hooks/useCollections";

export function Sidebar(): JSX.Element {
  const { data: collections, isLoading } = useCollections();

  return (
    <aside className="w-56 shrink-0 border-r bg-gray-50 p-4">
      <NavLink to="/" className="mb-4 block text-sm font-semibold text-gray-700">
        Коллекции
      </NavLink>
      {isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}
      <nav className="flex flex-col gap-1">
        {collections?.map((collection) => (
          <NavLink
            key={collection.name}
            to={`/collections/${collection.name}`}
            className={({ isActive }) =>
              `rounded px-2 py-1 text-sm ${isActive ? "bg-gray-200 font-medium" : "hover:bg-gray-100"}`
            }
          >
            {collection.name}
            <span className="ml-1 text-xs text-gray-400">({collection.count})</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

### `frontend/src/components/Layout.tsx`
```tsx
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### `frontend/src/components/CollectionView.tsx`
```tsx
import { useState } from "react";
import type { FieldInfo } from "../api/types";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { useDocuments } from "../hooks/useDocuments";
import { FieldRenderer } from "./FieldRenderer";
import { FilterBar } from "./FilterBar";
import { Pagination } from "./Pagination";
import { EmptyState } from "./EmptyState";

interface CollectionViewProps {
  collection: string;
  columnsOverride?: FieldInfo[];
  onRowClick?: (id: string) => void;
}

const LIMIT = 20;

export function CollectionView({
  collection,
  columnsOverride,
  onRowClick,
}: CollectionViewProps): JSX.Element {
  const [skip, setSkip] = useState(0);
  const [filter, setFilter] = useState("");

  const { data: fields } = useCollectionFields(collection);
  const columns = columnsOverride ?? fields ?? [];

  const { data: page, isLoading } = useDocuments(collection, {
    filter: filter || undefined,
    skip,
    limit: LIMIT,
  });

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загрузка…</p>;
  }

  if (!page || page.items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <FilterBar
          value={filter}
          onApply={(value) => {
            setFilter(value);
            setSkip(0);
          }}
        />
        <EmptyState title="Документы не найдены" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        value={filter}
        onApply={(value) => {
          setFilter(value);
          setSkip(0);
        }}
      />
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100">
            <tr>
              {columns.map((column) => (
                <th key={column.name} className="px-3 py-2 font-medium">
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page.items.map((item) => (
              <tr
                key={String(item._id)}
                className="cursor-pointer border-t hover:bg-gray-50"
                onClick={() => onRowClick?.(String(item._id))}
              >
                {columns.map((column) => (
                  <td key={column.name} className="px-3 py-2">
                    <FieldRenderer value={item[column.name]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination skip={skip} limit={LIMIT} total={page.total} onSkipChange={setSkip} />
    </div>
  );
}
```

### `frontend/src/components/DocumentForm.tsx`
```tsx
import { useState, type FormEvent } from "react";
import type { FieldInfo } from "../api/types";
import { tryParseJson } from "../lib/json";

interface DocumentFormProps {
  fields: FieldInfo[];
  initialValue?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  submitLabel?: string;
}

export function DocumentForm({
  fields,
  initialValue,
  onSubmit,
  submitLabel = "Сохранить",
}: DocumentFormProps): JSX.Element {
  const [raw, setRaw] = useState(() => JSON.stringify(initialValue ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    const result = tryParseJson(raw);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) {
      setError("Документ должен быть JSON-объектом");
      return;
    }
    setError(null);
    onSubmit(result.value as Record<string, unknown>);
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      {fields.length > 0 && (
        <p className="text-xs text-gray-500">
          Известные поля: {fields.map((field) => field.name).join(", ")}
        </p>
      )}
      <textarea
        className="h-64 w-full rounded border p-2 font-mono text-sm"
        value={raw}
        onChange={(event) => setRaw(event.target.value)}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
      <button
        type="submit"
        className="self-start rounded bg-gray-800 px-4 py-1.5 text-sm text-white"
      >
        {submitLabel}
      </button>
    </form>
  );
}
```

### `frontend/src/pages/CollectionsPage.tsx`
```tsx
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createCollection } from "../api/collections";
import { useCollections } from "../hooks/useCollections";
import { EmptyState } from "../components/EmptyState";

export function CollectionsPage(): JSX.Element {
  const { data: collections, isLoading } = useCollections();
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!name.trim()) return;
    await createCollection(name.trim());
    setName("");
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Коллекции</h1>

      <form className="flex gap-2" onSubmit={handleCreate}>
        <input
          className="rounded border px-2 py-1 text-sm"
          placeholder="Имя новой коллекции"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" className="rounded bg-gray-800 px-3 py-1 text-sm text-white">
          Создать
        </button>
      </form>

      {isLoading && <p className="text-sm text-gray-400">Загрузка…</p>}

      {!isLoading && collections?.length === 0 && (
        <EmptyState title="Коллекций пока нет" description="Создайте первую коллекцию выше" />
      )}

      <ul className="flex flex-col gap-1">
        {collections?.map((collection) => (
          <li key={collection.name}>
            <button
              type="button"
              className="text-left text-sm text-blue-600 hover:underline"
              onClick={() => navigate(`/collections/${collection.name}`)}
            >
              {collection.name} ({collection.count})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### `frontend/src/pages/CollectionPage.tsx`
```tsx
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CollectionView } from "../components/CollectionView";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DocumentForm } from "../components/DocumentForm";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { createDocument } from "../api/documents";
import { dropCollection } from "../api/collections";

export function CollectionPage(): JSX.Element {
  const { name = "" } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: fields = [] } = useCollectionFields(name);

  const [showCreate, setShowCreate] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  async function handleCreate(data: Record<string, unknown>): Promise<void> {
    await createDocument(name, data);
    setShowCreate(false);
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
  }

  async function handleDropCollection(): Promise<void> {
    await dropCollection(name);
    await queryClient.invalidateQueries({ queryKey: ["collections"] });
    navigate("/");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{name}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-gray-800 px-3 py-1 text-sm text-white"
            onClick={() => setShowCreate((v) => !v)}
          >
            Создать документ
          </button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            onClick={() => setConfirmDrop(true)}
          >
            Удалить коллекцию
          </button>
        </div>
      </div>

      {showCreate && (
        <DocumentForm fields={fields} onSubmit={handleCreate} submitLabel="Создать" />
      )}

      <CollectionView
        collection={name}
        onRowClick={(id) => navigate(`/collections/${name}/documents/${id}`)}
      />

      <ConfirmDialog
        open={confirmDrop}
        title={`Удалить коллекцию "${name}"?`}
        description="Это действие необратимо."
        onConfirm={handleDropCollection}
        onCancel={() => setConfirmDrop(false)}
      />
    </div>
  );
}
```

### `frontend/src/pages/DocumentPage.tsx`
```tsx
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DocumentForm } from "../components/DocumentForm";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useDocument } from "../hooks/useDocument";
import { useCollectionFields } from "../hooks/useCollectionFields";
import { replaceDocument, deleteDocument } from "../api/documents";

export function DocumentPage(): JSX.Element {
  const { name = "", id = "" } = useParams<{ name: string; id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useDocument(name, id);
  const { data: fields = [] } = useCollectionFields(name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave(data: Record<string, unknown>): Promise<void> {
    await replaceDocument(name, id, data);
    await queryClient.invalidateQueries({ queryKey: ["document", name, id] });
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
  }

  async function handleDelete(): Promise<void> {
    await deleteDocument(name, id);
    await queryClient.invalidateQueries({ queryKey: ["documents", name] });
    navigate(`/collections/${name}`);
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Загрузка…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Документ {id}</h1>
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-1 text-sm text-white"
          onClick={() => setConfirmDelete(true)}
        >
          Удалить
        </button>
      </div>

      <DocumentForm fields={fields} initialValue={document} onSubmit={handleSave} />

      <ConfirmDialog
        open={confirmDelete}
        title="Удалить документ?"
        description="Это действие необратимо."
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
```

### `frontend/src/pages/NotFoundPage.tsx`
```tsx
import { Link } from "react-router-dom";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <p className="text-lg font-medium">Страница не найдена</p>
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        Вернуться к списку коллекций
      </Link>
    </div>
  );
}
```

### `frontend/src/router.tsx`
```tsx
import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { CollectionsPage } from "./pages/CollectionsPage";
import { CollectionPage } from "./pages/CollectionPage";
import { DocumentPage } from "./pages/DocumentPage";
import { NotFoundPage } from "./pages/NotFoundPage";

// Точка расширения: доменные страницы добавляются сюда как дочерние маршруты App.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <CollectionsPage /> },
      { path: "collections/:name", element: <CollectionPage /> },
      { path: "collections/:name/documents/:id", element: <DocumentPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);
```

### `frontend/src/App.tsx`
```tsx
import { Outlet } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";

export function App(): JSX.Element {
  return (
    <Layout>
      <ErrorBoundary>
        <Outlet />
      </ErrorBoundary>
    </Layout>
  );
}
```

### `frontend/src/main.tsx`
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

---

## 9. Команды запуска

Backend:
```
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.main:app --reload
pytest
```

Frontend:
```
cd frontend
npm install
cp .env.example .env
npm run dev
npm run typecheck && npm run lint
```

Docker Compose (полный стек):
```
docker compose up --build
```

Scripts (учебные, вне рантайма):
```
cd scripts
python generate_data.py
python solution.py
python examples.py
```

---

## 10. Точки расширения для будущей доменной логики

1. `backend/app/services/policy.py` — `KNOWN_COLLECTIONS`, `before_write`/`after_write`,
   свой `CollectionPolicy` вместо `AllowAllPolicy`.
2. `backend/app/schemas/` — доменные Pydantic-модели добавляются рядом с `common.py`
   (например, `schemas/users.py`), не затрагивая существующие.
3. `backend/app/routers/` — новые доменные роутеры подключаются в `main.py::create_app()`.
4. `frontend/src/components/FieldRenderer.tsx` — реестр `renderers` по типу поля.
5. `frontend/src/components/CollectionView.tsx` — параметр `columnsOverride`.
6. `frontend/src/router.tsx` — единая точка добавления доменных страниц.
7. `backend/app/services/mongo_service.py` — доменные сервисы могут оборачивать/наследовать
   `MongoService`, не меняя его публичных сигнатур.

---

## 11. Чек-лист «на будущее» (НЕ реализуется сейчас)

- [ ] Аутентификация/авторизация.
- [ ] Конкретные `CollectionPolicy` под реальные доменные коллекции.
- [ ] Валидация доменных схем документов (JSON Schema / Pydantic на конкретные коллекции).
- [ ] Индексы MongoDB под конкретные запросы.
- [ ] Продвинутый UI пагинации/сортировки, виртуализация больших таблиц.
- [ ] Полное тест-покрытие CRUD документов (сейчас — только smoke + health).
- [ ] CI-пайплайн (lint/test/build на PR).
- [ ] Prod-сборка фронтенда за Nginx вместо dev-сервера в docker-compose.
- [ ] Optimistic locking / версии документов.
- [ ] Rate limiting / защита API.

---

## 12. Открытые вопросы (не влияют на компиляцию, но стоит решить)

1. `all_in_one.py` в корне — untracked, не часть каркаса, не тронут. Удалить?
2. `backend/requirements.txt.orig` — временный, удалить после заполнения `pyproject.toml`.
3. `frontend`/`postcss.config.js`/`tailwind.config.js`/`Dockerfile`/`vite-env.d.ts`/`index.css` —
   не были в списке файлов-заглушек из предыдущей версии плана, но необходимы для работы
   Tailwind/TypeScript/Docker — код для них добавлен выше (§7–8), физически файлы ещё не созданы.
4. `docker-compose.yml` поднимает frontend в dev-режиме (`vite --host`) — для прод-окружения
   нужен отдельный multi-stage Dockerfile с Nginx (см. чек-лист §11).
