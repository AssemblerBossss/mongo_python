"""Smoke-тест эндпоинта импорта (с моком ImportService, без реальной Mongo)."""
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_import_service
from app.main import create_app
from app.schemas.imports import DomainImportStats, ImportSummary
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
        domains=[DomainImportStats(domain="example.com", received=2, imported=1, skipped=1)],
        total_imported=1,
        total_skipped=1,
    )

    response = client.post(
        "/api/collections/scan_results/import",
        json={
            "example.com": [
                {"instance": "a", "result": True, "data_type": "ip", "data": {"ip": "1.1.1.1"}, "error": None},
                {"instance": "b", "result": False, "data_type": "ip", "data": {}, "error": "timeout"},
            ]
        },
    )

    assert response.status_code == 201
    assert response.json()["total_imported"] == 1
    assert response.json()["total_skipped"] == 1
