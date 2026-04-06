# Finly

Finly is a role-based finance tracking platform with a FastAPI backend and a static frontend served by the same app. It supports:

- `User workspace`: dashboard, transactions, budgets, reports, notifications, profile
- `Admin workspace`: dashboard, users, system transactions, logs, reports, categories, profile

The project now uses a single database only: `SQL Server`. Core data and audit logs both live there.

## Product Overview

### Public pages

- `/` -> landing page
- `/login.html` -> login
- `/signup.html` -> signup
- `/support.html` -> support and FAQ page
- `/forgot-password.html` -> request password reset code
- `/reset-password.html` -> verify code and set a new password

### User workspace

- Dashboard with balance, savings, budget health, spending charts, and quick search
- Transactions with filters, sorting, archive/restore, export, and bulk actions
- Budgets with progress tracking and threshold updates at `50%`, `75%`, `100%`, and over budget
- Reports with charts, insights, CSV export, and PDF export
- Notifications / activity history with readable audit summaries
- Profile page for updating account details, password, logout, and account deletion

### Admin workspace

- Admin dashboard with KPI cards, activity feed, and quick user search
- User management with block/unblock controls
- System transactions with filters, archive/restore/delete, and bulk actions
- Admin logs with filters, pagination, and detailed activity modal
- System analytics with role-specific CSV and PDF exports
- Category oversight
- Admin profile page

## Tech Stack

- FastAPI
- SQLAlchemy
- SQL Server / Azure SQL Edge
- PyODBC
- JWT authentication
- Vanilla HTML, CSS, and JavaScript
- Chart.js
- Nodemailer for Gmail-friendly password reset delivery

## Repo Structure

- `app/` -> backend API, routers, services, repositories, models, auth, config
- `Project/` -> frontend HTML, CSS, and JavaScript
- `scripts/` -> helper scripts such as database initialization and email bridge
- `tests/` -> pytest coverage for key backend behavior
- `docker-compose.yml` -> local SQL Server service
- `Makefile` -> local development commands
- `PAGES_GUIDE.md` -> page-by-page product guide
- `codes.sql` -> SQL schema/reference script

## Architecture

The backend follows a layered structure:

- `routers` -> HTTP endpoints
- `services` -> business logic
- `repositories` -> database queries and persistence
- `models` -> SQLAlchemy entities
- `schemas` -> request/response validation

The frontend is a static app served by FastAPI. Shared UI behavior is centralized in:

- `Project/styles.css`
- `Project/js/core/utils.js`
- `Project/js/layout/sidebar.js`
- `Project/js/layout/header-actions.js`
- `Project/js/visuals/charts.js`
- `Project/js/pages/`

## API

All primary endpoints are exposed under `/api/v1`.

Examples:

- `/api/v1/auth/login`
- `/api/v1/users/me`
- `/api/v1/transactions`
- `/api/v1/budgets`
- `/api/v1/logs`
- `/api/v1/summary/insights`
- `/api/v1/admin/analytics`

Legacy top-level routes such as `/auth/...` and `/transactions/...` are redirected to `/api/v1/...`.

### Common response shape

Most endpoints return:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Paginated responses include metadata such as:

- `total`
- `limit`
- `offset`
- `page`
- `total_pages`
- `has_next`
- `has_prev`
- `filters`

## Local Requirements

Before running locally, make sure you have:

- Python 3.10+
- Docker and Docker Compose
- ODBC Driver 18 for SQL Server
- Node.js

## Environment Variables

Configuration is loaded from `.env`.

### Database

- `DB_SERVER`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

### Auth

- `JWT_SECRET`

### Email / password reset

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `FROM_EMAIL`
- `FROM_NAME`

Optional fallback values:

- `BREVO_API_KEY`
- `BREVO_BASE_URL`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`

Development helpers:

- `APP_ENV`
- `DEBUG_RESET_CODES`

See [`.env.example`](/Users/bhargavnikhil/Desktop/finance_tracker/.env.example) for a starting point.

### Gmail setup

The current reset flow is designed to work well with a Gmail account plus an app password.

Recommended values:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com
FROM_NAME=Finly Support
```

