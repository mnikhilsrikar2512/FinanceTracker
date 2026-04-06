# Finly Page Guide

This guide explains what each major page in Finly is for and what the main sections on that page show.

It is meant for:

- new users learning the product
- admins reviewing the platform workspace
- reviewers, teammates, or higherups who want a product walkthrough without reading code

## Product Structure

Finly is organized into 3 page groups:

- `Public pages`
- `User workspace`
- `Admin workspace`

Most in-app pages now use a compact `i` help button in the header instead of a large explanation panel. Hovering or focusing that button gives a short explanation of what the page is for.

## Public Pages

### Landing Page
File: [`Project/index.html`]

Purpose:

- introduces the product
- helps a first-time visitor decide where to start

Main sections:

- `Top navigation`
  brand, theme controls, and quick links
- `Hero`
  short product introduction and workspace overview
- `Feature overview`
  explains the main areas like transactions, budgets, reports, and admin controls
- `Start paths`
  directs visitors to login, signup, or support

### Login
File: [`Project/login.html`]

Purpose:

- signs in an existing user or admin

Main sections:

- `Login form`
  email and password
- `Primary action`
  signs the user in
- `Forgot password`
  starts recovery
- `Create account`
  sends new users to signup
- `Support links`
  gives access to the support page and landing page

Behavior notes:

- email sign-in only
- email is normalized before submit
- blocked users are rejected by the backend

### Signup
File: [`Project/signup.html`]
Purpose:

- creates a new user account

Main sections:

- `Signup form`
  name, email, and password
- `Primary action`
  creates the account
- `Login link`
  returns existing users to login

Behavior notes:

- passwords must meet stronger validation rules
- email is normalized before storage

### Forgot Password
File: [`Project/forgot-password.html`]

Purpose:

- starts password recovery

Main sections:

- `Recovery intro`
  explains the flow simply
- `Step indicator`
  shows that this is the email step
- `Email form`
  collects the account email
- `Primary action`
  requests a verification code and moves the user to reset
- `Secondary links`
  link back to login or directly to the reset step

Behavior notes:

- response wording stays generic so account existence is not exposed
- reset requests are throttled and cooldown-controlled

