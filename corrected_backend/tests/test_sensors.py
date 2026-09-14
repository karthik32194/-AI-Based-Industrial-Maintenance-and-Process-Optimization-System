"""
API tests for Sensor Data — Section 7.3
Tests: ingest reading, validation, history retrieval.
"""
import pytest


@pytest.fixture
def machine_id(client, auth_headers):
    resp = client.post("/api/machines", json={
        "machine_name": "Test Pump",
        "machine_type": "Pump",
        "location": "Zone A",
    }, headers=auth_headers)
    return resp.json()["id"]


def test_ingest_sensor_reading(client, auth_headers, machine_id):
    response = client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json={"temperature": 85.0, "vibration": 4.2, "pressure": 6.0, "rpm": 1800.0, "power_consumption": 55.0},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["temperature"] == 85.0
    assert data["machine_id"] == machine_id
    assert data["is_valid"] is True


def test_ingest_requires_at_least_one_channel(client, auth_headers, machine_id):
    response = client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json={},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_list_sensor_readings(client, auth_headers, machine_id):
    client.post(
        f"/api/machines/{machine_id}/sensor-readings",
        json={"temperature": 90.0},
        headers=auth_headers,
    )
    response = client.get(
        f"/api/machines/{machine_id}/sensor-readings",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


def test_sensor_reading_machine_not_found(client, auth_headers):
    response = client.post(
        "/api/machines/00000000-0000-0000-0000-000000000000/sensor-readings",
        json={"temperature": 80.0},
        headers=auth_headers,
    )
    assert response.status_code == 404
