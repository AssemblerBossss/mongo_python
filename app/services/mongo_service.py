"""Сервисный слой: вся бизнес-логика работы с MongoDB в одном месте.

Построен на MongoDBConnection (python_project/database.py) — тот же учебный
класс, которым пользуются solution.py и examples.py. Роутеры (app/routers)
не знают о pymongo — они вызывают методы MongoService и переводят его
исключения в HTTP-ответы.
"""
from __future__ import annotations

from bson import ObjectId
from bson.errors import InvalidId

from python_project.database import MongoDBConnection

from app.utils import serialize_document


class DocumentNotFoundError(Exception):
    """Документ или коллекция не найдены."""


class InvalidObjectIdError(Exception):
    """Некорректный формат идентификатора документа."""


class CollectionExistsError(Exception):
    """Коллекция с таким именем уже существует."""


class MongoService:
    def __init__(self, connection: MongoDBConnection):
        self.connection = connection

    # ---------- Коллекции ----------

    def list_collections(self) -> list[dict]:
        names = sorted(self.connection.db.list_collection_names())
        return [{"name": name, "count": self.connection.count(name)} for name in names]

    def create_collection(self, name: str) -> None:
        if name in self.connection.db.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{name}' уже существует")
        self.connection.db.create_collection(name)

    def drop_collection(self, name: str) -> None:
        if name not in self.connection.db.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")
        self.connection.db.drop_collection(name)

    def get_sample_fields(self, collection: str, sample_size: int = 25) -> list[str]:
        fields: list[str] = []
        seen = set()
        cursor = self.connection.find(collection)
        if cursor is None:
            return fields
        for doc in cursor.limit(sample_size):
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
        cursor = self.connection.find(collection, query)
        if cursor is None:
            return [], 0
        total = self.connection.count(collection, query)
        documents = [
            serialize_document(doc)
            for doc in cursor.sort(sort_by, sort_dir).skip(skip).limit(limit)
        ]
        return documents, total

    def get_document(self, collection: str, doc_id: str) -> dict:
        object_id = self._to_object_id(doc_id)
        col = self.connection.get_collection(collection)
        doc = col.find_one({"_id": object_id}) if col is not None else None
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    def create_document(self, collection: str, data: dict) -> dict:
        data = dict(data)
        data.pop("_id", None)
        inserted_ids = self.connection.insert_many(collection, [data])
        if not inserted_ids:
            raise ValueError("Не удалось создать документ")
        return self.get_document(collection, str(inserted_ids[0]))

    def update_document(self, collection: str, doc_id: str, data: dict) -> dict:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        col = self.connection.get_collection(collection)
        result = col.replace_one({"_id": object_id}, data)
        if result.matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return self.get_document(collection, doc_id)

    def delete_document(self, collection: str, doc_id: str) -> None:
        object_id = self._to_object_id(doc_id)
        col = self.connection.get_collection(collection)
        result = col.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
