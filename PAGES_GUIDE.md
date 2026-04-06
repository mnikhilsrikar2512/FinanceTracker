# Finly Page Guide

This document explains every major page in Finly and what each section is meant to show.

It is written for:

- new users who are opening the product for the first time
- admins who need to understand the system workspace quickly
- reviewers or higherups who want a clean overview without reading code

## Product Structure

Finly has 3 layers of pages:

- `Public pages`
  landing, login, signup, support, and password recovery
- `User workspace`
  personal finance tracking pages
- `Admin workspace`
  system-wide management and audit pages

## Public Pages

### `/`
File: [`Project/index.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/index.html)

Purpose:

- gives a first impression of the product
- explains the difference between user and admin experiences
- helps new visitors decide whether to sign up, log in, or review the admin flow

Main sections:

- `Top navigation`
  shows the brand, theme tools, and quick links to log in or sign up
- `Hero section`
  explains the product in one sentence and shows the two main workspaces
- `How it works`
  explains the product separately for users and admins
- `Product tour`
  briefly explains the main feature areas: transactions, budgets, reports, and logs
- `Start here`
  gives clear next steps for a new user, an existing user, or an admin reviewer

### `/login.html`
File: [`Project/login.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/login.html)

Purpose:

- authenticates existing users and admins

Main sections:

- `Login form`
  email and password inputs
- `Primary action`
  signs the user in and routes them to the correct workspace
- `Forgot password link`
  opens the recovery flow when someone cannot sign in
- `Create account link`
  sends new visitors to signup

Behavior notes:

- login uses email-format validation
- email input is normalized before submit
- blocked users are rejected by the API even with correct credentials

### `/signup.html`
File: [`Project/signup.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/signup.html)

Purpose:

- creates a new user account

Main sections:

- `Signup form`
  collects name, email, and password
- `Primary action`
  creates the account and signs the user in
- `Login link`
  sends existing users back to login

Behavior notes:

- signup passwords must include at least 8 characters, uppercase, lowercase, and a number
- email input is normalized before submit

### `/forgot-password.html`
File: [`Project/forgot-password.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/forgot-password.html)

Purpose:

- starts the password recovery flow

Main sections:

- `Recovery intro`
  explains the recovery step in plain language
- `Step card`
  tells the user they are requesting a verification code
- `Email form`
  collects the account email address
- `Primary action`
  requests a reset code and moves the user to the next step
- `Recovery links`
  let the user jump to login or directly to the code-entry page

Behavior notes:

- the page always uses a generic response so account existence is not exposed
- reset-code requests are throttled and also use a resend cooldown
- reset-code delivery prefers Gmail/SMTP first through the installed Nodemailer bridge
- Gmail works well here when configured with an app password

### `/reset-password.html`
File: [`Project/reset-password.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/reset-password.html)

Purpose:

- completes the recovery flow with code verification and a new password

Main sections:

- `Recovery intro`
  explains the verification step
- `Notice box`
  confirms that a code request was accepted
- `Reset form`
  collects email, verification code, new password, and confirmation
- `Primary action`
  resets the password and sends the user back to login
- `Recovery links`
  let the user request another code or return to login

Behavior notes:

- the remembered email is carried forward automatically from step 1
- reset passwords must meet the stronger password rules
- invalid reset attempts are throttled
- code delivery uses the configured mail provider and prefers SMTP first

### `/support.html`
File: [`Project/support.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/support.html)

Purpose:

- gives new users and admins a simple customer-help entry point
- explains the most common flows without requiring them to open product pages first

Main sections:

- `Support hero`
  explains the purpose of the help center and points people to login or recovery
- `Quick answers`
  directs users to the right first page for common needs
- `Common topics`
  explains the difference between user and admin areas in plain language
- `Need more help`
  gives clear next steps for recovery, overview, and admin review

## User Workspace

### Dashboard
File: [`Project/app.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/app.html)

Purpose:

- gives a quick personal financial snapshot
- highlights what needs attention first

Main sections:

- `Page header`
  greeting, workspace label, search, and header tools
- `Start Here`
  explains how a first-time user should read this page
- `Top metric cards`
  show balance, income, and savings
- `Budget Health`
  explains whether active budgets are healthy, near limit, or unavailable
- `Cashflow chart`
  compares inflow and outflow over time
- `Spending chart`
  shows where expenses are concentrated by category
- `Recent Transactions`
  gives a short list of the latest activity with links to the full transactions page

How to use it:

- start with the top numbers
- review the budget health callout
- use recent transactions to drill into details

### Transactions
File: [`Project/transactions.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/transactions.html)

Purpose:

- acts as the user’s source of truth for recorded money movement

Main sections:

