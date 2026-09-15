from __future__ import annotations

from typing import Any

from pymongo.database import Database
from pymongo.results import DeleteResult, InsertManyResult, InsertOneResult, UpdateResult


class MongoRepository:
    """Инкапсулирует CRUD-операции pymongo над произвольной коллекцией."""

    def __init__(self, db: Database) -> None:
        self.db = db

    # ---------- Коллекции ----------

    def list_collection_names(self) -> list[str]:
        return self.db.list_collection_names()

    def create_collection(self, name: str) -> None:
        self.db.create_collection(name)

    def drop_collection(self, name: str) -> None:
        self.db.drop_collection(name)

    def create_index(self, collection: str, keys: str | list[tuple[str, int]], **kwargs: Any) -> str:
        return self.db[collection].create_index(keys, **kwargs)

    # ---------- Документы ----------

    def count_documents(self, collection: str, query: dict[str, Any]) -> int:
        return self.db[collection].count_documents(query)

    def find(
            self,
            collection: str,
            query: dict[str, Any],
            sort_by: str,
            sort_dir: int,
            skip: int,
            limit: int,
    ) -> list[dict[str, Any]]:
        cursor = self.db[collection].find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
        return list(cursor)

    def find_sample(self, collection: str, limit: int) -> list[dict[str, Any]]:
        return list(self.db[collection].find().limit(limit))

    def find_one(self, collection: str, query: dict[str, Any]) -> dict[str, Any] | None:
        return self.db[collection].find_one(query)

    def insert_one(self, collection: str, document: dict[str, Any]) -> Any:
        result: InsertOneResult = self.db[collection].insert_one(document)
        return result.inserted_id

    def upsert_results(self, collection: str, address: str, results: list[dict[str, Any]]) -> None:
        self.db[collection].update_one(
            {"address": address},
            {
                "$setOnInsert": {"address": address},
                "$addToSet": {"results": {"$each": results}},
            },
            upsert=True,
        )

    def upsert_results_bulk(self, collection: str, address: str, results: list[dict[str, Any]]) -> None:
        pass

    def replace_one(self, collection: str, query: dict[str, Any], document: dict[str, Any]) -> int:
        result: UpdateResult = self.db[collection].replace_one(query, document)
        return result.matched_count

    def update_one(self, collection: str, query: dict[str, Any], update: dict[str, Any]) -> int:
        result: UpdateResult = self.db[collection].update_one(query, update)
        return result.matched_count

    def delete_one(self, collection: str, query: dict[str, Any]) -> int:
        result: DeleteResult = self.db[collection].delete_one(query)
        return result.deleted_count
