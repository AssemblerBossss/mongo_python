from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.repositories.mongo_repository import MongoRepository
from app.schemas.common import CollectionInfo, CollectionStats
from app.services.mongo_service import MongoService


def test_list_collections(client: TestClient, mongo_service_mock: AsyncMock) -> None:
    mongo_service_mock.list_collections.return_value = [
        CollectionInfo(name="sample", count=3),
    ]

    response = client.get("/api/collections")

    assert response.status_code == 200
    assert response.json() == [{"name": "sample", "count": 3}]


def test_collection_stats_returns_only_key_metrics(
    client: TestClient, mongo_service_mock: AsyncMock
) -> None:
    mongo_service_mock.collection_stats.return_value = CollectionStats(
        count=3,
        size=1123,
        avgObjSize=374,
        storageSize=20480,
        totalIndexSize=40960,
        totalSize=61440,
        nindexes=2,
        indexSizes={"_id_": 20480, "address_1": 20480},
    )

    response = client.get("/api/collections/domains/stats")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert body["indexSizes"] == {"_id_": 20480, "address_1": 20480}
    assert "wiredTiger" not in body


async def test_service_collection_stats_drops_extra_fields_and_computes_total() -> None:
    repo = AsyncMock(spec=MongoRepository)
    repo.collection_stats.return_value = {
        "ok": 1,
        "ns": "datasets.domains",
        "scaleFactor": 1,
        "wiredTiger": {"creationString": "x" * 1000},
        "count": 3,
        "size": 1123,
        "avgObjSize": 374,
        "storageSize": 20480,
        "totalIndexSize": 40960,
        "nindexes": 2,
        "capped": False,
        "indexSizes": {"_id_": 20480, "address_1": 20480},
    }
    service = MongoService(repo)
    service._ensure_collection_exists = AsyncMock()  # type: ignore[method-assign]

    stats = await service.collection_stats("domains")

    assert stats.totalSize == 61440
    assert stats.sharded is False
    assert set(stats.model_dump()) == set(CollectionStats.model_fields)
