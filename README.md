# Finly

### Role-based finance tracker with FastAPI, admin/user dashboards, analytics, logs, budgets, and polished CSV/PDF exports.

## 🚀 Elevator Pitch
Finly unifies day-to-day finance execution and admin oversight in one clean workspace.  
Users manage transactions, budgets, and reports, while admins monitor users, activity logs, and system trends with export-ready outputs.

## About

Finly is designed as a practical finance cockpit for both daily users and platform admins.

- **Users** manage transactions, budgets, and personal reporting in one workspace.
- **Admins** supervise users, system activity, categories, logs, and platform-level analytics.
- **Exports** provide clean CSV/PDF handoff for reviews, reporting, and audits.

GitHub About (short description suggestion):

`Role-based finance tracker with FastAPI, admin/user dashboards, analytics, logs, and polished CSV/PDF exports.`

## Overview

Finly helps teams and individuals:

- track inflow/outflow transactions
- plan budgets by category
- monitor trends through dashboards and reports
- review operational logs and admin-level controls
- export decision-ready reports

## Tech Stack

- **Backend:** FastAPI
- **Database:** SQL Server (local via Docker Compose)
- **Frontend:** Static HTML/CSS/JS served by FastAPI
- **API Base:** `/api/v1`

## Core Features

### User Workspace

- dashboard KPIs and trends
- transaction management with filters and bulk actions
- reporting center (range + trend modes)
- budget planner and progress tracking
- notifications timeline
- profile and password management

### Admin Workspace

- command center metrics
- users directory and account controls
- transaction oversight tools
- category management
- analytics and downloadable reports
- logs explorer with details modal

### Security and Auth

- role-aware sign-in routing
- 2-step password recovery flow (`forgot-password` -> `reset-password`)
- request-id and rate-limit middleware

## Quick Start

1. Create and activate a Python virtual environment.
2. Copy `.env.example` to `.env` and configure required values.
3. Run:

```bash
make dev
```

This command will:

- install dependencies
- start SQL Server container
- initialize database schema
- run FastAPI at `http://127.0.0.1:8000`

## Make Commands

- `make dev` - start full local stack
- `make init-db` - initialize database schema
- `make share` - expose local app through ngrok

## Routes

### Public/Auth

- `/` or `/index.html` - landing page
- `/login.html` - sign in
- `/signup.html` - sign up
- `/forgot-password.html` - reset step 1
- `/reset-password.html` - reset step 2
- `/support.html` - support page

### Workspaces

- `/app.html` - user workspace
- `/admin.html` - admin workspace

## API Reference (High-Level)

- Health: `GET /health`
- Auth: `/api/v1/auth/*`
- Users/Profile: `/api/v1/users/*`
- Transactions: `/api/v1/transactions/*`
- Budgets: `/api/v1/budgets/*`
- Categories: `/api/v1/categories/*`
- Logs: `/api/v1/logs/*`
- Analytics: `/api/v1/summary/*`, `/api/v1/admin/analytics/*`
- Admin: `/api/v1/admin/*`

## Documentation

- Project documentation: `docs/PROJECT_DOCUMENTATION.md`
- Frontend notes: `Frontend/README.md`

## Notes

- Currency presentation in UI and exports is INR-focused.
- If static changes do not appear, hard refresh (`Cmd + Shift + R`).