Notes:

- copied Gmail app passwords with spaces are normalized automatically
- if Node and `nodemailer` are available, the app can use the bundled Node mail bridge
- SMTP remains the main delivery path
- Brevo can be configured as a fallback

## Running Locally

### 1. Start SQL Server

```bash
docker compose up -d
```

This starts SQL Server on port `1433`.

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Initialize the database schema

```bash
make init-db
```

### 4. Optional: load fresh demo data

```bash
make seed-demo
```

This clears the current local data and reseeds users, categories, transactions, budgets, and audit logs.

### 5. Start the app

```bash
make dev
```

This will:

- install Python dependencies
- initialize the schema
- run Uvicorn on port `8000`

Equivalent direct command:

```bash
python scripts/init_db.py
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open:

- [http://127.0.0.1:8000](http://127.0.0.1:8000)
- [http://127.0.0.1:8000/login.html](http://127.0.0.1:8000/login.html)

## Make Commands

Available commands:

```bash
make init-db
make dev
make seed-demo
make test
make share
```

## Demo Credentials

### Admin

- `admin@financetracker.com`
- `admin123`

### Main user

- `john@example.com`
- `john123`

### Other demo users

- `alice@example.com` / `alice123`
- `bob@example.com` / `bob123`
- `charlie@example.com` / `charlie123`
- `diana@example.com` / `diana123`
- `ethan@example.com` / `ethan123`
- `gina@example.com` / `gina123`
- `harish@example.com` / `harish123`
- `jack@example.com` / `jack123`

### Blocked users for admin testing

- `farah@example.com` / `farah123`
- `irene@example.com` / `irene123`

## Key Product Behaviors

### Reports

- user and admin reports are intentionally different
- user reports focus on personal spending and trends
- admin reports focus on system-wide transaction summaries and user activity
- both CSV and PDF exports include structured summaries instead of raw dumps

### Budgets

- budgets are user-specific
- budget health is surfaced in both the budgets page and the dashboard
- threshold states are tracked at:
  - `50%`
  - `75%`
  - `100%`
  - `over budget`

### Logs and notifications

- audit logs are stored in SQL Server
- user notifications are powered by the same audit system
- activity is presented with human-readable labels and summaries
- transaction, budget, profile, login, and admin management activity is recorded

### Password recovery

- users request a verification code on `forgot-password.html`
- they complete reset on `reset-password.html`
- reset emails are delivered through Gmail-friendly SMTP setup

## Testing

Run automated tests with:

```bash
make test
```

For a manual smoke test, check:

- landing page
- support page
- login/signup
- forgot-password/reset-password
- user dashboard
- transactions
- budgets
- reports
- notifications
- admin dashboard
- admin users
- admin transactions
- admin logs
- admin reports

## Sharing With Ngrok

Once the app is running on port `8000`, expose it publicly with:

```bash
make share
```

This runs:

```bash
ngrok http 8000
```

Because FastAPI serves both the frontend and API, one URL is enough.

## Troubleshooting

### Port `8000` already in use

Check the process using the port:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Stop it:

```bash
kill <PID>
```

Or run Finly on a different port:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Password reset emails are not arriving

Check:

- Gmail app password is valid
- `SMTP_USER` and `FROM_EMAIL` match the sender you expect
- your `.env` values are loaded before starting the app
- Node.js is installed if you want to use the Nodemailer bridge

### Demo users do not work

If you reseeded recently, use the credentials listed above. If you created custom users and then ran `make seed-demo`, those custom users were replaced by demo data.

## Related Docs

- [PAGES_GUIDE.md](/Users/bhargavnikhil/Desktop/finance_tracker/PAGES_GUIDE.md) -> detailed explanation of pages and sections

## Summary

Finly is a full-stack finance platform that combines personal finance workflows and admin oversight in one app. Users manage transactions, budgets, reports, and notifications, while admins manage users, logs, system transactions, and system analytics. The backend is FastAPI, the frontend is static HTML/CSS/JS, and everything now runs on a single SQL Server database.
