"""
Unit + API tests for authentication — Section 7.1
Tests: register, login, JWT, duplicate email, invalid credentials, /me endpoint.
"""
import pytest


def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "name": "Alice Engineer",
        "email": "alice@example.com",
        "password": "SecurePass1",
        "role": "MAINTENANCE_ENGINEER",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "alice@example.com"
    assert data["role"] == "MAINTENANCE_ENGINEER"
    assert "password_hash" not in data  # Never expose hash


def test_register_duplicate_email(client):
    payload = {"name": "Bob", "email": "bob@example.com", "password": "Pass1234"}
    client.post("/api/auth/register", json=payload)
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409


def test_register_weak_password(client):
    response = client.post("/api/auth/register", json={
        "name": "Carol",
        "email": "carol@example.com",
        "password": "nodigits",
    })
    assert response.status_code == 422


def test_login_success(client):
    client.post("/api/auth/register", json={
        "name": "Dave",
        "email": "dave@example.com",
        "password": "DavePass1",
    })
    response = client.post("/api/auth/login", json={
        "email": "dave@example.com",
        "password": "DavePass1",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "dave@example.com"


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={
        "name": "Eve",
        "email": "eve@example.com",
        "password": "EvePass1",
    })
    response = client.post("/api/auth/login", json={
        "email": "eve@example.com",
        "password": "WrongPassword1",
    })
    assert response.status_code == 401


def test_get_me(client, auth_headers):
    response = client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    assert "email" in response.json()


def test_get_me_no_token(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
