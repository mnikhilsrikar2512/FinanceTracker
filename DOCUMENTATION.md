# Personal Finance Tracker API - Complete Documentation

---

## PROJECT OVERVIEW

A **Personal Finance Tracker API** with two databases:
- **SQL Server** → Transactional data (users, categories, transactions)
- **MongoDB** → Audit logs

---

## AUTHENTICATION SYSTEM

### How It Works

| Step | What Happens |
|------|-------------|
| 1. Sign Up | User creates account → role = "user" by default |
| 2. Login | User sends email/password → receives JWT token |
| 3. Access | Token sent in header → API identifies user |
| 4. Role Check | Admin endpoints check if role = "admin" |

### Making Someone Admin
- Sign up like normal user
- Manually update database: `UPDATE users SET role = 'admin' WHERE email = '...'`

---

## USER vs ADMIN

### Regular User Can Do:

| Feature | Description |
|---------|-------------|
| Manage Categories | Create income/expense categories |
| Manage Transactions | Add, edit, delete (soft/hard) own transactions |
| View Dashboard | See balance, income, expenses |
| View Reports | Insights, by-category, monthly summaries |
| Export Data | Download transactions as CSV |
| View Own Logs | See their own activity |

### Admin Can Do:

| Feature | Description |
|---------|-------------|
| Everything User Can | Plus... |
| View All Users | List, search, filter |
| Block/Unblock Users | Disable user access |
| View Any User's Data | Transactions, summaries |
| View System Logs | All activity, stats |
| Admin Dashboard | System-wide statistics |

---

## CORE FEATURES

### 1. Categories
- Create categories (Income or Expense type)
- List all categories with usage count
- Delete with reassignment (move transactions to another category)

### 2. Transactions
- Create income/expense
- Filter by: type, category, date, amount, search
- Sort by: date, amount, created_at
- Pagination (default 20 per page)
- Soft Delete: Archive (default)
- Hard Delete: Permanent
- Bulk Delete: Multiple at once
- Export: Download as CSV

### 3. Dashboard
- Total Balance
- Total Income
- Total Expenses
- Recent Transactions
- Filter by date/type/category

### 4. Reports
- Summary (balance overview)
- By Category (breakdown)
- Monthly (trend over time)
- Insights (top spending, averages)

### 5. Logging
- Every action logged to MongoDB
- Filters: action, level, date, entity
- Stats: aggregate by action/user/level
- 90-day auto-cleanup (TTL)

---

## API ENDPOINTS

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | Register new user |
| `/auth/login` | POST | Login, get token |
| `/auth/change-password` | POST | Change password |
| `/auth/forgot-password` | POST | Request reset code |
| `/auth/reset-password` | POST | Reset with code |

### Users

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/users/me` | GET | User | Get my profile |
| `/users/me` | PUT | User | Update profile |
| `/users/me` | DELETE | User | Delete account |
| `/users` | GET | Admin | List all users |

### Categories

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/categories` | GET | List categories |
| `/categories` | POST | Create category |
| `/categories/{id}` | DELETE | Delete with reassign |

### Transactions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/transactions` | GET | List transactions |
| `/transactions` | POST | Create transaction |
| `/transactions/{id}` | PUT | Update transaction |
| `/transactions/{id}` | DELETE | Soft/hard delete |
| `/transactions?ids=` | DELETE | Bulk delete |
| `/transactions/export` | GET | Export CSV |

### Summary/Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/summary` | GET | Balance overview |
| `/summary/by-category` | GET | Category breakdown |
| `/summary/monthly` | GET | Monthly trends |
| `/summary/dashboard` | GET | Full dashboard |
| `/summary/insights` | GET | Analytics |

### Logs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/logs` | GET | My logs |
| `/logs/recent` | GET | Admin: all logs |
| `/logs/stats` | GET | Admin: log stats |

### Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/dashboard` | GET | System stats |
| `/admin/users` | GET | List users |
| `/admin/users/{id}` | GET | User details |
| `/admin/users/{id}/block` | PUT | Block user |
| `/admin/users/{id}/unblock` | PUT | Unblock user |
| `/admin/users/{id}/transactions` | GET | View user's transactions |
| `/admin/users/{id}/summary` | GET | User's financial summary |

---

## SECURITY

