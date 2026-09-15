from __future__ import annotations

import json
from pathlib import PurePosixPath

from pydantic import ValidationError

from app.errors import EmptyImportPayloadError, InvalidImportFileError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.imports import AddressImportStats, ImportPayload, ImportSummary, ScanRecord

ADDRESS_FIELD = "address"


class ImportService:
    """Фильтрует невалидные записи и сохраняет результаты сканирования по доменам."""

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo

    @staticmethod
    def _is_valid(record: ScanRecord) -> bool:
        """Запись валидна, если есть непустые данные и нет ошибки."""
        return bool(record.data) and not record.error

    @staticmethod
    def domain_from_filename(filename: str) -> str:
        """Домен/IP — имя файла без расширения, например 'example.com.json' -> 'example.com'."""
        stem = PurePosixPath(filename).stem
        return stem or filename

    def parse_file(self, filename: str, content: bytes) -> tuple[str, list[ScanRecord]]:
        """Разбирает один загруженный файл в (домен, список результатов сканирования)."""
        domain = self.domain_from_filename(filename)
        try:
            raw = json.loads(content)
        except json.JSONDecodeError as exc:
            raise InvalidImportFileError(f"Файл '{filename}': некорректный JSON ({exc})") from exc

        if not isinstance(raw, list):
            raise InvalidImportFileError(f"Файл '{filename}': ожидается JSON-массив результатов")

        try:
            records = [ScanRecord.model_validate(item) for item in raw]
        except ValidationError as exc:
            raise InvalidImportFileError(f"Файл '{filename}': {exc}") from exc

        return domain, records

    def import_files(self, collection: str, files: dict[str, bytes]) -> ImportSummary:
        """Разбирает набор файлов (имя -> содержимое) и импортирует их одной транзакцией записи."""
        payload_root: dict[str, list[ScanRecord]] = {}
        for filename, content in files.items():
            domain, records = self.parse_file(filename, content)
            payload_root.setdefault(domain, []).extend(records)

        return self.import_records(collection, ImportPayload(payload_root))

    def import_records(self, collection: str, payload: ImportPayload) -> ImportSummary:
        """Фильтрует записи и мёржит результаты по каждому адресу (ipv4/ipv6/домен/MAC)."""
        stats: list[AddressImportStats] = []
        pending: dict[str, list[dict]] = {}

        for address, records in payload.root.items():
            valid_records = [record.model_dump() for record in records if self._is_valid(record)]
            stats.append(
                AddressImportStats(
                    address=address,
                    received=len(records),
                    imported=len(valid_records),
                    skipped=len(records) - len(valid_records),

                )
            )
            if valid_records:
                pending[address] = valid_records
        if not pending:
            raise EmptyImportPayloadError("После фильтрации не осталось ни одной записи для импорта")

        self.repo.create_index(collection, ADDRESS_FIELD, unique=True)
        for address, results in pending.items():
            self.repo.upsert_results(collection=collection, address=address, results=results)

        return ImportSummary(
            addresses=stats,
            total_imported=sum(s.imported for s in stats),
            total_skipped=sum(s.skipped for s in stats)
        )
