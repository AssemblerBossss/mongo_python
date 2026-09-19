from __future__ import annotations

import asyncio
import json
from typing import Any

from bson import ObjectId, json_util
from bson.errors import InvalidId

from app.errors import (
    CollectionExistsError,
    DocumentNotFoundError,
    InvalidObjectIdError,
    IndexNotFoundError,
)
from app.repositories.mongo_repository import MongoRepository
from app.schemas import CollectionInfo, FieldInfo, FilterField, IndexInfo
from app.services.filters import ENUM_THRESHOLD, build_field, merge_leaf_paths
from app.services.query_safety import (
    MAX_PAGE_SIZE,
    MAX_SCHEMA_SAMPLE_SIZE,
    MONGO_QUERY_MAX_TIME_MS,
    bounded_int,
    validate_pipeline,
)
from app.utils.serialization import serialize_document


class MongoService:
    """Универсальные CRUD-операции над произвольными коллекциями MongoDB."""

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo

    async def _ensure_collection_exists(self, name: str) -> None:
        if name not in await self.repo.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")

    async def list_collections(self) -> list[CollectionInfo]:
        names = sorted(await self.repo.list_collection_names())
        return [
            CollectionInfo(name=name, count=await self.repo.count_documents(name, {}))
            for name in names
        ]

    async def create_collection(self, collection: str) -> None:
        if collection in await self.repo.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{collection}' уже существует")
        await self.repo.create_collection(collection)

    async def drop_collection(self, collection: str) -> None:
        await self._ensure_collection_exists(collection)
        await self.repo.drop_collection(collection)

    async def create_index(
        self, collection: str, keys: dict[str, int], options: dict[str, Any]
    ) -> str:
        await self._ensure_collection_exists(collection)

        key_pairs = list(keys.items())
        return await self.repo.create_index(
            collection=collection, keys=key_pairs, options=options
        )

    async def list_indexes(self, collection: str) -> list[IndexInfo]:
        await self._ensure_collection_exists(collection)
        raw_indexes = await self.repo.list_indexes(collection)
        return [
            IndexInfo(
                name=idx["name"],
                key=idx["key"],
                unique=bool(idx.get("unique", False)),
                sparse=bool(idx.get("sparse", False)),
                expireAfterSeconds=idx.get("expireAfterSeconds"),
            )
            for idx in raw_indexes
        ]

    async def drop_index(self, collection: str, index_name: str) -> None:
        await self._ensure_collection_exists(collection)
        exists_indexes = await self.repo.list_indexes(collection)
        indexes_names = {idx["name"] for idx in exists_indexes}
        if index_name not in indexes_names:
            raise IndexNotFoundError(
                f"Индекс '{index_name}' не найден в коллекции '{collection}'"
            )
        await self.repo.drop_index(collection=collection, index_name=index_name)

    async def collection_stats(self, collection: str) -> dict[str, Any]:
        await self._ensure_collection_exists(collection)
        raw = await self.repo.collection_stats(collection)
        return json.loads(json_util.dumps(raw))

    async def server_stats(self) -> dict[str, Any]:
        server_status, db_stats = await asyncio.gather(
            self.repo.server_status(),
            self.repo.db_stats(),
        )
        payload = {
            "serverStatus": {
                "version": server_status.get("version"),
                "uptime": server_status.get("uptime"),
                "connections": server_status.get("connections"),
                "mem": server_status.get("mem"),
                "opcounters": server_status.get("opcounters"),
            },
            "dbStats": {
                "collections": db_stats.get("collections", 0),
                "objects": db_stats.get("objects", 0),
                "avgObjSize": db_stats.get("avgObjSize", 0),
                "dataSize": db_stats.get("dataSize", 0),
                "storageSize": db_stats.get("storageSize", 0),
                "indexSize": db_stats.get("indexSize", 0),
            },
        }
        return json.loads(json_util.dumps(payload))

    async def run_aggregation(
        self, collection: str, pipeline: list[dict], limit: int | None
    ) -> dict[str, Any]:
        await self._ensure_collection_exists(collection)

        validate_pipeline(pipeline)
        bounded_limit = bounded_int(limit, 50, 1, MAX_PAGE_SIZE)
        preview_pipeline = [*pipeline, {"$limit": bounded_limit}]
        documents = [
            serialize_document(doc)
            for doc in await self.repo.aggregate(
                collection, preview_pipeline, MONGO_QUERY_MAX_TIME_MS
            )
        ]
        return {"documents": documents, "count": len(documents), "limit": bounded_limit}

    async def analyze_schema(
        self, collection: str, sample_size: int | None
    ) -> dict[str, Any]:
        await self._ensure_collection_exists(collection)

        bounded_size = bounded_int(sample_size, 500, 1, MAX_SCHEMA_SAMPLE_SIZE)
        docs = await self.repo.sample_documents(
            collection=collection,
            size=bounded_size,
            max_time_ms=MONGO_QUERY_MAX_TIME_MS,
        )

        fields: dict[str, dict[str, Any]] = {}

        def collect(doc: Any, prefix: str = "") -> None:
            if not isinstance(doc, dict):
                return
            for key, value in doc.items():
                path = f"{prefix}.{key}" if prefix else key
                value_type = "null" if value is None else type(value).__name__
                info = fields.setdefault(
                    path, {"path": path, "count": 0, "types": {}, "examples": []}
                )
                info["count"] += 1
                info["types"][value_type] = info["types"].get(value_type, 0) + 1
                if len(info["examples"]) < 5:
                    info["examples"].append(value)
                if isinstance(value, dict):
                    collect(value, path)

        for doc in docs:
            collect(doc)

        result = [
            {
                **info,
                "presence": round(info["count"] / len(docs) * 100, 2) if docs else 0,
            }
            for info in sorted(fields.values(), key=lambda f: f["path"])
        ]
        return json.loads(json_util.dumps({"sampleSize": len(docs), "fields": result}))

    async def infer_fields(
        self, collection: str, sample_size: int = 25
    ) -> list[FieldInfo]:
        """Определяет набор полей и их типы по выборке документов."""
        fields: dict[str, set[str]] = {}
        for doc in await self.repo.find_sample(collection, sample_size):
            for key, value in doc.items():
                fields.setdefault(key, set()).add(type(value).__name__)
        return [
            FieldInfo(name=name, types=sorted(types)) for name, types in fields.items()
        ]

    async def list_filter_fields(
        self, collection: str, sample_size: int = 200
    ) -> list[FilterField]:
        """Поля, доступные для фильтра: путь, типы, операторы, готовые значения для кнопок."""
        samples = await self.repo.find_sample(collection, sample_size)
        leaf_paths = merge_leaf_paths(samples)

        import asyncio

        paths_sorted = sorted(leaf_paths.items())
        distinct_lists = await asyncio.gather(
            *(
                self.repo.distinct_values(collection, path, ENUM_THRESHOLD + 1)
                for path, _ in paths_sorted
            )
        )
        fields = [
            build_field(path, types, distinct_values)
            for (path, types), distinct_values in zip(paths_sorted, distinct_lists)
        ]
        return fields

    @staticmethod
    def _to_object_id(doc_id: str) -> ObjectId:
        try:
            return ObjectId(doc_id)
        except (InvalidId, TypeError):
            raise InvalidObjectIdError(
                f"Некорректный идентификатор документа: {doc_id}"
            )

    async def find(
        self,
        collection: str,
        query: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: dict[str, Any] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        query = query or {}
        projection = projection or {}
        sort_list = list((sort or {}).items())
        total = await self.repo.count_documents(collection, query)
        documents = [
            serialize_document(doc)
            for doc in await self.repo.find(
                collection, query, projection, sort_list, skip, limit
            )
        ]
        return documents, total

    async def get(self, collection: str, doc_id: str) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        doc = await self.repo.find_one(collection, {"_id": object_id})
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    async def insert(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        data = dict(data)
        data.pop("_id", None)
        inserted_id = await self.repo.insert_one(collection, data)
        return await self.get(collection, str(inserted_id))

    async def replace(
        self, collection: str, doc_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        matched_count = await self.repo.replace_one(
            collection, {"_id": object_id}, data
        )
        if matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return await self.get(collection, doc_id)

    async def patch(
        self, collection: str, doc_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        matched_count = await self.repo.update_one(
            collection, {"_id": object_id}, {"$set": data}
        )
        if matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return await self.get(collection, doc_id)

    async def delete(self, collection: str, doc_id: str) -> None:
        object_id = self._to_object_id(doc_id)
        deleted_count = await self.repo.delete_one(collection, {"_id": object_id})
        if deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