- `Page header`
  title, personal workspace badge, and header tools
- `How To Use This Page`
  explains quick add, filtering, and archive vs delete
- `Quick Add`
  creates a new income or expense entry quickly
- `Filter bar`
  narrows records by search, type, category, date, sort, and archived state
- `Active filters`
  shows which filters are currently shaping the results
- `Bulk actions`
  lets the user archive, restore, or permanently delete multiple selected rows
- `Transaction list`
  shows each transaction with description, amount, date, and actions
- `Pagination`
  moves through the result set page by page

Important behavior:

- `Archive` keeps history but hides the row from default views
- `Restore` brings archived items back
- `Delete Forever` permanently removes the row
- `Export CSV` downloads the current transaction dataset

### Reports
File: [`Project/reports.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/reports.html)

Purpose:

- turns raw transactions into a personal report that is easier to understand

Main sections:

- `Page header`
  title, context badge, and header tools
- `How To Read This Report`
  explains the order in which the page should be read
- `Date toolbar`
  filters the report by date range and exports CSV or PDF
- `Top metric cards`
  show net savings, average inflow, and average outflow
- `Growth Trend`
  shows income and expense movement over time
- `Spending Mix`
  shows which categories drive spending
- `Insights`
  converts the numbers into simpler labels like top category, largest expense, and trend direction
- `Summary`
  gives a plain-language explanation of the current range
- `Highlights`
  surfaces the most important quick observations
- `Top Spending Categories`
  ranks the categories contributing most to spend
- `Monthly Snapshot`
  gives a compact table of income, expense, and net movement by period

Exports:

- `CSV`
  structured report data for spreadsheet review
- `PDF`
  readable report summary with metrics, insights, and chart pages

Role behavior:

- users see personal finance reporting for their own transactions
- admins see system analytics, including an all-user transaction summary that only includes users with activity in the selected range

### Budgets
File: [`Project/budgets.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/budgets.html)

Purpose:

- helps users set spending limits and compare real expenses against those limits

Main sections:

- `Page header`
  title and workspace context
- `Create New Budget`
  creates a category budget for a time period
- `Top summary cards`
  show total budgeted amount, total spent, and remaining amount
- `Budget list/cards`
  show the health of each budget, including progress and over-budget state

How budgets work:

- budgets are personal, not admin-wide
- they compare expense transactions against a selected category and date range
- they only become meaningful when matching expense transactions exist

### Notifications / Activity Logs
File: [`Project/logs.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/logs.html)

Purpose:

- shows a personal history of account-level actions

Main sections:

- `Page header`
  title and workspace context
- `Activity list`
  shows readable labels for actions such as login or account activity
- `Date and time column`
  makes it easy to see recency
- `Pagination`
  moves across the history when there are more records

What it is for:

- checking recent activity
- confirming account actions
- giving users a simple timeline instead of raw system logs

### Profile & Security
File: [`Project/profile.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/profile.html)

Purpose:

- gives users one place to manage their account identity and security

Main sections:

- `Page header`
  title, workspace context, and header tools
- `Start Here`
  explains the safe order for profile, password, and danger-zone actions
- `Account Overview`
  shows name, email, role, status, and member-since date
- `Profile Details`
  lets the user update their name and email
- `Password`
  lets the user change their password with the stronger password rules
- `Danger Zone`
  provides logout and permanent account deletion

Important behavior:

- email changes are normalized and checked against existing accounts
- password changes require the current password
- account deletion is permanent and requires a typed confirmation

## Admin Workspace

### Admin Dashboard
File: [`Project/admin.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin.html)

Purpose:

- acts as the admin starting point and quick operational overview

Main sections:

- `Page header`
  title, admin badge, and header tools
- `Admin Guide`
  explains how to use the page as a command center
- `Top KPI cards`
  show total users, active users, blocked users, and active system transactions
- `User Directory`
  shows a short list of users with quick block or unblock controls where allowed
- `User Composition`
  shows the split between active users, blocked users, and admins
- `System Activity`
  shows recent operational log events

Best use:

- start here, then move to users, transactions, logs, or reports for deeper review

### User Management
File: [`Project/admin-users.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-users.html)

Purpose:

- manages account access and reviews user identity information

Main sections:

- `Page header`
  title and admin context
- `Admin Guide`
  explains how to review a user before taking action
- `Details panel`
  shows role, email, status, created date, and internal id for the selected user
- `Filter bar`
  narrows the directory by search and status
- `Users table`
  lists users with role, status, and management controls
- `Pagination`
  supports larger user directories

Important behavior:

- admin accounts are protected and do not expose block actions in the UI
- regular users can be blocked or unblocked

