from unittest.mock import AsyncMock

import pytest

from app.errors import EmptyImportPayloadError, InvalidImportFileError
from app.repositories.mongo_repository import MongoRepository
from app.schemas.imports import ImportPayload
from app.services.import_service import ImportService


@pytest.fixture
def repo_mock() -> AsyncMock:
    return AsyncMock(spec=MongoRepository)


@pytest.fixture
def service(repo_mock: AsyncMock) -> ImportService:
    return ImportService(repo_mock)


async def test_filters_empty_data_and_non_empty_error(
    service: ImportService, repo_mock: AsyncMock
) -> None:
    payload = ImportPayload.model_validate(
        {
            "example.com": [
                {
                    "instance": "a",
                    "result": True,
                    "data_type": "ip",
                    "data": {"ip": "1.1.1.1"},
                    "error": None,
                },
                {
                    "instance": "b",
                    "result": False,
                    "data_type": "ip",
                    "data": {},
                    "error": None,
                },
                {
                    "instance": "c",
                    "result": False,
                    "data_type": "ip",
                    "data": {"ip": "2.2.2.2"},
                    "error": "timeout",
                },
            ]
        }
    )

    summary = await service.import_records(payload)

    assert summary.total_imported == 1
    assert summary.total_skipped == 2
    assert summary.addresses[0].address == "example.com"
    assert summary.addresses[0].collection == "domains"

    repo_mock.create_index.assert_called_once_with("domains", "address", unique=True)
    repo_mock.upsert_results_bulk.assert_called_once_with(
        "domains",
        {
            "example.com": [
                {
                    "instance": "a",
                    "result": True,
                    "data_type": "ip",
                    "data": {"ip": "1.1.1.1"},
                    "error": None,
                }
            ]
        },
    )


async def test_raises_when_nothing_left_after_filtering(
    service: ImportService, repo_mock: AsyncMock
) -> None:
    payload = ImportPayload.model_validate(
        {
            "example.com": [
                {
                    "instance": "a",
                    "result": False,
                    "data_type": "ip",
                    "data": {},
                    "error": "timeout",
                },
            ]
        }
    )

    with pytest.raises(EmptyImportPayloadError):
        await service.import_records(payload)

    repo_mock.upsert_results_bulk.assert_not_called()


async def test_parse_file_rejects_invalid_json(service: ImportService) -> None:
    with pytest.raises(InvalidImportFileError):
        service.parse_file("example.com.json", b"not json")


async def test_parse_file_rejects_non_dict_payload(service: ImportService) -> None:
    with pytest.raises(InvalidImportFileError):
        service.parse_file("a1b2c3.json", b'[{"instance": "a"}]')


async def test_import_files_groups_by_address_from_content(
    service: ImportService, repo_mock: AsyncMock
) -> None:
    files = {
        "9f8a1c.json": (
            b'{"example.com": [{"instance": "a", "result": true, "data_type": "ip", "data": {"ip": "1.1.1.1"}}]}'
        ),
        "6b02de.json": (
            b'{"1.2.3.4": [{"instance": "b", "result": true, "data_type": "ip", "data": {"ip": "2.2.2.2"}}]}'
        ),
    }

    summary = await service.import_files(files)

    assert summary.total_imported == 2
    assert summary.total_skipped == 0
    assert {s.address for s in summary.addresses} == {"example.com", "1.2.3.4"}
    assert repo_mock.upsert_results_bulk.call_count == 2


async def test_import_files_merges_same_address_from_different_files(
    service: ImportService, repo_mock: AsyncMock
) -> None:
    """Два файла с разными (хэш-подобными) именами, но одним адресом внутри —
    должны схлопнуться в один вызов upsert_results_bulk с обоими результатами."""
    files = {
        "9f8a1c.json": (
            b'{"89.99.117.132": [{"instance": "a", "result": true, "data_type": "ipv4", "data": {"x": 1}}]}'
        ),
        "6b02de.json": (
            b'{"89.99.117.132": [{"instance": "b", "result": true, "data_type": "ipv4", "data": {"y": 2}}]}'
        ),
    }

    summary = await service.import_files(files)

    assert summary.total_imported == 2
    assert repo_mock.upsert_results_bulk.call_count == 1
    args, _ = repo_mock.upsert_results_bulk.call_args
    collection, by_address = args
    assert collection == "ip_addresses"
    assert {r["instance"] for r in by_address["89.99.117.132"]} == {"a", "b"}


async def test_routes_different_address_types_to_different_collections(
    service: ImportService, repo_mock: AsyncMock
) -> None:
    payload = ImportPayload.model_validate(
        {
            "example.com": [
                {
                    "instance": "a",
                    "result": True,
                    "data_type": "domain",
                    "data": {"x": 1},
                }
            ],
            "1.2.3.4": [
                {
                    "instance": "b",
                    "result": True,
                    "data_type": "ipv4",
                    "data": {"y": 2},
                }
            ],
            "aa:bb:cc:dd:ee:ff": [
                {
                    "instance": "c",
                    "result": True,
                    "data_type": "mac",
                    "data": {"z": 3},
                }
            ],
        }
    )

    summary = await service.import_records(payload)

    assert summary.total_imported == 3
    by_address = {s.address: s.collection for s in summary.addresses}
    assert by_address == {
        "example.com": "domains",
        "1.2.3.4": "ip_addresses",
        "aa:bb:cc:dd:ee:ff": "mac_addresses",
    }

    created_indexes = {call.args[0] for call in repo_mock.create_index.call_args_list}
    assert created_indexes == {"domains", "ip_addresses", "mac_addresses"}
    assert repo_mock.upsert_results_bulk.call_count == 3