| Feature | Implementation |
|---------|----------------|
| Passwords | Bcrypt hashed |
| Authentication | JWT tokens |
| Authorization | Role-based (user/admin) |
| Data Isolation | Users see only their data |
| Rate Limiting | 60 requests/minute |
| Input Validation | Pydantic schemas |

---

## SPECIAL FEATURES

### Soft Delete
- Default: `?mode=soft` → Archive transaction
- Permanent: `?mode=hard` → Delete forever
- View archived: `?include_deleted=true`

### Request Tracking
- Every request gets `X-Request-ID`
- Trackable across logs

### Non-Blocking Logging
- Logs written asynchronously
- Won't slow down API

### Auto Cleanup
- Logs auto-delete after 90 days

---

## WHAT'S READY

| Component | Status |
|-----------|--------|
| REST API | ✅ Complete |
| Authentication | ✅ Complete |
| User Features | ✅ Complete |
| Admin Features | ✅ Complete |
| Logging | ✅ Complete |
| Frontend | ❌ Not built yet |

---

## FOLDER STRUCTURE TO CREATE

```
/finance-tracker-frontend
├── index.html          (Login/Signup)
├── app.html           (Main SPA)
├── css/
│   └── styles.css     (Custom styles)
├── js/
│   ├── api.js         (API calls)
│   ├── auth.js        (Authentication)
│   ├── app.js         (Main app logic)
│   ├── dashboard.js   (Dashboard page)
│   ├── transactions.js (Transactions)
│   ├── categories.js  (Categories)
│   ├── reports.js     (Reports)
│   └── logs.js        (Activity logs)
```

---

## FRONTEND TECHNICAL SPECIFICATIONS

### Tech Stack
- HTML5
- Tailwind CSS
- Vanilla JavaScript
- Chart.js (for charts)

### Design System
- Fixed Sidebar (left)
- Top Navbar
- Main Content Area

### Pages to Build

1. **Login/Signup Page**
   - Centered card design
   - Clean form
   - Error handling
   - JWT storage in localStorage

2. **Dashboard**
   - Stat cards (balance, income, expense)
   - Charts (Chart.js)
   - Recent transactions
   - Filters

3. **Transactions**
   - Filters bar
   - Table view
   - Add/Edit modal
   - Soft/hard delete
   - Bulk delete
   - Export CSV

4. **Categories**
   - Tabs: Income / Expense
   - List with usage stats
   - Create/Delete

5. **Reports**
   - Multiple charts
   - Insights section
   - Date filtering

6. **Activity Logs**
   - Timeline/table
   - Filters
   - Pagination

7. **Admin Panel** (Admin only)
   - User management
   - Block/unblock
   - View user data

### Authentication Flow
1. User logs in using /auth/login
2. Store JWT in localStorage
3. Call /users/me
4. Check role → Show admin panel if admin

### Global Requirements
- Redirect to login if no token
- Attach token to all API requests
- No page reloads (SPA approach)
- Fast interactions
- Loading states
- Error handling
- Empty states

---

## API RESPONSE FORMAT

### Success Response
```json
{
  "success": true,
  "data": {...},
  "meta": {...}
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "page": 1,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false,
    "filters": {}
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "error_code": "ERR_CODE"
}
```

---

## COMMON API QUERIES

### Transactions Filters
- `type` - income or expense
- `category_id` - Filter by category ID
- `start_date`, `end_date` - Date range
- `min_amount`, `max_amount` - Amount range
- `search` - Search in description
- `sort_by` - date, amount, created_at
- `sort_order` - asc, desc
- `limit`, `offset` - Pagination
- `include_deleted` - Include soft-deleted

### Logs Filters
- `action` - Filter by action type
- `level` - INFO, WARNING, ERROR
- `start_date`, `end_date` - Date range
- `request_id` - Filter by request ID
- `entity_type`, `entity_id` - Filter by entity
- `sort_order` - asc, desc

---

## DEPLOYMENT

### Backend
```bash
# Run API
uvicorn app.main:app --reload

# Swagger docs at
http://localhost:8000/docs
```

### Frontend (to be built)
```bash
# Open index.html in browser
# Or serve with any static server
```

---

## AUTHOR

Nikhil Srikar Mangalampalli

---

## LAST UPDATED

March 2026
