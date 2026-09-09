"""Сервисный слой: вся бизнес-логика работы с MongoDB в одном месте.

Роутеры (app/routers) не знают о pymongo — они вызывают методы MongoService
и переводят его исключения в HTTP-ответы.
"""
from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId
from pymongo.database import Database

from app.utils import serialize_document


class DocumentNotFoundError(Exception):
    """Документ или коллекция не найдены."""


class InvalidObjectIdError(Exception):
    """Некорректный формат идентификатора документа."""


class CollectionExistsError(Exception):
    """Коллекция с таким именем уже существует."""


class MongoService:
    def __init__(self, db: Database):
        self.db = db

    # ---------- Коллекции ----------

    def list_collections(self) -> list[dict]:
        names = sorted(self.db.list_collection_names())
        return [
            {"name": name, "count": self.db[name].count_documents({})}
            for name in names
        ]

    def create_collection(self, name: str) -> None:
        if name in self.db.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{name}' уже существует")
        self.db.create_collection(name)

    def drop_collection(self, name: str) -> None:
        if name not in self.db.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")
        self.db.drop_collection(name)

    def get_sample_fields(self, collection: str, sample_size: int = 25) -> list[str]:
        fields: list[str] = []
        seen = set()
        for doc in self.db[collection].find().limit(sample_size):
            for key in doc.keys():
                if key not in seen:
                    seen.add(key)
                    fields.append(key)
        return fields

    # ---------- Документы ----------

    @staticmethod
    def _to_object_id(doc_id: str) -> ObjectId:
        try:
            return ObjectId(doc_id)
        except (InvalidId, TypeError):
            raise InvalidObjectIdError(f"Некорректный идентификатор документа: {doc_id}")

    def get_documents(
        self,
        collection: str,
        query: dict | None = None,
        skip: int = 0,
        limit: int = 20,
        sort_by: str = "_id",
        sort_dir: int = 1,
    ) -> tuple[list[dict], int]:
        query = query or {}
        col = self.db[collection]
        total = col.count_documents(query)
        cursor = col.find(query).sort(sort_by, sort_dir).skip(skip).limit(limit)
        documents = [serialize_document(doc) for doc in cursor]
        return documents, total

    def get_document(self, collection: str, doc_id: str) -> dict:
        object_id = self._to_object_id(doc_id)
        doc = self.db[collection].find_one({"_id": object_id})
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    def create_document(self, collection: str, data: dict) -> dict:
        data = dict(data)
        data.pop("_id", None)
        result = self.db[collection].insert_one(data)
        return self.get_document(collection, str(result.inserted_id))

    def update_document(self, collection: str, doc_id: str, data: dict) -> dict:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        result = self.db[collection].replace_one({"_id": object_id}, data)
        if result.matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return self.get_document(collection, doc_id)

    def delete_document(self, collection: str, doc_id: str) -> None:
        object_id = self._to_object_id(doc_id)
        result = self.db[collection].delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
