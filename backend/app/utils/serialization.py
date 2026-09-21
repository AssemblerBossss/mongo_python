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


INT64_MIN = -(2**63)
INT64_MAX = 2**63 - 1


def int64_safe_int(literal: str) -> int | str:
    """Хук для json.loads(parse_int=...): целое вне int64 -> строка.

    MongoDB (BSON) хранит целые максимум в 64 бита со знаком, поэтому
    значения вроде 64-битного simhash (uint64) при записи падают с
    OverflowError.
    Вызывается на лету во время разбора JSON, отдельного обхода дерева нет.
    """
    value = int(literal)
    return value if INT64_MIN <= value <= INT64_MAX else literal
