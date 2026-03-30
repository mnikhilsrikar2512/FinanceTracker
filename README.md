# Personal Finance Tracker API

## Project Overview

This project is a **Personal Finance Tracker API** built using **FastAPI**, designed to manage user finances including income and expenses, categorize transactions, and maintain an audit trail using MongoDB.

The system uses:

- **SQL Server (Azure SQL Edge)** → Core transactional data
- **MongoDB** → Activity logging (audit trail)

---

## Tech Stack

- Python (FastAPI)
- SQL Server (Docker - Azure SQL Edge)
- MongoDB (Docker)
- SQLAlchemy ORM
- Pydantic v2
- PyODBC (ODBC Driver 18)
- JWT Authentication
- Bcrypt password hashing

---

## Architecture

The project follows a clean layered architecture:

```
Router → Service → Repository → Database
```

```
app/
├── routers/       # API route definitions
├── services/      # Business logic
├── repositories/  # Database operations
├── models/        # SQLAlchemy models
├── schemas/       # Pydantic schemas
├── core/          # Config, DB, Exceptions, Auth, Rate Limit, Email
```

---

## Features Implemented

### Authentication ✅
- User signup with email/password (EmailStr validation)
- User login with JWT token generation
- JWT token validation on protected routes
- Change password (with old password)
- **Forgot Password** - Request reset code via email
- **Reset Password** - Set new password with verification code
- Password hashing with bcrypt
- Role-based access control (user/admin)
- Rate limiting (60 req/min global, 5 login attempts/15min)

### Profile Management ✅
- Get user profile (`GET /users/me`)
- Update user profile (`PUT /users/me`)
- Delete account (`DELETE /users/me`)

### Transactions ✅
- Create/Read/Update/Delete transactions
- Transaction validation (amount > 0, valid category)
- Duplicate transaction prevention
- User-specific transaction access (security)
- **Transaction type** in response (income/expense)
- Audit fields: `created_by`, `modified_by`, `modified_at`
- Default sorting: `date desc`
- Recent transactions endpoint: `/transactions/recent`
- **Soft delete**: `DELETE /transactions/{id}?mode=soft` (archives transaction)
- **Hard delete**: `DELETE /transactions/{id}?mode=hard` (permanent delete)
- **Include deleted**: `GET /transactions?include_deleted=true` (show archived transactions)
- **Bulk delete**: `DELETE /transactions?ids=1,2,3` (supports soft/hard)
- **Export CSV**: `GET /transactions/export`
- All queries automatically filter out soft-deleted transactions

### Categories ✅
- Create categories (income/expense type)
- List all categories with usage stats (usage_count, total_amount)
- Delete category protection (prevents deletion if in use)
- **Reassign on delete**: `DELETE /categories/{id}?reassign_to={new_id}`

### Analytics/Summary ✅
- Total income, expense, balance
- Breakdown by category
- Monthly summary
- **Dashboard** - Full overview with filters
- **Insights** - Spending trends, top category, avg transaction

### Response Format ✅
All endpoints return standardized format:
```json
{
  "success": true,
  "data": {...},
  "meta": {...}
}
```

**Pagination Meta:**
- `total`, `limit`, `offset`, `page`, `total_pages`, `has_next`, `has_prev`, `filters`

**Rate Limit Headers:**
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Error Handling ✅
- Custom exception classes with granular error codes
- Global exception handlers
- Error codes: ERR_NOT_FOUND, ERR_UNAUTHORIZED, ERR_FORBIDDEN, ERR_VALIDATION, ERR_INVALID_DATE_RANGE, ERR_INVALID_AMOUNT, ERR_INVALID_FILTER

### Logging ✅
- MongoDB audit trail (non-blocking, fire-and-forget)
- Action labels and descriptions
- Entity types (user, transaction, category)
- Entity IDs for traceability
- **Log levels**: INFO, WARNING, ERROR
- **Request ID** tracking across all requests (`X-Request-ID`)
- **Log retention**: 90-day TTL auto-cleanup
- **MongoDB indexes** for performance:
  - timestamp, user_id+timestamp, action+timestamp
  - entity_type+entity_id, request_id, level

### Response Headers ✅
- `X-Request-ID` - Unique request identifier
- `X-Process-Time` - Request processing time
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**Pagination Meta:**
- `total`, `limit`, `offset`, `page`, `total_pages`, `has_next`, `has_prev`, `filters`

