from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_admin():
    resp = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("data", {}).get("access_token") is not None


def test_users_me_with_admin_token():
    login = client.post("/api/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    token = login["data"]["access_token"]
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json().get("data", {}).get("email") == "admin@financetracker.com"


def test_invalid_token_denies_access():
    resp = client.get("/api/users/me", headers={"Authorization": "Bearer invalid_token"})
    assert resp.status_code == 401 or resp.status_code == 403


def test_admin_endpoint_requires_admin():
    # Admin token
    admin_login = client.post("/api/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    admin_token = admin_login["data"]["access_token"]
    resp_admin = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200

    # Regular user token
    user_login = client.post("/api/auth/login", json={"email": "john@example.com", "password": "john123"}).json()
    user_token = user_login["data"]["access_token"]
    resp_user = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403 or resp_user.status_code == 401


def test_login_v1_endpoint():
    resp = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("data", {}).get("access_token") is not None
