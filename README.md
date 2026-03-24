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

---

## Architecture

The project follows a clean layered architecture:

```
Router → Service → Repository → Database
```

```
app/
├── routers/       # API route definitions
├── services/       # Business logic
├── repositories/   # Database operations
├── models/         # SQLAlchemy models
├── schemas/        # Pydantic schemas
├── core/           # Config, DB, Exceptions
```

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

## Database Design

### SQL Server Tables

#### Users

| Column     | Type     | Constraints          |
|------------|----------|----------------------|
| id         | Integer  | PK                   |
| name       | String   | NOT NULL             |
| email      | String   | UNIQUE, NOT NULL     |
| created_at | DateTime | Default: now         |

#### Categories

| Column | Type   | Constraints          |
|--------|--------|----------------------|
| id     | Integer| PK                   |
| name   | String | NOT NULL             |
| type   | String | "income" or "expense" |

#### Transactions

| Column       | Type      | Constraints          |
|--------------|-----------|----------------------|
| id           | Integer   | PK                   |
| user_id      | Integer   | FK → users.id        |
| category_id  | Integer   | FK → categories.id   |
| amount       | Float     | > 0                  |
| description  | String    | Optional             |
| date         | DateTime  | NOT NULL             |
| created_at   | DateTime  | Default: now         |

**Indexes**: user_id, category_id, date, (user_id + date)

---

### MongoDB Collection

#### logs

| Field     | Type   | Description          |
|-----------|--------|----------------------|
| action    | String | Action type          |
| user_id   | Integer| Associated user      |
| payload   | Object | Action data          |
| timestamp | DateTime| When action occurred |

---

## API Endpoints

All endpoints are publicly accessible (no authentication required).

### Users

| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| POST   | /users           | Create new user    |
| GET    | /users           | Get all users     |
| GET    | /users/{user_id}| Get user by ID    |

### Categories

| Method | Endpoint    | Description          |
|--------|-------------|----------------------|
| POST   | /categories | Create category     |
| GET    | /categories | Get all categories  |

### Transactions

| Method | Endpoint                        | Description                    |
|--------|----------------------------------|--------------------------------|
| POST   | /transactions                   | Create transaction             |
| GET    | /transactions?user_id=X        | Get user's transactions        |
| GET    | /transactions?user_id=X&type=  | Filter by income/expense       |
| PUT    | /transactions/{transaction_id} | Update transaction             |
| DELETE | /transactions/{transaction_id} | Delete transaction             |

### Logs (MongoDB)

| Method | Endpoint        | Description              |
|--------|-----------------|-------------------------|
| GET    | /logs/{user_id} | Get logs for a user    |
| GET    | /logs/recent    | Get recent 10 logs      |

### Summary & Analytics

| Method | Endpoint                    | Description                   |
|--------|-----------------------------|-------------------------------|
| GET    | /summary/{user_id}          | Total income, expense, balance|
| GET    | /summary/{user_id}/by-category | Breakdown by category       |
| GET    | /summary/{user_id}/monthly | Monthly income/expense        |

---

## Features Implemented

- SQL Server with connection pooling
- MongoDB for resilient audit logging
- Pydantic v2 validation
- Global exception handling
- Proper REST API design
- Database indexes for performance
- N+1 query optimization

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

---

## Author

Nikhil Srikar Mangalampalli
# Personal-Finance_Tracker