### System Transactions
File: [`Project/admin-transactions.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-transactions.html)

Purpose:

- provides a system-wide audit surface for all transactions

Main sections:

- `Page header`
  title and admin context
- `Admin Guide`
  explains how to investigate and manage records safely
- `Filter bar`
  filters by user, type, category, sort, and amount range
- `Active filters`
  summarizes the current audit scope
- `Bulk actions`
  archives, restores, or deletes multiple rows
- `Transactions table`
  shows date, origin, category, status, value, and per-row actions
- `Transaction details modal`
  gives a closer look at the selected record
- `Pagination`
  handles large system datasets

Important behavior:

- `Active` means visible in default analytics and lists
- `Archived` means retained but hidden from normal views
- admins can audit across all users

### Operation Logs
File: [`Project/admin-logs.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-logs.html)

Purpose:

- gives admins a traceable view of operational events across the platform

Main sections:

- `Page header`
  title and admin context
- `Admin Guide`
  explains how to use severity, action, and dates to trace incidents
- `Top KPI cards`
  show counts of INFO, WARNING, and ERROR logs
- `Filter bar`
  filters by level, action type, and date range
- `Active filters`
  summarizes the current log scope
- `Logs table`
  shows timestamp, identity, operation, level, request id, and details access
- `Details modal`
  shows raw event payload and metadata
- `Pagination`
  handles long operational histories

How to read levels:

- `INFO`
  normal system activity
- `WARNING`
  admin actions or unusual states
- `ERROR`
  failure conditions or broken flows

### Admin Profile & Security
File: [`Project/admin-profile.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-profile.html)

Purpose:

- gives admins a self-service page for their own identity, password, logout, and account deletion

Main sections:

- `Page header`
  title and admin context
- `Admin Guide`
  explains that this page is for the current admin account only
- `Account Overview`
  shows name, email, status, and member-since date
- `Profile Details`
  updates the admin’s own name and email
- `Password`
  changes the current admin password
- `Danger Zone`
  allows logout and permanent admin-account deletion with stronger confirmation text

Important behavior:

- this page is only for the currently signed-in admin
- admin deletion uses a stricter typed confirmation to reduce mistakes
- deleting an admin account is permanent and may affect team access

### Categories
File: [`Project/categories.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/categories.html)

Purpose:

- gives admins oversight of system categories and lets them manage category structure

Main sections:

- `Page header`
  title and admin context
- `Quick Create`
  adds a new income or expense category
- `Categories list`
  shows current categories grouped by type
- `Delete Category dialog/panel`
  supports deletion with reassignment so dependent transactions are not stranded

Why it matters:

- category quality affects reporting, budgets, and transaction filtering

## Role-Based Reports

The reports page is shared, but the meaning changes by role.

### User report

- focuses on one user’s own money
- explains personal savings, spending, categories, and trends

### Admin report

- focuses on system-wide activity
- summarizes all users together
- includes an `All User Transaction Summary` section that only shows users with activity in the selected range
- uses system-level KPIs and exports rather than personal finance wording

## Recommended First-Time Flows

### New user

1. Open the landing page.
2. Create an account or log in.
3. If needed, use the forgot-password flow instead of creating a duplicate account.
4. Open `Transactions` and add a first income or expense.
5. Return to `Dashboard` to review the top metrics.
6. Create a budget and then open `Reports` to understand the result.

### New admin

1. Log in and open `Command Center`.
2. Review the KPI cards and recent activity.
3. Open `User Management` to understand the user base.
4. Open `System Transactions` to audit records.
5. Open `Reports` for the system-wide summary.
6. Use `Operation Logs` when investigating specific incidents.

## Key Terms

- `Archive`
  hide a record from normal views without destroying it
- `Restore`
  bring an archived record back into active views
- `Delete Forever`
  permanently remove a record
- `Personal Workspace`
  user-only finance experience
- `System Admin`
  admin-only operational experience

## Files Covered

- [`Project/index.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/index.html)
- [`Project/login.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/login.html)
- [`Project/signup.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/signup.html)
- [`Project/forgot-password.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/forgot-password.html)
- [`Project/reset-password.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/reset-password.html)
- [`Project/app.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/app.html)
- [`Project/transactions.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/transactions.html)
- [`Project/reports.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/reports.html)
- [`Project/budgets.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/budgets.html)
- [`Project/logs.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/logs.html)
- [`Project/profile.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/profile.html)
- [`Project/admin.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin.html)
- [`Project/admin-users.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-users.html)
- [`Project/admin-transactions.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-transactions.html)
- [`Project/admin-logs.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-logs.html)
- [`Project/admin-profile.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/admin-profile.html)
- [`Project/categories.html`](/Users/bhargavnikhil/Desktop/finance_tracker/Project/categories.html)
