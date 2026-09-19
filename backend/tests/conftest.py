from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_mongo_service
from app.main import create_app
from app.services.mongo_service import MongoService


@pytest.fixture
def mongo_service_mock() -> AsyncMock:
    """Мок сервисного слоя MongoService."""
    return AsyncMock(spec=MongoService)


@pytest.fixture
def client(mongo_service_mock: AsyncMock) -> TestClient:
    """TestClient с подменённым MongoService."""
    app = create_app()
    app.dependency_overrides[get_mongo_service] = lambda: mongo_service_mock
    return TestClient(app)
