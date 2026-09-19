from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.schemas.common import CollectionInfo


def test_list_collections(client: TestClient, mongo_service_mock: AsyncMock) -> None:
    mongo_service_mock.list_collections.return_value = [
        CollectionInfo(name="sample", count=3),
    ]

    response = client.get("/api/collections")

    assert response.status_code == 200
    assert response.json() == [{"name": "sample", "count": 3}]
