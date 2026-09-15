from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.database import get_mongo_client
from app.main import create_app
from app.routers import health as health_router


def test_health_ok() -> None:
    client = TestClient(create_app())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_ok(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health_router, "ping", lambda _client: True)
    app = create_app()
    app.dependency_overrides[get_mongo_client] = lambda: MagicMock()
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 200


def test_ready_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(health_router, "ping", lambda _client: False)
    app = create_app()
    app.dependency_overrides[get_mongo_client] = lambda: MagicMock()
    client = TestClient(app)

    response = client.get("/ready")
    assert response.status_code == 503
