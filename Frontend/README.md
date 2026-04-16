# Finly Frontend

A desktop-first, Apple-inspired finance tracker frontend built as a lightweight static SPA shell that integrates with the Finly backend API at `/api/v1`.

## What This Frontend Includes

- Login flow with role-aware redirects
- User workspace and admin console
- Live date and clock in the header
- Theme toggle with persisted preference
- Glassmorphic shell and responsive layout
- KPI cards, line charts, donut charts, tables, and empty/loading states
- CRUD-ready screens for transactions, budgets, categories, users, and profile updates
- Modal and toast primitives for interactions
- Demo-mode fallbacks for design preview only

## File Structure

```text
Frontend/
├── README.md
├── index.html
├── login.html
├── signup.html
├── forgot-password.html
├── support.html
├── app.html
├── admin.html
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── layout.css
│   └── components.css
└── scripts/
    ├── login.js
    ├── signup.js
    ├── forgot-password.js
    ├── workspace.js
    ├── core/
    │   ├── auth-page.js
    │   ├── api.js
    │   ├── charts.js
    │   ├── dom.js
    │   ├── format.js
    │   ├── theme.js
    │   └── ui.js
    ├── data/
    │   └── mock.js
    └── pages/
        ├── admin.js
        └── user.js
```

## Entry Points

- `index.html` for the public overview
- `login.html` for sign in
- `signup.html` for new account creation
- `forgot-password.html` for two-step password recovery
- `support.html` for support and FAQs
- `app.html` for the personal workspace
- `admin.html` for the admin console

## Backend Assumptions

- Auth: `POST /api/v1/auth/login`
- Current user: `GET /api/v1/users/me`
- User analytics: `/api/v1/summary`, `/api/v1/transactions`, `/api/v1/budgets`, `/api/v1/budgets/summary`, `/api/v1/logs`
- Admin analytics: `/api/v1/admin/dashboard`, `/api/v1/admin/users`, `/api/v1/admin/analytics`, `/api/v1/logs`, `/api/v1/logs/stats`

## Notes

- Compatibility status:
  - login: compatible
  - users/me: compatible
  - transactions: mostly compatible
  - budgets: partial
  - admin dashboard/reports: partial
  - logs: partial
  - profile forms: partial
- Demo-mode fallback data is available for design previews, but real integration mode now surfaces API mismatches instead of silently masking them.
- The layout is optimized for desktop first and collapses to tablet and mobile breakpoints automatically.
