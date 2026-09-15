from __future__ import annotations

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId

from app.errors import CollectionExistsError, DocumentNotFoundError, InvalidObjectIdError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.common import CollectionInfo, FieldInfo
from app.utils.serialization import serialize_document


class MongoService:
    """Универсальные CRUD-операции над произвольными коллекциями MongoDB."""

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo

    def list_collections(self) -> list[CollectionInfo]:
        names = sorted(self.repo.list_collection_names())
        return [
            CollectionInfo(name=name, count=self.repo.count_documents(name, {}))
            for name in names
        ]

    def create_collection(self, name: str) -> None:
        if name in self.repo.list_collection_names():
            raise CollectionExistsError(f"Коллекция '{name}' уже существует")
        self.repo.create_collection(name)

    def drop_collection(self, name: str) -> None:
        if name not in self.repo.list_collection_names():
            raise DocumentNotFoundError(f"Коллекция '{name}' не найдена")
        self.repo.drop_collection(name)

    def infer_fields(self, collection: str, sample_size: int = 25) -> list[FieldInfo]:
        """Определяет набор полей и их типы по выборке документов."""
        fields: dict[str, set[str]] = {}
        for doc in self.repo.find_sample(collection, sample_size):
            for key, value in doc.items():
                fields.setdefault(key, set()).add(type(value).__name__)
        return [FieldInfo(name=name, types=sorted(types)) for name, types in fields.items()]

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
        query = query or {}
        total = self.repo.count_documents(collection, query)
        documents = [
            serialize_document(doc)
            for doc in self.repo.find(collection, query, sort_by, sort_dir, skip, limit)
        ]
        return documents, total

    def get(self, collection: str, doc_id: str) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        doc = self.repo.find_one(collection, {"_id": object_id})
        if doc is None:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return serialize_document(doc)

    def insert(self, collection: str, data: dict[str, Any]) -> dict[str, Any]:
        data = dict(data)
        data.pop("_id", None)
        inserted_id = self.repo.insert_one(collection, data)
        return self.get(collection, str(inserted_id))

    def replace(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        matched_count = self.repo.replace_one(collection, {"_id": object_id}, data)
        if matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return self.get(collection, doc_id)

    def patch(self, collection: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        object_id = self._to_object_id(doc_id)
        data = dict(data)
        data.pop("_id", None)
        matched_count = self.repo.update_one(collection, {"_id": object_id}, {"$set": data})
        if matched_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
        return self.get(collection, doc_id)

    def delete(self, collection: str, doc_id: str) -> None:
        object_id = self._to_object_id(doc_id)
        deleted_count = self.repo.delete_one(collection, {"_id": object_id})
        if deleted_count == 0:
            raise DocumentNotFoundError(f"Документ {doc_id} не найден")
