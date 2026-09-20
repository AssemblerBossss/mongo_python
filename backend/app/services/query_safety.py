from __future__ import annotations

import json
from typing import Any

from app.errors import InvalidFilterError

# Операторы, позволяющие выполнять произвольный JS на сервере Mongo.
BLOCKED_OPERATORS = {"$where", "$function", "$accumulator"}
DANGEROUS_KEYS = {"__proto__", "prototype", "constructor"}


def assert_no_dangerous_operators(value: Any) -> None:
    if isinstance(value, list):
        for item in value:
            assert_no_dangerous_operators(item)

    if not isinstance(value, dict):
        return

    for key, child in value.items():
        if key in DANGEROUS_KEYS:
            raise InvalidFilterError(
                f"Ключ '{key}' запрещён из соображений безопасности"
            )
        if key in BLOCKED_OPERATORS:
            raise InvalidFilterError(
                f"Оператор '{key}' запрещён из соображений безопасности"
            )
        assert_no_dangerous_operators(child)


def parse_json_object(value: str | dict[str, Any] | None, label: str) -> dict[str, Any]:
    """Раскладывает JSON-объект, приехавший строкой в query-параметре (как шлёт
    портированный фронт: filter/project/sort), либо уже готовый dict."""
    if value is None or value == "":
        return {}
    if isinstance(value, dict):
        parsed = value
    else:
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise InvalidFilterError(f"{label}: некорректный JSON ({exc})") from exc
    if not isinstance(parsed, dict):
        raise InvalidFilterError(f"{label}: ожидается JSON-объект")
    assert_no_dangerous_operators(parsed)
    return parsed
