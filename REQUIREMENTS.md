# Personal Finance Tracker - Enhanced Requirements

---

## 1. User Management

### 1.1 Authentication
- **Sign Up**: User registration with name, email, password
- **Login**: Email + password authentication
- **JWT Token**: Secure session management with tokens
- **Password Field**: Rename to `password_hash` in database

### 1.2 Profile Management
| Feature | Description |
|---------|-------------|
| View Profile | Display user details (name, email, created_at) |
| Edit Profile | Update name, email |
| Change Password | Secure password update with verification |
| Delete Account | Soft delete or hard delete user account |

### 1.3 User Status
| Status | Description |
|--------|-------------|
| Active | Normal user access |
| Inactive | Account disabled |
| Pending | Email not verified |
| Blocked | Admin blocked user |

---

## 2. Role-Based Access Control

### 2.1 Roles
| Role | Permissions |
|------|-------------|
| User | Create/Read/Update/Delete own transactions |
| Admin | Full access to all users and data |

### 2.2 Module-Based Access
- Filter access by module numbers
- Module 1: User Management
- Module 2: Categories
- Module 3: Transactions
- Module 4: Reports & Analytics
- Module 5: Admin Dashboard

---

## 3. Transaction Management

### 3.1 Transaction Fields
| Field | Type | Description |
|-------|------|-------------|
| id | Integer | Primary key |
| user_id | Integer | Foreign key to users |
| category_id | Integer | Foreign key to categories |
| amount | Float | Transaction amount |
| description | String | Optional description |
| date | DateTime | Transaction date |
| created_by | Integer | User who created |
| created_at | DateTime | Creation timestamp |
| modified_by | Integer | Last modifier user_id |
| modified_at | DateTime | Last modification timestamp |

### 3.2 Transaction Operations
- Create transaction
- Edit transaction (all fields editable)
- Delete transaction (soft delete)
- View transaction history
- Filter by:
  - Date range (on date, closing date)
  - User specific
  - Category type (income/expense)
  - Amount range

### 3.3 Audit Trail
- Track `created_by` and `created_at`
- Track `modified_by` and `modified_at`
- Full history logging in MongoDB

---

## 4. Dashboard

### 4.1 User Dashboard
| Widget | Description |
|--------|-------------|
| Total Balance | Current income - expenses |
| Recent Transactions | Last 10 transactions |
| Monthly Summary | Current month income vs expense |
| Category Breakdown | Pie chart of spending by category |
| Quick Actions | Add transaction, View categories |

### 4.2 Admin Dashboard
| Widget | Description |
|--------|-------------|
| Total Users | Count of all users |
| Active Users | Users with recent activity |
| Total Transactions | All transactions in system |
| Revenue Summary | Total money tracked |
| User Status | Active/Inactive/Blocked counts |
| Recent Activity | Latest system activities |

### 4.3 Admin User Management
- View all users
- Filter by status (Active, Inactive, Blocked)
- Search by name/email
- Edit user details
- Block/Unblock users
- View any user's transaction summary

---

## 5. Reports & Analytics

### 5.1 Transaction Summary Report
- **Filters**:
  - On Date (specific date)
  - Date Range (start date, end date)
  - Closing Date (accounting period)
  - User Specific (user_id)
  - Category
  - Transaction Type (income/expense)
- **Output**: Paginated list with all matching transactions

### 5.2 Built-in Reports
| Report | Description |
|--------|-------------|
| Income vs Expense | Monthly comparison |
| Category Analysis | Spending by category |
| User Summary | Individual user totals |
| Date-wise Summary | Daily transaction totals |

---

## 6. API Endpoints (Enhanced)

### 6.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/signup | Register new user |
| POST | /auth/login | Login & get token |
| POST | /auth/change-password | Change password |
| POST | /auth/logout | Invalidate token |

### 6.2 User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /profile | Get current user profile |
| PUT | /profile | Update profile |
| GET | /profile/transactions | Own transactions |

### 6.3 Admin - Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/users | List all users |
| GET | /admin/users?status=X | Filter by status |
| GET | /admin/users/{id} | Get user details |
| PUT | /admin/users/{id} | Update user |
| PUT | /admin/users/{id}/block | Block user |
| PUT | /admin/users/{id}/unblock | Unblock user |
| GET | /admin/users/{id}/transactions | User's transaction summary |

### 6.4 Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /transactions | Create transaction |
| GET | /transactions | List (with filters) |
| GET | /transactions/{id} | Get transaction |
| PUT | /transactions/{id} | Update transaction |
| DELETE | /transactions/{id} | Delete transaction |

### 6.5 Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /reports/summary | Transaction summary |
| GET | /reports/summary?start_date=X&end_date=Y | Date range |
| GET | /reports/by-category | Category breakdown |
| GET | /reports/monthly | Monthly report |

---

## 7. Database Schema Changes

### 7.1 Users Table
```sql
ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
ALTER TABLE users ADD COLUMN password_hash NVARCHAR(255);
```

### 7.2 Transactions Table
```sql
ALTER TABLE transactions ADD COLUMN description NVARCHAR(500);
ALTER TABLE transactions ADD COLUMN created_by INT;
ALTER TABLE transactions ADD COLUMN modified_by INT;
ALTER TABLE transactions ADD COLUMN modified_at DATETIME;
```

---

## 8. Frontend Pages (If Required)

| Page | Access | Description |
|------|--------|-------------|
| /signup | Public | Registration form |
| /login | Public | Login form |
| /dashboard | User | User dashboard |
| /admin | Admin | Admin dashboard |
| /transactions | User | Transaction list |
| /transactions/new | User | Add transaction |
| /transactions/{id}/edit | User | Edit transaction |
| /profile | User | View/edit profile |
| /profile/password | User | Change password |
| /admin/users | Admin | User management |
| /admin/users/{id} | Admin | User details |
| /reports | User/Admin | Generate reports |

---

## 9. Non-Functional Requirements

### 9.1 Security
- Passwords must be hashed (bcrypt)
- JWT tokens with expiration
- Role-based access control
- SQL injection prevention
- Input validation

### 9.2 Performance
- Pagination for lists (default 20 items)
- Database indexes on frequently queried columns
- Query optimization for reports

### 9.3 Logging
- All API calls logged to MongoDB
- Track user actions
- Audit trail for data changes

---

## 10. Acceptance Criteria

- [ ] User can sign up and login
- [ ] User can view and edit profile
- [ ] User can change password
- [ ] User can create, edit, delete transactions
- [ ] Transaction shows created_by and modified_by
- [ ] User dashboard shows balance and recent transactions
- [ ] Admin can view all users
- [ ] Admin can filter users by status
- [ ] Admin can block/unblock users
- [ ] Admin can view any user's transaction summary
- [ ] Reports can be filtered by date range
- [ ] Reports can be filtered by user
- [ ] All endpoints require authentication

---

## 11. Future Enhancements (Optional)

- Email verification
- Two-factor authentication
- Export reports to PDF/Excel
- Recurring transactions
- Budget tracking
- Multi-currency support
- Transaction attachments (receipts)
- Notifications/alerts
- Data backup & restore
