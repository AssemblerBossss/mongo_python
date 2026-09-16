from __future__ import annotations

import json

from pydantic import ValidationError

from app.errors import EmptyImportPayloadError, InvalidImportFileError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.imports import (
    AddressImportStats,
    ImportPayload,
    ImportSummary,
    ScanRecord,
)

ADDRESS_FIELD = "address"

# Связь типа адреса и физического имени коллекции.
SCAN_COLLECTIONS = {
    "ip": "ip_addresses",
    "domain": "domains",
    "mac": "mac_addresses",
}


class ImportService:
    """Фильтрует невалидные записи и сохраняет результаты сканирования по доменам."""

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo

    @staticmethod
    def _is_valid(record: ScanRecord) -> bool:
        """Запись валидна, если есть непустые данные и нет ошибки."""
        return bool(record.data) and not record.error

    def parse_file(self, filename: str, content: bytes) -> ImportPayload:
        """Разбирает один загруженный файл: JSON-объект {адрес: [результаты]}, как в /import."""
        try:
            raw = json.loads(content)
        except json.JSONDecodeError as exc:
            raise InvalidImportFileError(
                f"Файл '{filename}': некорректный JSON ({exc})"
            ) from exc

        if not isinstance(raw, dict):
            raise InvalidImportFileError(
                f"Файл '{filename}': ожидается JSON-объект вида {{адрес: [результаты]}}"
            )
        try:
            return ImportPayload.model_validate(raw)
        except ValidationError as exc:
            raise InvalidImportFileError(f"Файл '{filename}': {exc}") from exc

    def import_files(self, collection: str, files: dict[str, bytes]) -> ImportSummary:
        """Разбирает набор файлов (имя -> содержимое) и импортирует их одной транзакцией записи."""
        payload_root: dict[str, list[ScanRecord]] = {}
        for filename, content in files.items():
            file_payload = self.parse_file(filename, content)
            for address, records in file_payload.root.items():
                payload_root.setdefault(address, []).extend(records)

        return self.import_records(collection, ImportPayload(payload_root))

    def import_records(self, collection: str, payload: ImportPayload) -> ImportSummary:
        """Фильтрует записи и раскладывает их по ip_addresses/domains/mac_addresses."""
        stats: list[AddressImportStats] = []

        # collection -> address -> results
        pending: dict[str, dict[str, list[dict]]] = {}

        for address, records in payload.root.items():
            valid_records = [
                record.model_dump() for record in records if self._is_valid(record)
            ]
            stats.append(
                AddressImportStats(
                    address=address,
                    collection=collection,
                    received=len(records),
                    imported=len(valid_records),
                    skipped=len(records) - len(valid_records),
                )
            )
            if valid_records:
                pending.setdefault(collection, {})[address] = valid_records
        if not pending:
            raise EmptyImportPayloadError(
                "После фильтрации не осталось ни одной записи для импорта"
            )

        # self.repo.create_index(collection, ADDRESS_FIELD, unique=True)
        for collection, by_address in pending.items():
            self.repo.create_index(collection, ADDRESS_FIELD, unique=True)
            for address, results in by_address.items():
                self.repo.upsert_results(
                    collection=collection, address=address, results=results
                )

        return ImportSummary(
            addresses=stats,
            total_imported=sum(s.imported for s in stats),
            total_skipped=sum(s.skipped for s in stats),
        )
