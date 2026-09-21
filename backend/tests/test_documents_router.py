from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

HIDDEN = {"results.data.raw_payload": 0}


def test_list_hides_heavy_fields_by_default(
    client: TestClient, mongo_service_mock: AsyncMock
) -> None:
    mongo_service_mock.find.return_value = ([{"_id": "1", "address": "1.1.1.1"}], 1)

    response = client.get("/api/collections/ip_addresses/documents")

    assert response.status_code == 200
    assert mongo_service_mock.find.call_args.kwargs["projection"] == HIDDEN
    assert response.json()["hidden_fields"] == ["results.data.raw_payload"]


def test_list_hides_heavy_fields_for_address_search(
    client: TestClient, mongo_service_mock: AsyncMock
) -> None:
    mongo_service_mock.find.return_value = ([], 0)

    response = client.get(
        "/api/collections/ip_addresses/documents", params={"address": "1.1.1.1"}
    )

    assert response.status_code == 200
    assert mongo_service_mock.find.call_args.kwargs["projection"] == HIDDEN
    assert response.json()["hidden_fields"] == ["results.data.raw_payload"]


def test_list_keeps_user_projection(
    client: TestClient, mongo_service_mock: AsyncMock
) -> None:
    mongo_service_mock.find.return_value = ([], 0)

    response = client.get(
        "/api/collections/ip_addresses/documents",
        params={"project": '{"address": 1}'},
    )

    assert response.status_code == 200
    assert mongo_service_mock.find.call_args.kwargs["projection"] == {"address": 1}
    assert response.json()["hidden_fields"] == []


def test_get_document_returns_full_document(
    client: TestClient, mongo_service_mock: AsyncMock
) -> None:
    doc = {"_id": "1", "results": [{"data": {"raw_payload": "abcd"}}]}
    mongo_service_mock.get.return_value = doc

    response = client.get("/api/collections/ip_addresses/documents/1")

    assert response.status_code == 200
    assert response.json() == doc
