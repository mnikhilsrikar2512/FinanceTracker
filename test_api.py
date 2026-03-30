from fastapi.testclient import TestClient
from app.main import app
import time

client = TestClient(app)

_token_cache = {}
_last_request_time = 0

def rate_limit_delay():
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < 0.5:
        time.sleep(0.5)
    _last_request_time = time.time()


def get_token(email: str, password: str) -> str:
    if email in _token_cache:
        return _token_cache[email]
    rate_limit_delay()
    response = client.post("/auth/login", json={"email": email, "password": password})
    for _ in range(3):
        if response.status_code == 429:
            time.sleep(3)
            response = client.post("/auth/login", json={"email": email, "password": password})
        else:
            break
    if response.status_code == 200 and "data" in response.json():
        token = response.json()["data"].get("access_token")
        if token:
            _token_cache[email] = token
            return token
    raise Exception(f"Failed to get token: {response.status_code} - {response.text}")


def create_user(name: str, email: str, password: str):
    rate_limit_delay()
    response = client.post("/auth/signup", json={
        "name": name,
        "email": email,
        "password": password
    })
    for _ in range(3):
        if response.status_code == 429:
            time.sleep(3)
            response = client.post("/auth/signup", json={
                "name": name,
                "email": email,
                "password": password
            })
        else:
            break
    if response.status_code != 200:
        raise Exception(f"Signup failed: {response.status_code} - {response.text}")
    return get_token(email, password)


def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "OK" or data.get("success") == True


def test_signup_login_flow():
    unique_email = f"fullflow_{int(time.time())}@test.com"
    create_user("Full Flow User", unique_email, "password123")
    token = get_token(unique_email, "password123")
    assert token is not None
    
    response = client.get("/users/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    response = client.put("/users/me", 
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Updated Name"}
    )
    assert response.status_code == 200


def test_categories():
    unique_email = f"catflow_{int(time.time())}@test.com"
    token = create_user("Cat Flow User", unique_email, "password123")
    
    cat_name = f"TestCat_{int(time.time())}"
    response = client.post("/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": cat_name, "type": "expense"}
    )
    assert response.status_code == 200
    
    response = client.get("/categories", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_transactions_crud():
    unique_email = f"txnflow_{int(time.time())}@test.com"
    token = create_user("Txn Flow User", unique_email, "password123")
    
    cat_response = client.get("/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cat_response.json()["data"][0]["id"]
    
    response = client.post("/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "category_id": cat_id,
            "amount": 1000.00,
            "description": "Test transaction",
            "date": "2024-01-15T10:00:00"
        }
    )
    assert response.status_code == 200
    txn_id = response.json()["data"]["id"]
    
    response = client.get("/transactions", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    response = client.put(f"/transactions/{txn_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"amount": 1500.00}
    )
    assert response.status_code == 200


def test_soft_delete():
    unique_email = f"soft_{int(time.time())}@test.com"
    token = create_user("Soft User", unique_email, "password123")
    
    cat_response = client.get("/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cat_response.json()["data"][0]["id"]
    
    response = client.post("/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={"category_id": cat_id, "amount": 50, "description": "To delete", "date": "2024-01-15T10:00:00"}
    )
    txn_id = response.json()["data"]["id"]
    
    response = client.delete(f"/transactions/{txn_id}?soft=true",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_hard_delete():
    unique_email = f"hard_{int(time.time())}@test.com"
    token = create_user("Hard User", unique_email, "password123")
    
    cat_response = client.get("/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cat_response.json()["data"][0]["id"]
    
    response = client.post("/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={"category_id": cat_id, "amount": 100, "description": "To hard delete", "date": "2024-01-15T10:00:00"}
    )
    txn_id = response.json()["data"]["id"]
    
    response = client.delete(f"/transactions/{txn_id}?hard=true",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_bulk_delete():
    unique_email = f"bulk_{int(time.time())}@test.com"
    token = create_user("Bulk User", unique_email, "password123")
    
    cat_response = client.get("/categories", headers={"Authorization": f"Bearer {token}"})
    cat_id = cat_response.json()["data"][0]["id"]
    
    ids = []
    for i in range(2):
        response = client.post("/transactions",
            headers={"Authorization": f"Bearer {token}"},
            json={"category_id": cat_id, "amount": 10+i, "description": f"Bulk {i}", "date": "2024-01-15T10:00:00"}
        )
        ids.append(str(response.json()["data"]["id"]))
    
    response = client.delete(f"/transactions?ids={','.join(ids)}",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_export_csv():
    unique_email = f"export_{int(time.time())}@test.com"
    token = create_user("Export User", unique_email, "password123")
    
    response = client.get("/transactions/export",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert "text/csv" in response.headers.get("content-type", "")


def test_analytics():
    unique_email = f"analytics_{int(time.time())}@test.com"
    token = create_user("Analytics User", unique_email, "password123")
    
    for endpoint in ["/summary", "/summary/by-category", "/summary/monthly", "/summary/dashboard", "/summary/insights"]:
        response = client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200, f"Failed: {endpoint}"


def test_logs():
    unique_email = f"logsuser_{int(time.time())}@test.com"
    token = create_user("Logs User", unique_email, "password123")
    
    response = client.get("/logs", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    
    response = client.get("/logs?action=USER_SIGNUP&sort_order=-1&limit=5",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_category_reassignment():
    unique_email = f"reassign_{int(time.time())}@test.com"
    token = create_user("Reassign User", unique_email, "password123")
    
    cat1 = client.post("/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": f"ToDelete_{int(time.time())}", "type": "expense"}
    )
    cat2 = client.post("/categories",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": f"Keep_{int(time.time())}", "type": "expense"}
    )
    
    cat1_id = cat1.json()["data"]["id"]
    cat2_id = cat2.json()["data"]["id"]
    
    client.post("/transactions",
        headers={"Authorization": f"Bearer {token}"},
        json={"category_id": cat1_id, "amount": 50, "description": "Test", "date": "2024-01-15T10:00:00"}
    )
    
    response = client.delete(f"/categories/{cat1_id}?reassign_to={cat2_id}",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_recent_transactions():
    unique_email = f"recent_{int(time.time())}@test.com"
    token = create_user("Recent User", unique_email, "password123")
    
    response = client.get("/transactions/recent?limit=5",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_transaction_filters():
    unique_email = f"filter_{int(time.time())}@test.com"
    token = create_user("Filter User", unique_email, "password123")
    
    response = client.get("/transactions?type=expense&min_amount=10&max_amount=500&sort_by=amount&sort_order=desc",
        headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200


def test_change_password():
    unique_email = f"chpass_{int(time.time())}@test.com"
    create_user("Chpass User", unique_email, "oldpass")
    token = get_token(unique_email, "oldpass")
    
    response = client.post("/auth/change-password", 
        headers={"Authorization": f"Bearer {token}"},
        json={"old_password": "oldpass", "new_password": "newpass123"}
    )
    assert response.status_code == 200


def test_forgot_password():
    response = client.post("/auth/forgot-password", json={
        "email": "notexists@test.com"
    })
    assert response.status_code in [200, 429]


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
