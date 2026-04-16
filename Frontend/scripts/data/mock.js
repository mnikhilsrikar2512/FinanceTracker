import { formatDate } from "../core/format.js";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

function iso(daysAgo, hour = 10) {
  const date = new Date(now - daysAgo * day);
  date.setHours(hour, 30, 0, 0);
  return date.toISOString();
}

export const mockProfile = {
  id: 1,
  name: "Aarav Mehta",
  email: "aarav@finly.app",
  role: "user",
  status: "active",
  created_at: iso(320),
};

export const mockAdminProfile = {
  id: 11,
  name: "System Admin",
  email: "admin@financetracker.com",
  role: "admin",
  status: "active",
  created_at: iso(420),
};

export const mockTransactions = [
  { id: 1, description: "Salary credit", amount: 92000, category_id: 2, category_name: "Salary", type: "income", date: iso(2), is_deleted: false },
  { id: 2, description: "Groceries", amount: -4280, category_id: 1, category_name: "Food & Dining", type: "expense", date: iso(1), is_deleted: false },
  { id: 3, description: "Metro recharge", amount: -860, category_id: 3, category_name: "Transport", type: "expense", date: iso(3), is_deleted: false },
  { id: 4, description: "Freelance payout", amount: 14500, category_id: 4, category_name: "Side Income", type: "income", date: iso(5), is_deleted: false },
  { id: 5, description: "Weekend dining", amount: -2100, category_id: 1, category_name: "Food & Dining", type: "expense", date: iso(6), is_deleted: true },
];

export const mockBudgets = [
  { id: 1, category_id: 1, category_name: "Food & Dining", amount: 15000, period: "monthly", created_at: iso(28) },
  { id: 2, category_id: 3, category_name: "Transport", amount: 5000, period: "monthly", created_at: iso(28) },
  { id: 3, category_id: 5, category_name: "Shopping", amount: 9000, period: "monthly", created_at: iso(28) },
];

export const mockBudgetSummary = [
  { budget_id: 1, category_id: 1, spent: 10440, remaining: 4560, percentage_used: 70, is_over_budget: false },
  { budget_id: 2, category_id: 3, spent: 3900, remaining: 1100, percentage_used: 78, is_over_budget: false },
  { budget_id: 3, category_id: 5, spent: 9200, remaining: -200, percentage_used: 102, is_over_budget: true },
];

export const mockCategories = [
  { id: 1, name: "Food & Dining", type: "expense", usage: 24 },
  { id: 2, name: "Salary", type: "income", usage: 8 },
  { id: 3, name: "Transport", type: "expense", usage: 15 },
  { id: 4, name: "Investment", type: "income", usage: 3 },
];

export const mockNotifications = [
  { id: 1, action_label: "Budget alert", action_description: "Food & Dining crossed 69% of the monthly plan.", level: "warning", created_at: iso(0, 11) },
  { id: 2, action_label: "Salary received", action_description: "Your salary transaction was marked as posted.", level: "info", created_at: iso(0, 9) },
  { id: 3, action_label: "Account security", action_description: "Password was changed successfully.", level: "info", created_at: iso(1, 16) },
];

export const mockLogs = [
  { id: 1, action_label: "Login success", action_description: "Admin accessed the command center", level: "info", created_at: iso(0, 9), user_name: "System Admin" },
  { id: 2, action_label: "Category create", action_description: "New expense category created", level: "success", created_at: iso(1, 11), user_name: "System Admin" },
  { id: 3, action_label: "Blocked user", action_description: "A user account was blocked by admin", level: "warning", created_at: iso(2, 16), user_name: "System Admin" },
];

export const mockLogStats = {
  total: mockLogs.length,
  by_level: {
    info: 1,
    success: 1,
    warning: 1,
    error: 0,
  },
  by_action: {
    login_success: 1,
    category_create: 1,
    blocked_user: 1,
  },
  by_user: {
    "System Admin": 3,
  },
};

export const mockUsers = [
  { id: 1, name: "Aarav Mehta", email: "aarav@finly.app", role: "user", status: "active" },
  { id: 2, name: "Neha Sharma", email: "neha@finly.app", role: "user", status: "blocked" },
  { id: 11, name: "System Admin", email: "admin@financetracker.com", role: "admin", status: "active" },
];

export const mockUserSummary = {
  overview: {
    total_income: 154800,
    total_expense: 97500,
    balance: 127500,
  },
  monthly_summary: [
    { month: "Jan", total_income: 120000, total_expense: 82000, balance: 38000 },
    { month: "Feb", total_income: 128000, total_expense: 91000, balance: 37000 },
    { month: "Mar", total_income: 135000, total_expense: 94000, balance: 41000 },
    { month: "Apr", total_income: 154800, total_expense: 97500, balance: 57200 },
  ],
  category_summary: [
    { category_name: "Food & Dining", total_expense: 38240 },
    { category_name: "Transport", total_expense: 17800 },
    { category_name: "Shopping", total_expense: 24100 },
    { category_name: "Bills", total_expense: 17360 },
  ],
};

export const mockAdminDashboard = {
  total_users: mockUsers.length,
  active_users: mockUsers.filter((user) => user.status === "active").length,
  blocked_users: mockUsers.filter((user) => user.status === "blocked").length,
  total_transactions: mockTransactions.length,
};

export const mockAdminAnalytics = {
  total_income: 154800,
  total_expense: 97500,
  balance: 57300,
  monthly_summary: [
    { month: "Jan", total_income: 120000, total_expense: 82000, balance: 38000 },
    { month: "Feb", total_income: 128000, total_expense: 91000, balance: 37000 },
    { month: "Mar", total_income: 135000, total_expense: 94000, balance: 41000 },
    { month: "Apr", total_income: 154800, total_expense: 97500, balance: 57300 },
  ],
  category_summary: [
    { category_name: "Food & Dining", total_expense: 38240 },
    { category_name: "Transport", total_expense: 17800 },
    { category_name: "Shopping", total_expense: 24100 },
    { category_name: "Bills", total_expense: 17360 },
  ],
};

export function buildFallbackSummary() {
  return mockUserSummary;
}

export function buildFallbackAdminDashboard() {
  return mockAdminDashboard;
}

export function buildFallbackAdminAnalytics() {
  return mockAdminAnalytics;
}

export function buildFallbackBudgetSummary() {
  return mockBudgetSummary;
}

export function buildFallbackLogStats() {
  return mockLogStats;
}

export function buildFallbackNotifications() {
  return mockNotifications;
}

export function buildFallbackLogs() {
  return mockLogs;
}

export function formatCreatedAt(date = new Date()) {
  return formatDate(date);
}