### Reset Password
File: [`Project/reset-password.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/reset-password.html)

Purpose:

- completes recovery using a verification code

Main sections:

- `Verification intro`
  explains the reset step
- `Reset form`
  email, verification code, new password, confirm password
- `Primary action`
  resets the password
- `Secondary links`
  request another code or return to login

Behavior notes:

- email can be prefilled from the first recovery step
- password rules match signup/change-password rules
- code delivery uses the configured Gmail/SMTP path by default

### Support
File: [`Project/support.html`]
Purpose:

- acts as the product help center
- gives new users and admins a non-technical place to start

Main sections:

- `Support hero`
  summarizes what the support center helps with
- `Contact Support`
  shows support email, phone number, support hours, and response expectations
- `Choose Your Path`
  points people to the right flow based on what they need
- `FAQ`
  answers common product and recovery questions
- `Workspace Guide`
  explains the difference between user and admin areas
- `Next actions`
  suggests what someone should open next

## User Workspace

### Dashboard
File: [`Project/app.html`]

Purpose:

- gives the user a quick financial snapshot
- helps them see what needs attention first

Main sections:

- `Header`
  greeting, workspace chip, search, theme control, date
- `Help tooltip`
  explains the page purpose through the `i` button
- `Top metric cards`
  total balance, income, and savings
- `Budget Health`
  summary of how active budgets are performing
- `Cashflow chart`
  inflow vs outflow over time
- `Spending chart`
  category-based spending mix
- `Recent Transactions`
  latest entries with a quick path to the full transactions page

Budget health behavior:

- shows updates based on `50%`, `75%`, `100%`, and `over budget`
- helps the user see whether budgets are comfortable, on watch, near limit, at limit, or over budget

### Transactions
File: [`Project/transactions.html`]

Purpose:

- serves as the main record of personal financial activity

Main sections:

- `Header`
  title, workspace chip, header tools
- `Help tooltip`
  explains what this page is used for
- `Quick Add`
  fast entry form for income and expense transactions
- `Filter bar`
  search, type, category, dates, archive filter, and sort
- `Active filter chips`
  shows which filters are shaping the current results
- `Bulk actions`
  lets the user archive, restore, or permanently delete multiple rows
- `Transaction list`
  each row shows category, description, amount, date, and actions
- `Pagination`
  handles longer result sets

Important behavior:

- `Active Only` shows current working records
- `Archived Only` shows only archived records
- `Active + Archived` shows both
- `Archive` hides a row from default views but keeps history
- `Restore` returns archived rows to active use
- `Delete Forever` removes them permanently

### Reports
File: [`Project/reports.html`]

Purpose:

- turns transaction data into a readable financial report

Main sections:

- `Header`
  title, context chip, header tools
- `Help tooltip`
  explains what the report is for
- `Date toolbar`
  filters the report range and supports export
- `Top metric cards`
  net savings, average inflow, average outflow
- `Growth Trend`
  line chart for income and expense movement over time
- `Spending Mix`
  donut chart for category distribution
- `Insights`
  top category, largest expense, activity, average transaction, trend
- `Summary`
  plain-language explanation of the current range
- `Highlights`
  quick observations worth noticing first
- `Top Spending Categories`
  ranked category table
- `Monthly Snapshot`
  period-by-period financial summary

Exports:

- `CSV`
  structured report data with overview, summary, takeaways, highlights, category leaders, and snapshot
- `PDF`
  formatted report briefing with role-aware labels, key takeaways, insights, and chart pages

Role behavior:

- user reports show personal finance data only
- admin reports show system-wide analytics and user activity summaries

### Budgets
File: [`Project/budgets.html`]

Purpose:

- helps users plan category-based spending and compare it with actual expense behavior

Main sections:

- `Header`
  title and workspace context
- `Help tooltip`
  explains the goal of budget tracking
- `Create budget`
  builds a new category budget
- `Top summary cards`
  total budgeted, total spent, total remaining
- `Budget cards`
  each card shows category, amount, spent, remaining, progress, and current status

Budget status meanings:

- `Comfortable`
  below `50%`
- `On Watch`
  `50%` to below `75%`
- `Approaching Limit`
  `75%` to below `100%`
- `At Limit`
  `100%`
- `Over Budget`
  spending has exceeded the planned amount

Important behavior:

- budgets are personal, not shared across users
- they compare expense transactions against category and date range
- threshold updates also feed into notifications/log history

### Notifications
File: [`Project/logs.html`]

Purpose:

- gives the user a readable timeline of important account activity

Main sections:

- `Header`
  title and workspace context
- `Activity list`
  human-readable activity cards instead of raw audit rows
- `Event summary`
  explains what happened in plain language
- `Severity and entity tags`
  give context such as info, warning, transaction, or budget
- `Timestamp`
  shows when the event happened
- `Pagination`
  supports longer history

What appears here:

- sign-in activity
- profile changes
- transaction actions
- budget actions and threshold updates
- account-level events

### Profile
File: [`Project/profile.html`]

Purpose:

- gives users a single place to manage identity and security

Main sections:

- `Header`
  title and workspace context
- `Help tooltip`
  explains the page purpose
- `Account Overview`
  name, email, role, status, joined date
- `Profile Details`
  update name and email
- `Password`
  change password
- `Danger Zone`
  logout and permanent account deletion

Important behavior:

- email is normalized and checked for duplicates
- password changes require the current password
- account deletion is permanent and requires confirmation

## Admin Workspace

### Admin Dashboard
File: [`Project/admin.html`]

Purpose:

- serves as the admin command center

Main sections:

- `Header`
  title, system-admin chip, header tools
- `Help tooltip`
  explains the purpose of the dashboard
- `Top KPI cards`
  total users, active users, blocked users, active system transactions
- `User Directory`
  quick user list with backend-backed search and fast block/unblock actions where allowed
- `User Composition`
  chart showing the split between active, blocked, and admin users
- `System Activity`
  latest operational activity summaries

Best use:

- start here for a quick platform check
- then move to users, transactions, logs, or reports for deeper work

### User Management
File: [`Project/admin-users.html`]

Purpose:

- manages account access and identity review

Main sections:

- `Header`
  title and admin context
- `Help tooltip`
  explains how this page should be used
- `Details panel`
  role, email, status, join date, internal id
- `Filter bar`
  search and status filtering
- `Users table`
  list of users with role, status, and actions
- `Pagination`
  supports large directories

Important behavior:

- admin accounts are protected from block actions
- regular users can be blocked or unblocked

### System Transactions
File: [`Project/admin-transactions.html`]

Purpose:

- gives admins a platform-wide audit surface for money movement

Main sections:

- `Header`
  title and admin context
- `Help tooltip`
  explains the audit purpose
- `Filter bar`
  user, type, category, sort, amount range, and other scope controls
- `Active filter chips`
  summarizes the current audit scope
- `Bulk actions`
  archive, restore, or delete multiple transactions
- `Transactions table`
  timestamp, origin, category, status, value, and actions
- `Details modal`
  deeper view of one transaction
- `Pagination`
  for large result sets

Important behavior:

- `Active` means visible in normal views and analytics
- `Archived` means hidden from default views but retained
- admins can inspect records across all users

### Operation Logs
File: [`Project/admin-logs.html`]

Purpose:

- gives admins a traceable operational audit history

Main sections:

- `Header`
  title and admin context
- `Help tooltip`
  explains how to use severity, action, and dates together
- `Top KPI cards`
  counts of info, warning, and error logs
- `Filter bar`
  level, action, and date filters
- `Active filter chips`
  current log scope
- `Logs table`
  readable actor, action summary, severity, request id, and details access
- `Details modal`
  structured view of activity, actor, metadata, and payload
- `Pagination`
  supports longer audit history

How to read levels:

- `INFO`
  standard product activity
- `WARNING`
  actions that need attention or represent elevated impact
- `ERROR`
  failure conditions or broken flows

### Admin Reports
File: [`Project/reports.html`]

Purpose:

- gives admins a system-wide analytics and reporting view

What is different from user reports:

- shows platform-level metrics instead of personal metrics
- includes all-user transaction summary
- only includes users with activity in the selected range
- export files are structured as system analytics reports rather than personal finance reports

Main sections:

- the page layout is shared with user reports
- copy, metrics, tables, and export content switch based on admin role

### Admin Profile
File: [`Project/admin-profile.html`]

Purpose:

- lets the signed-in admin manage their own identity and security

Main sections:

- `Header`
  title and admin context
- `Help tooltip`
  explains that this page affects only the current admin account
- `Account Overview`
  name, email, role, status, member since
- `Profile Details`
  update name and email
- `Password`
  change password
- `Danger Zone`
  logout and permanent admin-account deletion

Important behavior:

- admin deletion uses stronger confirmation text
- deleting the last admin is blocked by the backend

### Categories
File: [`Project/categories.html`]

Purpose:

- manages the category structure used across transactions, budgets, and reports

Main sections:

- `Header`
  title and admin context
- `Quick Create`
  create a new category
- `Categories list`
  grouped by income and expense
- `Delete with reassignment`
  removes a category safely without leaving related transactions stranded

Important behavior:

- duplicate category names are blocked
- required create fields must be valid before creation is allowed

## Suggested Walkthroughs

### For a new user

1. Open the landing page
2. Review support if needed
3. Sign up or log in
4. Add a few transactions
5. Create a budget
6. Check dashboard and reports
7. Review notifications

### For an admin reviewer

1. Log in as admin
2. Start on admin dashboard
3. Search and review users
4. Open system transactions
5. Check admin logs
6. Review admin reports

## Related Docs

- [README.md]