### Transaction Features ✅
- Default sorting: date desc
- Type field included in response
- Recent transactions endpoint
- Full filtering: type, category, date range, amount range, search
- Monthly summary

### Admin Features ✅
- Admin dashboard with statistics
- List all users with filters (status, search)
- View user details
- Block/unblock users
- View any user's transactions
- View any user's financial summary
- Admin role protection

### Security ✅
- JWT Authentication
- Role-based access control
- Users can only access own data
- Input sanitization (XSS prevention)
- Rate limiting
- Email format validation
- Password reset with verification code

### Error Handling ✅
- Custom exception classes
- Global exception handlers
- Error codes for all errors
- Detailed validation error messages
- Database error handling
- Structured JSON error responses

---

## API Endpoints

### Authentication

| Method | Endpoint          | Description                | Auth Required |
|--------|-------------------|----------------------------|---------------|
| POST   | /auth/signup      | Register new user         | No            |
| POST   | /auth/login       | Login and get JWT token   | No            |
| POST   | /auth/forgot-password | Request reset code   | No            |
| POST   | /auth/reset-password  | Reset password        | No            |
| PUT    | /auth/change-password | Change password        | Yes           |

### Users

| Method | Endpoint         | Description           | Auth Required |
|--------|------------------|-----------------------|---------------|
| GET    | /users/me        | Get current user     | Yes           |
| PUT    | /users/me        | Update profile       | Yes           |
| DELETE | /users/me        | Delete account       | Yes           |
| GET    | /users           | List all users       | Yes (Admin)   |
| GET    | /users/{id}      | Get user by ID       | Yes (Self/Admin)|

### Categories

| Method | Endpoint         | Description                  | Auth Required |
|--------|------------------|-----------------------------|---------------|
| GET    | /categories      | Get all categories         | Yes           |
| POST   | /categories      | Create category           | Yes           |
| DELETE | /categories/{id} | Delete category (with reassign) | Yes |

### Transactions

| Method | Endpoint                 | Description                | Auth Required |
|--------|--------------------------|----------------------------|---------------|
| GET    | /transactions            | Get user's transactions   | Yes           |
| POST   | /transactions            | Create transaction        | Yes           |
| GET    | /transactions/{id}       | Get transaction by ID     | Yes           |
| PUT    | /transactions/{id}       | Update transaction       | Yes           |
| DELETE | /transactions/{id}?mode=soft | Soft delete (archive)   | Yes           |
| DELETE | /transactions/{id}?mode=hard | Permanent delete      | Yes           |
| GET    | /transactions/recent     | Get recent transactions   | Yes           |
| GET    | /transactions/export     | Export CSV                | Yes           |
| DELETE | /transactions?ids=...    | Bulk delete               | Yes           |

**Transaction Filters:**
- `type` - income or expense
- `category_id` - Filter by category ID
- `start_date`, `end_date` - Date range
- `min_amount`, `max_amount` - Amount range
- `search` - Search in description
- `sort_by` - date, amount, created_at
- `sort_order` - asc, desc (default: desc)
- `limit`, `offset` - Pagination (default limit: 20)

### Analytics

| Method | Endpoint                    | Description                   | Auth Required |
|--------|-----------------------------|-------------------------------|---------------|
| GET    | /summary                    | Total income, expense, balance| Yes           |
| GET    | /summary/by-category        | Breakdown by category        | Yes           |
| GET    | /summary/monthly            | Monthly income/expense       | Yes           |
| GET    | /summary/dashboard          | Full user dashboard (filterable)| Yes           |
| GET    | /summary/dashboard?minimal=true | Lightweight dashboard    | Yes           |
| GET    | /summary/insights           | Spending trends, top category| Yes           |

**Dashboard Filters:** `start_date`, `end_date`, `type`, `category_id`, `minimal`

### Logs

| Method | Endpoint         | Description              | Auth Required |
|--------|------------------|-------------------------|---------------|
| GET    | /logs            | Get user's logs        | Yes           |
| GET    | /logs/recent     | Get recent logs        | Yes (Admin)   |

### Admin (Admin Only)

| Method | Endpoint                       | Description                   |
|--------|--------------------------------|-------------------------------|
| GET    | /admin/dashboard               | Admin dashboard stats        |
| GET    | /admin/users                   | List all users               |
| GET    | /admin/users/{id}              | Get user details             |
| PUT    | /admin/users/{id}/block        | Block a user                 |
| PUT    | /admin/users/{id}/unblock      | Unblock a user               |
| GET    | /admin/users/{id}/transactions | View user's transactions     |
| GET    | /admin/users/{id}/summary     | View user's financial summary|
| GET    | /admin/categories/stats        | Category usage statistics    |

