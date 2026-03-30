from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_v1_admin():
    resp = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("data", {}).get("access_token") is not None


def test_v1_users_me_with_admin_token():
    login = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    token = login["data"]["access_token"]
    resp = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json().get("data", {}).get("email") == "admin@financetracker.com"
