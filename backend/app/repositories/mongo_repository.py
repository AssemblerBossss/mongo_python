from __future__ import annotations

from collections.abc import MutableMapping, Mapping
from typing import Any


from pymongo import UpdateOne
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.results import (
    DeleteResult,
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

    # ---------- Индексы ----------

    async def create_index(
        self, collection: str, keys: str | list[tuple[str, int]], **kwargs: Any
    ) -> str:
        return await self.db[collection].create_index(keys, **kwargs)

    async def list_indexes(self, collection: str) -> list[MutableMapping[str, Any]]:
        cursor = await self.db[collection].list_indexes()
        return await cursor.to_list(length=None)

    async def drop_index(self, collection: str, index_name: str) -> None:
        await self.db[collection].drop_index(index_name)

    # ---------- Документы ----------

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

    async def find_one(
        self, collection: str, query: dict[str, Any]
    ) -> Mapping[str, Any] | None:
        return await self.db[collection].find_one(query)

    async def insert_one(self, collection: str, document: dict[str, Any]) -> Any:
        result: InsertOneResult = await self.db[collection].insert_one(document)
        return result.inserted_id

    async def upsert_results_bulk(
        self, collection: str, by_address: dict[str, list[dict[str, Any]]]
    ) -> None:
        operations = [
            UpdateOne(
                {"address": address},
                {
                    "$setOnInsert": {"address": address},
                    "$addToSet": {"results": {"$each": results}},
                },
                upsert=True,
            )
            for address, results in by_address.items()
        ]
        if operations:
            await self.db[collection].bulk_write(operations, ordered=False)

    async def update_one(
        self, collection: str, query: dict[str, Any], update: dict[str, Any]
    ) -> int:
        result: UpdateResult = await self.db[collection].update_one(query, update)
        return result.matched_count

    async def delete_one(self, collection: str, query: dict[str, Any]) -> int:
        result: DeleteResult = await self.db[collection].delete_one(query)
        return result.deleted_count
