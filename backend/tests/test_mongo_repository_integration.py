import os

import pytest
from pymongo import MongoClient

from app.repositories.mongo_repository import MongoRepository

MONGO_URI = os.environ.get("TEST_MONGO_URI", "mongodb://admin:admin@localhost:27017")


@pytest.fixture
def repo():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    try:
        client.admin.command("ping")
    except Exception:
        pytest.skip("MongoDB недоступна для интеграционного теста")

    db = client["test_import_merge"]
    db.drop_collection("scan_results")
    yield MongoRepository(db)
    client.drop_database("test_import_merge")
    client.close()


def test_new_service_result_appends_to_existing_document(repo: MongoRepository) -> None:
    repo.create_index("scan_results", "address", unique=True)

    first = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]
    repo.upsert_results("scan_results", "89.99.117.132", first)

    second = [
        {
            "instance": "VirusTotalChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"b": 2},
            "error": "",
        }
    ]
    repo.upsert_results("scan_results", "89.99.117.132", second)

    doc = repo.find_one("scan_results", {"address": "89.99.117.132"})
    assert doc is not None
    assert len(doc["results"]) == 2
    assert {r["instance"] for r in doc["results"]} == {
        "AbuseIPDBChecker",
        "VirusTotalChecker",
    }


def test_duplicate_result_from_same_service_is_not_added_twice(
    repo: MongoRepository,
) -> None:
    repo.create_index("scan_results", "address", unique=True)

    record = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]
    repo.upsert_results("scan_results", "89.99.117.132", record)
    repo.upsert_results("scan_results", "89.99.117.132", record)

    doc = repo.find_one("scan_results", {"address": "89.99.117.132"})
    assert len(doc["results"]) == 1


def test_concurrent_upsert_does_not_create_duplicate_documents(
    repo: MongoRepository,
) -> None:
    from concurrent.futures import ThreadPoolExecutor

    repo.create_index("scan_results", "address", unique=True)
    record = [
        {
            "instance": "AbuseIPDBChecker",
            "result": True,
            "data_type": "ipv4",
            "data": {"a": 1},
            "error": "",
        }
    ]

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(
            pool.map(
                lambda _: repo.upsert_results("scan_results", "89.99.117.132", record),
                range(8),
            )
        )

    docs = list(repo.db["scan_results"].find({"address": "89.99.117.132"}))
    assert len(docs) == 1
    assert len(docs[0]["results"]) == 1
