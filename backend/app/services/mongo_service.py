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
