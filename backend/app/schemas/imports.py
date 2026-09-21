from typing import Any

from pydantic import BaseModel, RootModel, field_validator, model_validator

from app.utils.serialization import stringify_big_ints

# Опечатки ключей во входных файлах -> корректное имя поля.
FIELD_TYPO_ALIASES = {"instanse": "instance"}


class ScanRecord(BaseModel):
    """Один результат сканирования домена."""

    instance: str
    result: bool
    data_type: str
    data: dict[str, Any] = {}
    error: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _fix_key_typos(cls, values: Any) -> Any:
        """Исправляет известные опечатки в ключах (instanse -> instance)."""
        if not isinstance(values, dict):
            return values
        fixed = dict(values)
        for typo, correct in FIELD_TYPO_ALIASES.items():
            if typo in fixed:
                value = fixed.pop(typo)
                fixed.setdefault(correct, value)
        return fixed

    @field_validator("data", mode="after")
    @classmethod
    def _bson_safe_ints(cls, data: dict[str, Any]) -> dict[str, Any]:
        """Целые вне int64 (например simhash) -> строки, иначе MongoDB не запишет."""
        return stringify_big_ints(data)


class ImportPayload(RootModel[dict[str, list[ScanRecord]]]):
    """Тело запроса: домен -> список результатов сканирования."""


class AddressImportStats(BaseModel):
    """Статистика импорта по одному адресу (ipv4/ipv6/домен/MAC)."""

    address: str
    collection: str
    received: int
    imported: int
    skipped: int


class ImportSummary(BaseModel):
    """Итог массовой загрузки по всем доменам из запроса."""

    addresses: list[AddressImportStats]
    total_imported: int
    total_skipped: int
