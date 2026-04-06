# Finly

Finly is a finance-tracking web app with a FastAPI backend and a static frontend served from the same app. It supports two main experiences:

- `User workspace`: transactions, reports, budgets, and personal activity
- `Admin workspace`: users, logs, system transactions, categories, and system analytics

The app now also includes a proper landing flow:

- `/` -> product landing page
- `/login.html` -> login
- `/signup.html` -> signup
- `/support.html` -> support and customer-help page
- `/forgot-password.html` -> request password reset code
- `/reset-password.html` -> verify code and set a new password

## What’s In This Repo

- `app/` -> FastAPI API, auth, models, routers, services, repositories
- `Project/` -> frontend HTML, CSS, and JavaScript
- `docker-compose.yml` -> local SQL Server + MongoDB services
- `Makefile` -> common local commands
- `PAGES_GUIDE.md` -> plain-language guide to every page and section in the product

## Stack

- FastAPI
- SQLAlchemy
- SQL Server / Azure SQL Edge
- MongoDB
- PyODBC
- JWT auth
- Vanilla HTML/CSS/JS frontend
- Chart.js

## Product Areas

### User side

- Landing page, login, signup, support, and password recovery
- Dashboard
- Transactions with filtering, sorting, export, archive/delete
- Reports and charts
- Budgets with progress tracking
- Notifications / activity history

### Admin side

- Admin dashboard
- User management
- System transactions
- Category oversight
- Activity logs
- System analytics via `/api/v1/admin/analytics`

## API Shape

The API is versioned under `/api/v1`.

Examples:

- `/api/v1/auth/login`
- `/api/v1/users/me`
- `/api/v1/transactions`
- `/api/v1/summary/insights`
- `/api/v1/budgets`
- `/api/v1/admin/analytics`

Legacy top-level paths such as `/auth/...` and `/transactions/...` are redirected to `/api/v1/...`.

## Response Format

Most endpoints return:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Paginated endpoints include metadata such as:

- `total`
- `limit`
- `offset`
- `page`
- `total_pages`
- `has_next`
- `has_prev`
- `filters`

## Key Backend Areas

- `app/main.py`
  mounts all routers under `/api/v1` and serves the frontend statically
- `app/routers/`
  HTTP endpoints
- `app/services/`
  business rules
- `app/repositories/`
  data access
- `app/models/`
  SQLAlchemy models
- `app/core/`
  auth, config, database, rate limiting, exception handling, Mongo integration

## Local Requirements

Before running locally, make sure you have:

- Python 3.10+
- ODBC Driver 18 for SQL Server
- Docker and Docker Compose

## Environment Variables

The app reads configuration from `.env`.

Important values:

- `DB_SERVER`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `MONGO_URI`
- `MONGO_DB`
- `JWT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `FROM_EMAIL`
- `BREVO_API_KEY`
- `BREVO_BASE_URL`
- `BREVO_FROM_EMAIL`
- `BREVO_FROM_NAME`
- `APP_ENV`
- `DEBUG_RESET_CODES`

Example `.env` values depend on your local setup. The repo already includes `.env.example` for reference.

Password reset emails now prefer SMTP, which means a Gmail account plus a Gmail app password works well for local and demo use. Brevo remains available as a fallback if SMTP is not configured or delivery fails.

The app now also includes a small Node-based mail bridge using `nodemailer`, so Gmail delivery works cleanly with the installed Node dependency while the main API remains in FastAPI/Python.

Gmail setup notes:

- set `SMTP_HOST=smtp.gmail.com`
- set `SMTP_PORT=587`
- set `SMTP_USER` to your Gmail address
- set `SMTP_PASSWORD` to your Gmail app password
- spaces in copied Gmail app passwords are normalized automatically
- set `FROM_EMAIL` to the same Gmail address unless you have another verified sender

Brevo setup notes:

- `BREVO_API_KEY` is only needed if you want Brevo as a fallback or alternate provider
- `BREVO_BASE_URL` defaults to `https://api.brevo.com`
- `BREVO_FROM_EMAIL` controls the sender email shown to users
- `BREVO_FROM_NAME` controls the sender display name

## Running Locally

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:

- SQL Server on `1433`
- MongoDB on `27017`

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Optional: reseed demo data

```bash
make seed-demo
```

Use this when you want a fresh demo state with sample users, admin data, transactions, budgets, and logs.

### 4. Run the app

Recommended:

