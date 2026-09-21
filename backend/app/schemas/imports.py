from typing import Any

from pydantic import BaseModel, RootModel, field_validator, model_validator

from app.utils.serialization import stringify_big_ints


DEFAULT_INSTANSE = "Unknown Service"
DEFAULT_DATA_TYPE = "Unknown data_type"


class ScanRecord(BaseModel):
    """Один результат сканирования домена."""

    instanse: str = DEFAULT_INSTANSE
    result: bool
    data_type: str = DEFAULT_DATA_TYPE
    data: Any = None
    error: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _normalize_keys(cls, values: Any) -> Any:
        """Чинит опечатки в ключах и подставляет значения по умолчанию.

        Отсутствующие или null instance/data_type
        заменяются на DEFAULT_* (иначе null дал бы None вместо значения по умолчанию).
        """
        if not isinstance(values, dict):
            return values
        fixed = dict(values)

        value = fixed.get("instanse")
        if value is None or value == "":
            fixed["instanse"] = DEFAULT_INSTANSE

        value = fixed.get("data_type")
        if value is None or value == "":
            fixed["data_type"] = DEFAULT_DATA_TYPE
        return fixed

    @field_validator("data", mode="after")
    @classmethod
    def _bson_safe_ints(cls, data: Any) -> Any:
        """Целые вне int64 (например simhash) -> строки, иначе MongoDB не запишет."""
        if isinstance(data, str) or data is None:
            return {}

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
