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
    return {key: serialize_value(value) for key, value in doc.items()}
