"""Тесты фильтрации и нормализации в ImportService (репозиторий замокан)."""
from unittest.mock import MagicMock

import pytest

from app.errors import EmptyImportPayloadError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.imports import ImportPayload
from app.services.import_service import ImportService


@pytest.fixture
def repo_mock() -> MagicMock:
    return MagicMock(spec=MongoRepository)


@pytest.fixture
def service(repo_mock: MagicMock) -> ImportService:
    return ImportService(repo_mock)


def test_filters_empty_data_and_non_empty_error(service: ImportService, repo_mock: MagicMock) -> None:
    payload = ImportPayload.model_validate(
        {
            "example.com": [
                {"instance": "a", "result": True, "data_type": "ip", "data": {"ip": "1.1.1.1"}, "error": None},
                {"instance": "b", "result": False, "data_type": "ip", "data": {}, "error": None},
                {"instance": "c", "result": False, "data_type": "ip", "data": {"ip": "2.2.2.2"}, "error": "timeout"},
            ]
        }
    )

    summary = service.import_records("scan_results", payload)

    assert summary.total_imported == 1
    assert summary.total_skipped == 2
    assert summary.domains[0].domain == "example.com"

    repo_mock.create_index.assert_called_once_with("scan_results", "domain")
    repo_mock.insert_many.assert_called_once()
    inserted_collection, inserted_docs = repo_mock.insert_many.call_args[0]
    assert inserted_collection == "scan_results"
    assert inserted_docs == [
        {
            "domain": "example.com",
            "records": [
                {"instance": "a", "result": True, "data_type": "ip", "data": {"ip": "1.1.1.1"}, "error": None}
            ],
        }
    ]


def test_raises_when_nothing_left_after_filtering(service: ImportService, repo_mock: MagicMock) -> None:
    payload = ImportPayload.model_validate(
        {
            "example.com": [
                {"instance": "a", "result": False, "data_type": "ip", "data": {}, "error": "timeout"},
            ]
        }
    )

    with pytest.raises(EmptyImportPayloadError):
        service.import_records("scan_results", payload)

    repo_mock.insert_many.assert_not_called()
