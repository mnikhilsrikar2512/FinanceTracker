# Finly Project Documentation

## 1. Product overview

Finly is a role-based finance operations application.

- **User side** focuses on day-to-day money management.
- **Admin side** focuses on oversight, governance, and operational controls.

Core capabilities:

- transaction tracking
- category-based budgeting
- trend and category analytics
- logs and audit visibility
- CSV/PDF report exports
- profile and password management

## 2. Architecture summary

### Backend

- Framework: **FastAPI**
- API base: **`/api/v1`**
- Middleware: request id, cache-control for API responses, CORS, rate limiting
- Routers:
  - `auth_router`
  - `user_router`
  - `category_router`
  - `transaction_router`
  - `budget_router`
  - `analytics_router`
  - `admin_router`
  - `log_router`

### Frontend

- Static HTML + modular JS/CSS
- Served by FastAPI from `Frontend/`
- Workspace shell with hash navigation
- Theme toggle (light/dark) with persisted preference

## 3. Frontend page map

### Public/Auth pages

- `index.html` - landing page
- `support.html` - support and FAQ
- `login.html` - sign in
- `signup.html` - create account
- `forgot-password.html` - reset flow step 1
- `reset-password.html` - reset flow step 2

### User workspace (`app.html`)

- `#dashboard`
- `#transactions`
- `#reports`
- `#budgets`
- `#notifications`
- `#profile`

### Admin workspace (`admin.html`)

- `#dashboard`
- `#users`
- `#transactions`
- `#categories`
- `#reports`
- `#logs`
- `#profile`

## 4. Auth and recovery flow

### Sign in

- user submits email/password
- backend returns token + role context
- frontend routes user to proper workspace

### Forgot password (2-step)

1. `forgot-password.html` sends verification code request
2. `reset-password.html` verifies code and sets new password

## 5. Reporting and exports

### Live reports in UI

- KPI metrics: net, inflow, outflow, ratio
- trend chart (net/inflow/outflow modes)
- category distribution chart
- ranked category summary
- monthly snapshot table

### Downloadable exports

- **CSV**: tabular metric export
- **PDF**: multi-page executive report that includes:
  - executive snapshot
  - live report summary
  - key signals
  - operational detail tables
  - trend page with notes
  - spending mix page with actionable summary

## 6. Styling and UX principles

- compact, desktop-first layout
- responsive breakpoints for tablet/mobile
- popup system with structured headers and scrollable bodies
- consistent button hierarchy and spacing
- inline form validation for key entry forms

## 7. Local development

### Prerequisites

- Python 3.x
- Docker + Docker Compose

### Start app

```bash
make dev
```

### Other commands

```bash
make init-db
make share
```

## 8. Environment configuration

Use `.env.example` as baseline. Typical keys include:

- database connection variables
- JWT secret
- CORS origins
- rate limit / password reset storage paths
- SMTP settings for password recovery emails

## 9. Troubleshooting

- If UI changes do not appear, hard refresh (`Cmd + Shift + R`).
- If report export looks outdated, refresh and re-export to ensure latest JS is loaded.
- If login/reset fails in development, verify API base and environment values.

## 10. File references

- Backend entrypoint: `app/main.py`
- Workspace shell: `Frontend/scripts/workspace.js`
- User pages: `Frontend/scripts/pages/user.js`
- Admin pages: `Frontend/scripts/pages/admin.js`
- Export engine: `Frontend/scripts/core/export.js`
- Theme/auth helpers: `Frontend/scripts/core/theme.js`, `Frontend/scripts/core/auth-page.js`
