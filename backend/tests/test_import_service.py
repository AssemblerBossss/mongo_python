from unittest.mock import MagicMock

import pytest

from app.errors import EmptyImportPayloadError, InvalidImportFileError
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
    assert summary.addresses[0].address == "example.com"

    repo_mock.create_index.assert_called_once_with("scan_results", "address", unique=True)
    repo_mock.insert_many.assert_called_once()
    repo_mock.upsert_results.assert_called_once_with(
        "scan_results",
        "example.com",
        [{"instance": "a", "result": True, "data_type": "ip", "data": {"ip": "1.1.1.1"}, "error": None}],
    )


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

    repo_mock.upsert_results.assert_not_called()


def test_parse_file_rejects_invalid_json(service: ImportService) -> None:
    with pytest.raises(InvalidImportFileError):
        service.parse_file("example.com.json", b"not json")


def test_parse_file_rejects_non_dict_payload(service: ImportService) -> None:
    with pytest.raises(InvalidImportFileError):
        service.parse_file("a1b2c3.json", b'[{"instance": "a"}]')


def test_import_files_groups_by_address_from_content(service: ImportService, repo_mock: MagicMock) -> None:
    files = {
        "9f8a1c.json": (
            b'{"example.com": [{"instance": "a", "result": true, "data_type": "ip", "data": {"ip": "1.1.1.1"}}]}'
        ),
        "6b02de.json": (
            b'{"1.2.3.4": [{"instance": "b", "result": true, "data_type": "ip", "data": {"ip": "2.2.2.2"}}]}'
        ),
    }

    summary = service.import_files("scan_results", files)

    assert summary.total_imported == 2
    assert summary.total_skipped == 0
    assert {s.address for s in summary.addresses} == {"example.com", "1.2.3.4"}
    assert repo_mock.upsert_results.call_count == 2


def test_import_files_merges_same_address_from_different_files(
        service: ImportService, repo_mock: MagicMock
) -> None:
    """Два файла с разными (хэш-подобными) именами, но одним адресом внутри —
    должны схлопнуться в один вызов upsert_results с обоими результатами."""
    files = {
        "9f8a1c.json": (
            b'{"89.99.117.132": [{"instance": "a", "result": true, "data_type": "ipv4", "data": {"x": 1}}]}'
        ),
        "6b02de.json": (
            b'{"89.99.117.132": [{"instance": "b", "result": true, "data_type": "ipv4", "data": {"y": 2}}]}'
        ),
    }

    summary = service.import_files("scan_results", files)

    assert summary.total_imported == 2
    assert repo_mock.upsert_results.call_count == 1
    called_collection, called_address, called_results = repo_mock.upsert_results.call_args[0]
    assert called_collection == "scan_results"
    assert called_address == "89.99.117.132"
    assert {r["instance"] for r in called_results} == {"a", "b"}
