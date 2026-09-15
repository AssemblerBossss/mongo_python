from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_import_service
from app.main import create_app
from app.schemas import AddressImportStats, ImportSummary
from app.services.import_service import ImportService


@pytest.fixture
def import_service_mock() -> MagicMock:
    return MagicMock(spec=ImportService)


@pytest.fixture
def client(import_service_mock: MagicMock) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_import_service] = lambda: import_service_mock
    return TestClient(app)


def test_import_documents(client: TestClient, import_service_mock: MagicMock) -> None:
    import_service_mock.import_records.return_value = ImportSummary(
        addresses=[
            AddressImportStats(address="example.com", received=2, imported=1, skipped=1)
        ],
        total_imported=1,
        total_skipped=1,
    )

    response = client.post(
        "/api/collections/scan_results/import",
        json={
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
                    "error": "timeout",
                },
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["total_imported"] == 1
    assert response.json()["total_skipped"] == 1


def test_import_files(client: TestClient, import_service_mock: MagicMock) -> None:
    import_service_mock.import_files.return_value = ImportSummary(
        addresses=[
            AddressImportStats(
                address="example.com", received=1, imported=1, skipped=0
            ),
            AddressImportStats(address="1.2.3.4", received=1, imported=1, skipped=0),
        ],
        total_imported=2,
        total_skipped=0,
    )

    example_com = b'[{"instance": "a", "result": true, "data_type": "ip", "data": {"ip": "1.1.1.1"}}]'
    ip_addr = b'[{"instance": "b", "result": true, "data_type": "ip", "data": {"ip": "2.2.2.2"}}]'

    response = client.post(
        "/api/collections/scan_results/import/files",
        files=[
            ("files", ("example.com.json", example_com, "application/json")),
            ("files", ("1.2.3.4.json", ip_addr, "application/json")),
        ],
    )

    assert response.status_code == 201
    assert response.json()["total_imported"] == 2
    import_service_mock.import_files.assert_called_once()
    called_collection, called_files = import_service_mock.import_files.call_args[0]
    assert called_collection == "scan_results"
    assert called_files == {"example.com.json": example_com, "1.2.3.4.json": ip_addr}
