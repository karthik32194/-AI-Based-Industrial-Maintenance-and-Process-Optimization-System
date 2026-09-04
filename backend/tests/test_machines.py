"""
API tests for Machine CRUD — Section 7.2
Tests: create, list, get, update, deactivate, search/filter.
"""
import pytest


@pytest.fixture
def machine_payload():
    return {
        "machine_name": "Compressor Unit A1",
        "machine_type": "Compressor",
        "location": "Plant Floor 1",
        "status": "OPERATIONAL",
        "model_number": "COMP-2024",
        "manufacturer": "Acme Industrial",
    }


def test_create_machine(client, auth_headers, machine_payload):
    response = client.post("/api/machines", json=machine_payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["machine_name"] == machine_payload["machine_name"]
    assert data["status"] == "OPERATIONAL"
    assert "id" in data


def test_list_machines(client, auth_headers, machine_payload):
    client.post("/api/machines", json=machine_payload, headers=auth_headers)
    response = client.get("/api/machines", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert isinstance(data["items"], list)


def test_get_machine(client, auth_headers, machine_payload):
    create_resp = client.post("/api/machines", json=machine_payload, headers=auth_headers)
    machine_id = create_resp.json()["id"]

    response = client.get(f"/api/machines/{machine_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == machine_id


def test_get_machine_not_found(client, auth_headers):
    response = client.get(
        "/api/machines/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert response.status_code == 404


def test_update_machine(client, auth_headers, machine_payload):
    create_resp = client.post("/api/machines", json=machine_payload, headers=auth_headers)
    machine_id = create_resp.json()["id"]

    response = client.put(
        f"/api/machines/{machine_id}",
        json={"location": "Plant Floor 2", "status": "UNDER_MAINTENANCE"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["location"] == "Plant Floor 2"
    assert response.json()["status"] == "UNDER_MAINTENANCE"


def test_deactivate_machine(client, auth_headers, machine_payload):
    create_resp = client.post("/api/machines", json=machine_payload, headers=auth_headers)
    machine_id = create_resp.json()["id"]

    response = client.delete(f"/api/machines/{machine_id}", headers=auth_headers)
    assert response.status_code == 204

    # Verify status is DECOMMISSIONED
    get_resp = client.get(f"/api/machines/{machine_id}", headers=auth_headers)
    assert get_resp.json()["status"] == "DECOMMISSIONED"


def test_search_machines(client, auth_headers, machine_payload):
    client.post("/api/machines", json=machine_payload, headers=auth_headers)
    response = client.get(
        "/api/machines?search=Compressor", headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["total"] >= 1
