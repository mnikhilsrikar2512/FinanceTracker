from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_rbac_users_list_admin_only():
    # Admin should be able to list users
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    admin_token = admin_login["data"]["access_token"]
    resp_admin = client.get("/api/v1/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200

    # Regular user should be forbidden
    user_login = client.post("/api/v1/auth/login", json={"email": "john@example.com", "password": "john123"}).json()
    user_token = user_login["data"]["access_token"]
    resp_user = client.get("/api/v1/users", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403 or resp_user.status_code == 401


def test_rbac_logs_admin_only():
    # Admin can access logs
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    admin_token = admin_login["data"]["access_token"]
    resp_admin = client.get("/api/v1/logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200

    # Non-admin should be forbidden
    user_login = client.post("/api/v1/auth/login", json={"email": "john@example.com", "password": "john123"}).json()
    user_token = user_login["data"]["access_token"]
    resp_user = client.get("/api/v1/logs", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403 or resp_user.status_code == 401


def test_rbac_admin_dashboard():
    # Admin access
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    admin_token = admin_login["data"]["access_token"]
    resp_admin = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_admin.status_code == 200

    # Non-admin access denied
    user_login = client.post("/api/v1/auth/login", json={"email": "john@example.com", "password": "john123"}).json()
    user_token = user_login["data"]["access_token"]
    resp_user = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_user.status_code == 403 or resp_user.status_code == 401


def test_rbac_transactions_admin_view():
    admin_login = client.post("/api/v1/auth/login", json={"email": "admin@financetracker.com", "password": "admin123"}).json()
    admin_token = admin_login["data"]["access_token"]
    resp = client.get("/api/v1/transactions", headers={"Authorization": f"Bearer {admin_token}"})
    # Admin should be able to view transactions
    assert resp.status_code == 200
