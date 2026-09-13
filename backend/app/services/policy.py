"""Точки расширения для будущей доменной логики.

Модуль намеренно не содержит доменных правил — только интерфейсы и no-op
реализации по умолчанию. Когда домен станет известен, сюда добавляются
конкретные политики и хуки для нужных коллекций.
"""
from __future__ import annotations

from typing import Any, Protocol


class CollectionPolicy(Protocol):
    """Политика доступа к коллекции."""

    def can_read(self, collection: str) -> bool:
        ...

    def can_write(self, collection: str) -> bool:
        ...

    def can_delete(self, collection: str) -> bool:
        ...


class AllowAllPolicy:
    """Политика по умолчанию — разрешает все операции над любой коллекцией."""

    def can_read(self, collection: str) -> bool:
        return True

    def can_write(self, collection: str) -> bool:
        return True

    def can_delete(self, collection: str) -> bool:
        return True


def before_write(collection: str, data: dict[str, Any]) -> dict[str, Any]:
    """Хук перед записью документа. По умолчанию не изменяет данные."""
    return data


def after_write(collection: str, document: dict[str, Any]) -> dict[str, Any]:
    """Хук после записи документа. По умолчанию не изменяет документ."""
    return document


# Точка расширения: сюда регистрируются политики для конкретных коллекций,
# например KNOWN_COLLECTIONS["users"] = UsersPolicy().
KNOWN_COLLECTIONS: dict[str, CollectionPolicy] = {}