```bash
make dev
```

Equivalent direct command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Then open:

- [http://127.0.0.1:8000](http://127.0.0.1:8000) for the landing page
- [http://127.0.0.1:8000/login.html](http://127.0.0.1:8000/login.html) for login
- [http://127.0.0.1:8000/support.html](http://127.0.0.1:8000/support.html) for the support page

## Notes About `make dev`

The current `Makefile` includes a working `make dev` flow that:

- installs dependencies
- runs the FastAPI server with reload

Use `make seed-demo` when you want to wipe and reseed local demo data explicitly.

Other available commands:

```bash
make test
make seed-demo
make share
```

## Local Testing Flow

For a normal local test session, use:

```bash
docker compose up -d
make seed-demo
make dev
```

If you do not want to reseed data, skip `make seed-demo`.

## Troubleshooting

### Port 8000 already in use

If `make dev` fails with:

```text
ERROR: [Errno 48] Address already in use
```

check what is listening on port `8000`:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

If you want to stop that process, run:

```bash
kill <PID>
```

Then start Finly again:

```bash
make dev
```

If you want to keep the existing process and run Finly on another port instead:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Then open:

- [http://127.0.0.1:8001](http://127.0.0.1:8001)

## Sharing With Ngrok

Once the app is running on port `8000`, you can expose it publicly:

```bash
make share
```

That runs:

```bash
ngrok http 8000
```

Because the frontend is served by the same FastAPI app, a single ngrok URL is enough for both UI and API.

## Main Frontend Pages

### Public

- `Project/index.html` -> landing page
- `Project/login.html` -> login
- `Project/signup.html` -> signup
- `Project/forgot-password.html` -> request reset code
- `Project/reset-password.html` -> reset password with code
- `Project/support.html` -> support and customer-help page

### User workspace

- `Project/app.html`
- `Project/transactions.html`
- `Project/reports.html`
- `Project/budgets.html`
- `Project/logs.html`
- `Project/profile.html`

### Admin workspace

- `Project/admin.html`
- `Project/admin-users.html`
- `Project/admin-transactions.html`
- `Project/admin-logs.html`
- `Project/categories.html`
- `Project/admin-profile.html`

## Main API Areas

### Auth

- signup
- login
- change password
- forgot password
- reset password

Auth behavior notes:

- login accepts email-based sign-in only
- emails are normalized to lowercase and trimmed before lookup/storage
- signup, change-password, and reset-password require stronger passwords
- password reset requests use cooldowns and throttling
- reset codes are emailed through SMTP first
- Gmail SMTP works with a Gmail account plus app password
- Brevo remains available as a fallback if SMTP is unavailable

### Users

- current user profile
- update profile
- self-service profile page
- delete account

### Transactions

- list, create, update, delete
- soft delete / archive
- hard delete
- filtering
- sorting
- CSV export

### Analytics

- user summaries
- monthly summaries
- category summaries
- dashboard insights
- admin system analytics

### Budgets

- create budget
- list budgets
- budget summary
- budget progress
- update and delete budget

### Logs

- personal activity logs
- admin operational logs

## Current UX Flow

The app is designed so first-time visitors do not land directly on login anymore.

Recommended flow:

1. Open the landing page
2. Use the support page if the person is new or needs guidance
3. Go to login or signup
4. If needed, use forgot-password and then reset-password
5. Enter the user or admin workspace based on role

## Developer Notes

- The frontend is static and lives in `Project/`
- The backend serves that frontend from `app/main.py`
- Dark mode, shared shell behavior, charts, page-help tooltips, and common utilities are centralized in:
  - `Project/styles.css`
  - `Project/js/core/utils.js`
  - `Project/js/layout/sidebar.js`
  - `Project/js/layout/header-actions.js`
  - `Project/js/visuals/charts.js`

## Testing

Run:

```bash
make test
```

If tests have been removed or are in flux in your local worktree, use targeted manual smoke testing on:

- landing
- support
- login/signup
- forgot-password/reset-password
- user dashboard
- transactions
- reports
- budgets
- admin dashboard
- admin analytics

## Summary

Finly is now a combined frontend + API app with:

- a public landing experience
- a dedicated support page for new users and admins
- separate login and signup pages
- a two-step password recovery flow
- Gmail/SMTP-friendly password reset email delivery with Brevo fallback
- user budgeting/reporting workflows
- admin operations and system analytics
- one-port sharing through ngrok
