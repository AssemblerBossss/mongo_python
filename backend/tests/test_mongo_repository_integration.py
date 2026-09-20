import asyncio
import os

import pytest
from pymongo import AsyncMongoClient
from pymongo.errors import PyMongoError

from app.repositories.mongo_repository import MongoRepository

MONGO_URI = os.environ.get("TEST_MONGO_URI", "mongodb://admin:admin@localhost:27017")


@pytest.fixture
async def repo():
    client = AsyncMongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    try:
        await client.admin.command("ping")
    except PyMongoError:
        await client.close()
        pytest.skip("MongoDB недоступна для интеграционного теста")

    db = client["test_import_merge"]
    await db.drop_collection("scan_results")
    yield MongoRepository(db)
    await client.drop_database("test_import_merge")
    await client.close()


async def test_new_service_result_appends_to_existing_document(
    repo: MongoRepository,
) -> None:
    await repo.create_index("scan_results", "address", unique=True)

    first = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]
    await repo.upsert_results_bulk("scan_results", {"89.99.117.132": first})

    second = [
        {
            "instance": "VirusTotalChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"b": 2},
            "error": "",
        }
    ]
    await repo.upsert_results_bulk("scan_results", {"89.99.117.132": second})

    doc = await repo.find_one("scan_results", {"address": "89.99.117.132"})
    assert doc is not None
    assert len(doc["results"]) == 2
    assert {r["instance"] for r in doc["results"]} == {
        "AbuseIPDBChecker",
        "VirusTotalChecker",
    }


async def test_duplicate_result_from_same_service_is_not_added_twice(
    repo: MongoRepository,
) -> None:
    await repo.create_index("scan_results", "address", unique=True)

    record = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]
    await repo.upsert_results_bulk("scan_results", {"89.99.117.132": record})
    await repo.upsert_results_bulk("scan_results", {"89.99.117.132": record})

    doc = await repo.find_one("scan_results", {"address": "89.99.117.132"})
    assert len(doc["results"]) == 1


async def test_concurrent_upsert_does_not_create_duplicate_documents(
    repo: MongoRepository,
) -> None:
    await repo.create_index("scan_results", "address", unique=True)
    record = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]

    await asyncio.gather(
        *(
            repo.upsert_results_bulk("scan_results", {"89.99.117.132": record})
            for _ in range(8)
        )
    )

    docs = await repo.db["scan_results"].find({"address": "89.99.117.132"}).to_list()
    assert len(docs) == 1
    assert len(docs[0]["results"]) == 1
