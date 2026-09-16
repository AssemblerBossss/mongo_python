from typing import Any

from pydantic import BaseModel, RootModel


class ScanRecord(BaseModel):
    """Один результат сканирования домена."""

    instance: str
    result: bool
    data_type: str
    data: dict[str, Any] = {}
    error: str | None = None


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
