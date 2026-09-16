from __future__ import annotations

import re
from typing import Any

from app.errors import InvalidFilterError
from app.schemas.common import FilterCondition, FilterField

FIELD_PATH_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")

ENUM_THRESHOLD = 30

_LEAF_TYPES = (str, bool, int, float, type(None))

_OPERATORS_BY_TYPE: dict[str, list[str]] = {
    "str": ["eq", "ne", "in", "contains", "exists"],
    "bool": ["eq", "exists"],
    "int": ["eq", "ne", "gt", "gte", "lt", "lte", "between", "in", "exists"],
    "float": ["eq", "ne", "gt", "gte", "lt", "lte", "between", "in", "exists"],
    "NoneType": ["exists"],
}


def collect_leaf_paths(
    doc: dict[str, Any], prefix: str = "", depth: int = 0
) -> dict[str, set[str]]:
    """Собирает dot-path -> набор типов для скалярных полей документа.

    Рекурсия заходит на один уровень внутрь списков словарей (например,
    results.instance), глубже — нет: вложенные dict/list (например,
    results.data.*) намеренно остаются непрозрачными.
    """
    out: dict[str, set[str]] = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        path = f"{prefix}{key}"
        if isinstance(value, _LEAF_TYPES):
            out.setdefault(path, set()).add(type(value).__name__)
        elif isinstance(value, list) and depth == 0:
            for item in value:
                if isinstance(item, dict):
                    for sub_path, sub_types in collect_leaf_paths(
                        item, f"{path}.", depth + 1
                    ).items():
                        out.setdefault(sub_path, set()).update(sub_types)
    return out


def merge_leaf_paths(samples: list[dict[str, Any]]) -> dict[str, set[str]]:
    merged: dict[str, set[str]] = {}
    for doc in samples:
        for path, types in collect_leaf_paths(doc).items():
            merged.setdefault(path, set()).update(types)
    return merged


def operators_for_types(types: set[str]) -> list[str]:
    ops: set[str] = set()
    for type_name in types:
        ops.update(_OPERATORS_BY_TYPE.get(type_name, ["eq", "exists"]))
    order = [
        "eq",
        "ne",
        "in",
        "contains",
        "gt",
        "gte",
        "lt",
        "lte",
        "between",
        "exists",
    ]
    return [op for op in order if op in ops]


def build_field(path: str, types: set[str], distinct_values: list[Any]) -> FilterField:
    enumerable = len(distinct_values) <= ENUM_THRESHOLD
    return FilterField(
        field=path,
        types=sorted(types),
        operators=operators_for_types(types),
        enumerable=enumerable,
        values=sorted(distinct_values, key=str) if enumerable else None,
    )


def _require_field_path(field: str) -> None:
    if not FIELD_PATH_RE.match(field):
        raise InvalidFilterError(f"Недопустимое имя поля: '{field}'")


def _require_scalar(operator: str, value: Any) -> None:
    if isinstance(value, (list, dict)) or value is None:
        raise InvalidFilterError(f"Оператор '{operator}' требует одиночное значение")


def _require_number(operator: str, value: Any) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise InvalidFilterError(f"Оператор '{operator}' требует число")


def condition_to_clause(condition: FilterCondition) -> dict[str, Any]:
    _require_field_path(condition.field)
    field, operator, value = condition.field, condition.operator, condition.value

    if operator == "eq":
        _require_scalar(operator, value)
        return {field: value}
    if operator == "ne":
        _require_scalar(operator, value)
        return {field: {"$ne": value}}
    if operator == "in":
        if not isinstance(value, list) or not value:
            raise InvalidFilterError("Оператор 'in' требует непустой список значений")
        return {field: {"$in": value}}
    if operator == "contains":
        if not isinstance(value, str) or not value:
            raise InvalidFilterError("Оператор 'contains' требует непустую строку")
        return {field: {"$regex": re.escape(value), "$options": "i"}}
    if operator == "exists":
        if not isinstance(value, bool):
            raise InvalidFilterError("Оператор 'exists' требует true/false")
        return {field: {"$exists": value}}
    if operator in ("gt", "gte", "lt", "lte"):
        _require_number(operator, value)
        return {field: {f"${operator}": value}}
    if operator == "between":
        if not (isinstance(value, list) and len(value) == 2):
            raise InvalidFilterError("Оператор 'between' требует [low, high]")
        low, high = value
        _require_number(operator, low)
        _require_number(operator, high)
        return {field: {"$gte": low, "$lte": high}}

    raise InvalidFilterError(f"Неизвестный оператор: '{operator}'")


def build_mongo_query(conditions: list[FilterCondition]) -> dict[str, Any]:
    clauses = [condition_to_clause(c) for c in conditions]
    if not clauses:
        return {}
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}
