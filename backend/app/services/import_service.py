"""Сервис массовой загрузки результатов сканирования, сгруппированных по доменам."""
from __future__ import annotations

from app.errors import EmptyImportPayloadError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.imports import DomainImportStats, ImportPayload, ImportSummary, ScanRecord

DOMAIN_INDEX_FIELD = "domain"


class ImportService:
    """Фильтрует невалидные записи и сохраняет результаты сканирования по доменам."""

    def __init__(self, repo: MongoRepository) -> None:
        self.repo = repo

    @staticmethod
    def _is_valid(record: ScanRecord) -> bool:
        """Запись валидна, если есть непустые данные и нет ошибки."""
        return bool(record.data) and not record.error

    def import_records(self, collection: str, payload: ImportPayload) -> ImportSummary:
        """Фильтрует, нормализует ({domain, records}) и сохраняет записи в коллекцию."""
        stats: list[DomainImportStats] = []
        documents: list[dict] = []

        for domain, records in payload.root.items():
            valid_records = [record.model_dump() for record in records if self._is_valid(record)]
            stats.append(
                DomainImportStats(
                    domain=domain,
                    received=len(records),
                    imported=len(valid_records),
                    skipped=len(records) - len(valid_records),
                )
            )
            if valid_records:
                documents.append({DOMAIN_INDEX_FIELD: domain, "records": valid_records})

        if not documents:
            raise EmptyImportPayloadError("После фильтрации не осталось ни одной записи для импорта")

        self.repo.create_index(collection, DOMAIN_INDEX_FIELD)
        self.repo.insert_many(collection, documents)

        return ImportSummary(
            domains=stats,
            total_imported=sum(s.imported for s in stats),
            total_skipped=sum(s.skipped for s in stats),
        )
