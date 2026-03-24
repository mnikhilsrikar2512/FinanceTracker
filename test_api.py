from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "OK"


def test_create_user():
    response = client.post("/users", json={
        "name": "Test User",
        "email": "testuser@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200


def test_duplicate_email():
    client.post("/users", json={
        "name": "User One",
        "email": "duplicate@example.com",
        "password": "testpass123"
    })
    response = client.post("/users", json={
        "name": "User Two",
        "email": "duplicate@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 409


def test_login():
    client.post("/users", json={
        "name": "Login User",
        "email": "login@example.com",
        "password": "testpass123"
    })
    response = client.post("/users/login", json={
        "email": "login@example.com",
        "password": "testpass123"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_invalid_category():
    response = client.post("/categories", json={
        "name": "Invalid",
        "type": "wrong"
    })
    assert response.status_code == 422


def test_category_invalid_type_rejected():
    response = client.post("/categories", json={
        "name": "Test",
        "type": "invalid"
    })
    assert response.status_code == 422
