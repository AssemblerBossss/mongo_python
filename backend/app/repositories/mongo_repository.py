from __future__ import annotations

from collections.abc import MutableMapping, Mapping
from typing import Any

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.results import (
    DeleteResult,
    InsertManyResult,
    InsertOneResult,
    UpdateResult,
)


class MongoRepository:
    """Инкапсулирует CRUD-операции pymongo над произвольной коллекцией."""

    def __init__(self, db: AsyncDatabase) -> None:
        self.db = db

    # ---------- Коллекции ----------

    async def list_collection_names(self) -> list[str]:
        return await self.db.list_collection_names()

    async def create_collection(self, name: str) -> None:
        await self.db.create_collection(name)

    async def drop_collection(self, name: str) -> None:
        await self.db.drop_collection(name)

    async def collection_stats(self, name: str) -> dict[str, Any]:
        return await self.db.command("collStats", name)

    async def count_documents(self, collection: str, query: dict[str, Any]) -> int:
        return await self.db[collection].count_documents(query)

    # ---------- Сервер ----------

    async def server_status(self) -> dict[str, Any]:
        return await self.db.client.admin.command("serverStatus")

    async def db_stats(self) -> dict[str, Any]:
        return await self.db.command("dbStats")

    # ---------- Документы ----------

    async def create_index(
        self, collection: str, keys: str | list[tuple[str, int]], **kwargs: Any
    ) -> str:
        return await self.db[collection].create_index(keys, **kwargs)

    async def list_indexes(self, collection: str) -> list[MutableMapping[str, Any]]:
        cursor = await self.db[collection].list_indexes()
        return await cursor.to_list(length=None)

    async def drop_index(self, collection: str, index_name: str) -> None:
        await self.db[collection].drop_index(index_name)

    async def find(
        self,
        collection: str,
        query: dict[str, Any],
        projection: dict[str, Any],
        sort: list[tuple[str, int]],
        skip: int,
        limit: int,
    ) -> list[Mapping[str, Any]]:
        cursor = (
            self.db[collection].find(query, projection or None).skip(skip).limit(limit)
        )
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list()

    async def find_sample(self, collection: str, limit: int) -> list[Mapping[str, Any]]:
        cursor = (self.db[collection].find().limit(limit))
        return await cursor.to_list()

    def distinct_values(self, collection: str, field: str, limit: int) -> list[Any]:
        pipeline = [{"$group": {"_id": f"${field}"}}, {"$limit": limit}]
        return [
            doc["_id"]
            for doc in self.db[collection].aggregate(pipeline)
            if doc["_id"] is not None
        ]

    def aggregate(
        self, collection: str, pipeline: list[dict[str, Any]], max_time_ms: int
    ) -> list[dict[str, Any]]:
        return list(
            self.db[collection].aggregate(
                pipeline, maxTimeMS=max_time_ms, allowDiskUse=False
            )
        )

    def sample_documents(
        self, collection: str, size: int, max_time_ms: int
    ) -> list[dict[str, Any]]:
        return self.aggregate(collection, [{"$sample": {"size": size}}], max_time_ms)

    def find_one(self, collection: str, query: dict[str, Any]) -> dict[str, Any] | None:
        return self.db[collection].find_one(query)

    def insert_one(self, collection: str, document: dict[str, Any]) -> Any:
        result: InsertOneResult = self.db[collection].insert_one(document)
        return result.inserted_id

    def upsert_results(
        self, collection: str, address: str, results: list[dict[str, Any]]
    ) -> None:
        self.db[collection].update_one(
            {"address": address},
            {
                "$setOnInsert": {"address": address},
                "$addToSet": {"results": {"$each": results}},
            },
            upsert=True,
        )

    def upsert_results_bulk(
        self, collection: str, address: str, results: list[dict[str, Any]]
    ) -> None:
        pass

    def replace_one(
        self, collection: str, query: dict[str, Any], document: dict[str, Any]
    ) -> int:
        result: UpdateResult = self.db[collection].replace_one(query, document)
        return result.matched_count

    def update_one(
        self, collection: str, query: dict[str, Any], update: dict[str, Any]
    ) -> int:
        result: UpdateResult = self.db[collection].update_one(query, update)
        return result.matched_count

    def delete_one(self, collection: str, query: dict[str, Any]) -> int:
        result: DeleteResult = self.db[collection].delete_one(query)
        return result.deleted_count
