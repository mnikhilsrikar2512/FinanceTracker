from fastapi.testclient import TestClient
from app.main import app
import json

client = TestClient(app)

def _login(email, password):
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    data = resp.json()
    return data["data"]["access_token"]


def test_transactions_rbac_create_update_delete():
    admin_token = _login("admin@financetracker.com", "admin123")
    user_token = _login("john@example.com", "john123")

    # 1) User creates a transaction (own)
    payload = {
        "category_id": 1,
        "amount": 50.0,
        "description": "test create",
        "date": __import__('datetime').datetime.utcnow().isoformat()
    }
    resp = client.post("/api/v1/transactions", headers={"Authorization": f"Bearer {user_token}"}, json=payload)
    assert resp.status_code == 200
    created = resp.json().get("data", {})
    user_me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {user_token}"}).json()
    user_id = user_me.get("data", {}).get("id")
    assert user_id is not None
    assert created.get("user_id") == user_id

    # 2) User tries to set a different user_id in payload (invalid field) -> 422
    payload_bad = dict(payload)
    payload_bad["user_id"] = 999999
    resp2 = client.post("/api/v1/transactions", headers={"Authorization": f"Bearer {user_token}"}, json=payload_bad)
    assert resp2.status_code in (422, 400)

    # 3) Admin creates a transaction (should be allowed)
    payload2 = {
        "category_id": 1,
        "amount": 100.0,
        "description": "admin create",
        "date": __import__('datetime').datetime.utcnow().isoformat()
    }
    resp3 = client.post("/api/v1/transactions", headers={"Authorization": f"Bearer {admin_token}"}, json=payload2)
    assert resp3.status_code == 200

    # 4) Update/ownership tests
    admin_create = resp3.json().get("data", {})
    admin_txn_id = admin_create.get("id")
    # Admin updates any (should pass)
    resp_up_admin = client.put(f"/api/v1/transactions/{admin_txn_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={"amount": 120})
    assert resp_up_admin.status_code == 200
    # User updates own existing txn (from step 1)
    txn_id = created.get("id")
    resp_up_user = client.put(f"/api/v1/transactions/{txn_id}", headers={"Authorization": f"Bearer {user_token}"}, json={"amount": 60})
    assert resp_up_user.status_code == 200
    # User tries to update admin's txn (should be forbidden)
    resp_forbidden = client.put(f"/api/v1/transactions/{admin_txn_id}", headers={"Authorization": f"Bearer {user_token}"}, json={"amount": 999})
    assert resp_forbidden.status_code in (403, 401)

    # 5) Delete ownership checks
    # User deletes own
    resp_del_own = client.delete(f"/api/v1/transactions/{txn_id}?mode=soft", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_del_own.status_code == 200
    # User tries to delete admin's tx
    resp_del_forbidden = client.delete(f"/api/v1/transactions/{admin_txn_id}?mode=soft", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_del_forbidden.status_code in (403, 401)
    # Admin deletes admin's tx
    resp_del_admin = client.delete(f"/api/v1/transactions/{admin_txn_id}?mode=soft", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_del_admin.status_code in (200, 204, 202)

def test_transactions_rbac_update_delete_ownership():
    admin_token = _login("admin@financetracker.com", "admin123")
    user_token = _login("john@example.com", "john123")

    # Create a transaction as user for ownership testing
    payload = {
        "category_id": 1,
        "amount": 25.0,
        "description": "owner tx",
        "date": __import__('datetime').datetime.utcnow().isoformat()
    }
    resp = client.post("/api/v1/transactions", headers={"Authorization": f"Bearer {user_token}"}, json=payload)
    data = resp.json().get("data", {})
    txn_id = data.get("id")
    assert txn_id is not None

    # User updates own transaction
    resp_up = client.put(f"/api/v1/transactions/{txn_id}", headers={"Authorization": f"Bearer {user_token}"}, json={"amount": 30})
    assert resp_up.status_code == 200

    # User tries to update admin's transaction (create one by admin first to test ownership)
    resp_create_admin = client.post("/api/v1/transactions", headers={"Authorization": f"Bearer {admin_token}"}, json={"category_id":1,"amount":10,"description":"admin-owned","date":"2020-01-01T00:00:00"})
    admin_txn_id = resp_create_admin.json().get("data",{}).get("id")
    resp_forbidden = client.put(f"/api/v1/transactions/{admin_txn_id}", headers={"Authorization": f"Bearer {user_token}"}, json={"amount": 999})
    assert resp_forbidden.status_code in (403, 401)

    # Admin updates any
    resp_admin_up = client.put(f"/api/v1/transactions/{txn_id}", headers={"Authorization": f"Bearer {admin_token}"}, json={"amount": 40})
    assert resp_admin_up.status_code == 200

    # User deletes own
    resp_del = client.delete(f"/api/v1/transactions/{txn_id}?mode=soft", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_del.status_code == 200

    # User tries to delete admin's transaction
    resp_del_forced = client.delete(f"/api/v1/transactions/{admin_txn_id}?mode=soft", headers={"Authorization": f"Bearer {user_token}"})
    assert resp_del_forced.status_code in (403, 401)

    # Admin deletes admin's transaction
    resp_admin_del = client.delete(f"/api/v1/transactions/{admin_txn_id}?mode=soft", headers={"Authorization": f"Bearer {admin_token}"})
    # May be 200 or 204 depending on implementation
    assert resp_admin_del.status_code in (200, 204, 202)