**Admin User Filters:**
- `status` - active, inactive, blocked
- `role` - user, admin
- `search` - Search by name/email
- `created_after`, `created_before` - Date range
- `sort_by` - created_at, name, email
- `sort_order` - asc, desc
- `limit`, `offset` - Pagination

**Admin Transaction Filters:**
- `type` - income or expense
- `category_id`, `category_name` - Filter by category
- `start_date`, `end_date` - Date range
- `min_amount`, `max_amount` - Amount range
- `search` - Search in description

### Logs ✅

| Method | Endpoint         | Description              | Auth Required |
|--------|------------------|-------------------------|---------------|
| GET    | /logs            | Get user's logs        | Yes           |
| GET    | /logs/recent     | Get recent logs        | Yes (Admin)   |
| GET    | /logs/stats      | Log statistics         | Yes (Admin)   |
| GET    | /logs/failed-logins | Failed login attempts | Yes (Admin)   |

**Logs Filters:**
- `action` - Filter by action type (USER_LOGIN, CREATE_TRANSACTION, etc.)
- `level` - Filter by level: INFO, WARNING, ERROR
- `start_date`, `end_date` - Date range
- `request_id` - Filter by request ID
- `entity_type`, `entity_id` - Filter by entity
- `sort_order` - -1 for desc, 1 for asc (default: -1)
- `limit`, `offset` - Pagination

---

## Database Design

### SQL Server Tables

#### Users

| Column        | Type     | Constraints                     |
|---------------|----------|----------------------------------|
| id            | Integer  | PK                               |
| name          | String   | NOT NULL                         |
| email         | String   | UNIQUE, NOT NULL                 |
| password_hash | String   | NOT NULL                         |
| status        | String   | Default: 'active'                |
| role          | String   | Default: 'user'                  |
| created_at    | DateTime | Default: now                     |

#### Categories

| Column | Type   | Constraints                  |
|--------|--------|-------------------------------|
| id     | Integer| PK                            |
| name   | String | NOT NULL                      |
| type   | String | "income" or "expense"         |

#### Transactions

| Column        | Type      | Constraints                    |
|---------------|-----------|--------------------------------|
| id            | Integer   | PK                             |
| user_id       | Integer   | FK → users.id                  |
| category_id   | Integer   | FK → categories.id             |
| amount        | Float     | > 0                            |
| description   | String    | Optional                       |
| date          | DateTime  | NOT NULL                       |
| created_by    | Integer   | FK → users.id                  |
| modified_by   | Integer   | FK → users.id (nullable)       |
| modified_at   | DateTime  |                                |
| created_at    | DateTime  | Default: now                   |
| is_deleted    | Boolean   | Default: False                 |

**Indexes**: user_id, category_id, date, (user_id + date)

---

### MongoDB Collection

#### logs

| Field     | Type    | Description              |
|-----------|---------|-------------------------|
| action    | String  | Action type             |
| user_id   | Integer | Associated user         |
| payload   | Object  | Action data             |
| timestamp | DateTime| When action occurred    |

---

## Setup Instructions

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd finance_tracker
```

### 2. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Setup Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DB_SERVER=127.0.0.1
DB_PORT=1433
DB_NAME=finance_db
DB_USER=sa
DB_PASSWORD=StrongPass123

MONGO_URI=mongodb://localhost:27017
MONGO_DB=finance_logs

JWT_SECRET=your-super-secret-jwt-key-change-in-production

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=noreply@yourdomain.com
```

### 5. Run Docker Containers

```bash
docker compose up -d
```

### 6. Wait for SQL Server to Start

```bash
docker logs -f sqlserver
```

Wait until you see: `SQL Server is now ready for client connections`

### 7. Run Application

```bash
uvicorn app.main:app --reload
```

### 8. Open Swagger UI

```
http://127.0.0.1:8000/docs
```

---

## Testing

Run tests with:

```bash
pytest test_api.py -v
```

---

## Important Notes

- All credentials are stored in environment variables (never hardcoded)
- MongoDB logging is failure-safe (won't crash API on failure)
- ODBC Driver 18 requires: `Encrypt=no` and `TrustServerCertificate=yes`
- JWT tokens expire after configurable time
- Users can only access their own data (except admins)
- Rate limiting: 60 requests per minute (global), 5 login attempts per 15 minutes
- Forgot password: 6-digit code, expires in 15 minutes, max 5 attempts

---

## Project Status

| Feature                  | Status |
|--------------------------|--------|
| Authentication           | ✅ Complete |
| Forgot/Reset Password    | ✅ Complete |
| Profile Management       | ✅ Complete |
| Transactions             | ✅ Complete |
| Categories               | ✅ Complete |
| Analytics                | ✅ Complete |
| Admin Features           | ✅ Complete |
| Security (Auth, Rate Limit, Sanitization) | ✅ Complete |
| Error Handling           | ✅ Complete |
| Documentation            | ✅ Complete |

---

## Author

Nikhil Srikar Mangalampalli

---

## API Improvements & Testing (New)

- Centralized error payloads
- Role-based access control (RBAC) enforced at admin router level
- Consistent error payload format: code, message, detail, timestamp
- Frontend serving endpoints removed from API; API is backend-only
- New tests added: tests/test_api.py for login, user/me, admin RBAC
- RBAC: admin-only endpoints protected; non-admin access returns 403
- README updated with testing guidance and how to interpret error payloads

### How to test RBAC & errors
- Admin login: admin@financetracker.com / admin123
- User login: john@example.com / john123
- Use /api/admin/dashboard to verify admin access (admin token should succeed, user should fail)
- Use /api/users/me with valid/invalid tokens to verify 200 vs 401/403

### Error payload format (example)
{
  "success": false,
  "error": "Unauthorized",
  "error_code": "ERR_UNAUTHORIZED",
  "path": "/api/users/me",
  "timestamp": "2026-..."
}

---
## Local Development (No Hosting by Default)

- This project is designed to run locally with the API backend. Frontend hosting is not included by default. You can host the frontend separately if you want to test the UI with the API locally.
- Prerequisites:
  - Python 3.8+ (tested with 3.14 environment)
  - Virtual environment activated
 - Docker (optional, for DB services) if you want to run the database locally

- Typical workflow (one-time or on each dev session):
  1) Install dependencies
    ```bash
    pip install -r requirements.txt
    ```
  2) Seed test data
    ```bash
    python seed_data.py
    ```
  3) Run the API locally
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```
  4) Run tests
    ```bash
    pytest test_api.py -v
    pytest tests/test_api_v1.py -v
    ```
  5) Optional: Use the provided Makefile for a simple dev workflow
    - make dev  # install deps, seed data, run server
    - make test # run tests

- Note: If you plan to deploy later, it should be a separate, explicit step; this patch keeps hosting/deploy out of the default dev workflow.

- How to test locally:
  - Admin login: admin@financetracker.com / admin123
  - User login: john@example.com / john123
  - Access API docs: http://127.0.0.1:8000/docs

---
## Versioning Strategy

- The API already includes a v1 surface under /api/v1. All existing endpoints are available under /api/v1, and /api acts as an alias or redirect to /api/v1 to ease migration.
- Future changes should be introduced through /api/v1 first; the /api surface can be kept as a stable alias for compatibility.

---
## Examples (Error Payloads)

- 400 Bad Request
  {
    "success": False,
    "error": "Bad Request",
    "error_code": "ERR_BAD_REQUEST",
    "path": "/api/transactions",
    "timestamp": "...",
    "detail": "Invalid input: amount must be positive"
  }
- 401 Unauthorized
  {
    "success": False,
    "error": "Unauthorized",
    "error_code": "ERR_UNAUTHORIZED",
    "path": "/api/users/me",
    "timestamp": "..."
  }
- 403 Forbidden
  {
    "success": False,
    "error": "Forbidden",
    "error_code": "ERR_FORBIDDEN",
    "path": "/api/admin/dashboard",
    "timestamp": "..."
  }
- 500 Internal Server Error
  {
    "success": False,
    "error": "Internal server error",
    "error_code": "ERR_INTERNAL",
    "path": "/docs",
    "timestamp": "..."
  }

---
## Quickstart (local)

- Start server: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
- Seed data: python seed_data.py
- Run tests: pytest -q
- Open API docs: http://127.0.0.1:8000/docs


---
## Quickstart (Local Development)

- Run API locally (no hosting by default):
  - make dev
- Run tests:
  - pytest -q
- API versioning:
  - Use /api/v1/* endpoints (future-proof); /api remains as alias redirecting to /api/v1
- Error payloads:
  - All endpoints return a consistent JSON error payload with code, error, detail, path, and timestamp
