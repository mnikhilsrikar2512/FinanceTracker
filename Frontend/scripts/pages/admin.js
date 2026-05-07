import { apiRequest, isDemoMode, normalizeDetail, normalizeList } from "../core/api.js?v=20260507j";
import { donutChartSVG, lineChartSVG } from "../core/charts.js?v=20260507j";
import {
  badge,
  button,
  cardList,
  emptyState,
  formatTableAmount,
  formatTableDate,
  hero,
  infoRow,
  inputField,
  metricCard,
  panel,
  rowAction,
  selectField,
  statusBadge,
  table,
  timelineItem,
} from "../core/ui.js?v=20260507j";
import { escapeHtml } from "../core/dom.js?v=20260507j";
import { downloadCsv, downloadFinancialReportPdf } from "../core/export.js?v=20260507j";
import { formatDate, formatDateTime, formatINR } from "../core/format.js?v=20260507j";
import {
  buildFallbackAdminAnalytics,
  buildFallbackAdminDashboard,
  buildFallbackLogStats,
  mockCategories,
  mockLogs,
  mockProfile,
  mockTransactions,
  mockUsers,
} from "../data/mock.js?v=20260507j";

const ADMIN_USERS_FILTER_KEY = "finly.adminUsers.filters";
const ADMIN_TXN_FILTER_KEY = "finly.adminTransactions.filters";
const ADMIN_LOG_FILTER_KEY = "finly.adminLogs.filters";
const ADMIN_REPORT_TREND_MODE_KEY = "finly.adminReports.trendMode";

const ADMIN_REPORT_TREND_LABELS = {
  net: "Net",
  income: "Inflow",
  expense: "Outflow",
};

function dashboardEmptyState(title, description, actionLabel, actionTarget, icon = "◎") {
  return emptyState(
    title,
    description,
    button(actionLabel, { variant: "primary", attrs: `data-go="${actionTarget}"` }),
    icon,
  );
}

function hasMeaningfulSeries(series = []) {
  return Array.isArray(series) && series.some((item) => Math.abs(Number(item?.value ?? 0)) > 0);
}

function hasMeaningfulCategories(series = []) {
  return Array.isArray(series) && series.some((item) => Number(item?.value ?? 0) > 0);
}

function safeStorageGet(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  } catch {
    return fallback;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures (private mode / quota exceeded).
  }
}

function readAdminReportTrendMode() {
  const saved = String(safeStorageGet(ADMIN_REPORT_TREND_MODE_KEY, "net") || "net");
  return ADMIN_REPORT_TREND_LABELS[saved] ? saved : "net";
}

function writeAdminReportTrendMode(value) {
  if (ADMIN_REPORT_TREND_LABELS[value]) {
    safeStorageSet(ADMIN_REPORT_TREND_MODE_KEY, value);
  }
}

function renderPagination(meta = {}, actionPrefix) {
  const page = Number(meta.page || 1) || 1;
  const totalPages = Math.max(1, Number(meta.total_pages || 1) || 1);
  const total = Number(meta.total || 0) || 0;
  const limit = Number(meta.limit || 0) || 0;
  const offset = Number(meta.offset || 0) || 0;
  const start = total ? offset + 1 : 0;
  const end = total ? Math.min(total, offset + limit) : 0;
  return `
    <div class="pagination">
      <span class="pagination-meta">Showing ${start}-${end} of ${total}</span>
      <div class="toolbar">
        ${button("Previous", {
          variant: "secondary",
          attrs: `data-action="${actionPrefix}-prev" ${page <= 1 ? "disabled" : ""}`,
        })}
        <span class="pill">Page ${page} of ${totalPages}</span>
        ${button("Next", {
          variant: "secondary",
          attrs: `data-action="${actionPrefix}-next" ${page >= totalPages ? "disabled" : ""}`,
        })}
      </div>
    </div>
  `;
}

function defaultAdminUsersFilters() {
  return { search: "", status: "", page: 1, limit: 12, sort_by: "created_at", sort_order: "desc" };
}

function readAdminUsersFilters() {
  try {
    const parsed = JSON.parse(safeStorageGet(ADMIN_USERS_FILTER_KEY, "{}") || "{}");
    const status = String(parsed.status || "").toLowerCase();
    return {
      ...defaultAdminUsersFilters(),
      ...parsed,
      page: Math.max(1, Number(parsed.page || 1) || 1),
      limit: Math.min(50, Math.max(5, Number(parsed.limit || 12) || 12)),
      status: ["", "active", "blocked"].includes(status) ? status : "",
      sort_by: ["created_at", "name", "email"].includes(String(parsed.sort_by || "").toLowerCase())
        ? String(parsed.sort_by).toLowerCase()
        : "created_at",
      sort_order: String(parsed.sort_order || "").toLowerCase() === "asc" ? "asc" : "desc",
    };
  } catch {
    return defaultAdminUsersFilters();
  }
}

function writeAdminUsersFilters(filters) {
  safeStorageSet(ADMIN_USERS_FILTER_KEY, JSON.stringify({ ...defaultAdminUsersFilters(), ...filters }));
}

function defaultAdminTxnFilters() {
  return {
    search: "",
    type: "",
    category_id: "",
    archive_filter: "all",
    min_amount: "",
    max_amount: "",
    start_date: "",
    end_date: "",
    sort_by: "date",
    sort_order: "desc",
    page: 1,
    limit: 12,
  };
}

function readAdminTxnFilters() {
  try {
    const parsed = JSON.parse(safeStorageGet(ADMIN_TXN_FILTER_KEY, "{}") || "{}");
    const archiveRaw = String(parsed.archive_filter ?? parsed.status ?? "").toLowerCase();
    const archiveFilter = ["active", "archived", "all"].includes(archiveRaw) ? archiveRaw : "all";
    return {
      ...defaultAdminTxnFilters(),
      ...parsed,
      page: Math.max(1, Number(parsed.page || 1) || 1),
      limit: Math.min(50, Math.max(5, Number(parsed.limit || 12) || 12)),
      sort_by: ["date", "amount", "description", "created_at"].includes(String(parsed.sort_by || "").toLowerCase())
        ? String(parsed.sort_by).toLowerCase()
        : "date",
      sort_order: String(parsed.sort_order || "").toLowerCase() === "asc" ? "asc" : "desc",
      category_id: parsed.category_id ? String(parsed.category_id) : "",
      archive_filter: archiveFilter,
    };
  } catch {
    return defaultAdminTxnFilters();
  }
}

function writeAdminTxnFilters(filters) {
  safeStorageSet(ADMIN_TXN_FILTER_KEY, JSON.stringify({ ...defaultAdminTxnFilters(), ...filters }));
}

function defaultAdminLogFilters() {
  return {
    action: "",
    level: "",
    request_id: "",
    start_date: "",
    end_date: "",
    page: 1,
    limit: 12,
  };
}

function readAdminLogFilters() {
  try {
    const parsed = JSON.parse(safeStorageGet(ADMIN_LOG_FILTER_KEY, "{}") || "{}");
    return {
      ...defaultAdminLogFilters(),
      ...parsed,
      page: Math.max(1, Number(parsed.page || 1) || 1),
      limit: Math.min(50, Math.max(5, Number(parsed.limit || 12) || 12)),
      action: parsed.action ? String(parsed.action).toUpperCase() : "",
      level: parsed.level ? String(parsed.level).toLowerCase() : "",
      request_id: parsed.request_id ? String(parsed.request_id) : "",
    };
  } catch {
    return defaultAdminLogFilters();
  }
}

function writeAdminLogFilters(filters) {
  safeStorageSet(ADMIN_LOG_FILTER_KEY, JSON.stringify({ ...defaultAdminLogFilters(), ...filters }));
}

async function fetchOrFallback(ctx, path, fallback, options = {}) {
  try {
    const payload = await ctx.api(path, options);
    const detail = normalizeDetail(payload);
    if (Array.isArray(detail)) return detail;
    if (detail && typeof detail === "object" && Object.keys(detail).length === 0) {
      if (isDemoMode()) return typeof fallback === "function" ? fallback() : fallback;
      throw new Error(`Empty response from ${path}`);
    }
    return detail ?? fallback;
  } catch (error) {
    if (isDemoMode()) return typeof fallback === "function" ? fallback(error) : fallback;
    throw error;
  }
}

function adminTrendSeries(analytics = {}) {
  const toBucketDate = (raw, index) => {
    if (!raw) return new Date(2000 + index, 0, 1);
    const text = String(raw).trim();
    const monthMatch = text.match(/^(\d{4})-(\d{1,2})/);
    if (monthMatch) {
      const year = Number(monthMatch[1]);
      const month = Number(monthMatch[2]) - 1;
      if (!Number.isNaN(year) && !Number.isNaN(month)) return new Date(year, month, 1);
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(2000 + index, 0, 1);
  };

  const toBucketLabel = (key, index) => {
    const raw = String(key ?? "").trim();
    if (!raw) return `P${index + 1}`;

    const monthMatch = raw.match(/^(\d{4})-(\d{1,2})/);
    if (monthMatch) {
      const year = Number(monthMatch[1]);
      const month = Number(monthMatch[2]) - 1;
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(year, month, 1));
      }
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(parsed);
    }

    return raw.slice(0, 10);
  };

  const buckets = new Map();
  (analytics.monthly_summary ?? []).forEach((item, index) => {
    const key = item.bucketStartKey ?? item.bucket ?? item.label ?? `${item.year ?? "y"}-${item.month ?? index}`;
    const existing = buckets.get(key) ?? 0;

    if (item.type) {
      const total = Number(item.total ?? 0) || 0;
      const signedTotal = item.type === "expense" ? -Math.abs(total) : Math.abs(total);
      buckets.set(key, existing + signedTotal);
      return;
    }

    const derived = Number(item.balance ?? item.total_balance ?? item.net_position ?? 0);
    buckets.set(key, existing + derived);
  });

  return [...buckets.entries()]
    .map(([key, value], index) => ({
      key,
      value,
      date: toBucketDate(key, index),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item, index) => ({
      label: toBucketLabel(item.key, index),
      value: item.value,
    }));
}

function adminCategorySeries(analytics = {}) {
  return (analytics.category_summary ?? [])
    .map((item, index) => ({
      label: item.category_name ?? item.name ?? item.category ?? `Category ${index + 1}`,
      value: Math.abs(Number(item.total_expense ?? item.total_amount ?? item.amount ?? item.total_income ?? item.total ?? item.value ?? 0) || 0),
      color: ["#7dd3fc", "#34d399", "#a78bfa", "#fbbf24"][index % 4],
    }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
}

function adminTrendSeriesByMode(analytics = {}, mode = "net") {
  if (mode === "net") return adminTrendSeries(analytics);

  const toBucketDate = (raw, index) => {
    const text = String(raw ?? "").trim();
    const monthMatch = text.match(/^(\d{4})-(\d{1,2})/);
    if (monthMatch) {
      const year = Number(monthMatch[1]);
      const month = Number(monthMatch[2]) - 1;
      if (!Number.isNaN(year) && !Number.isNaN(month)) return new Date(year, month, 1);
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(2000 + index, 0, 1);
  };

  const toBucketLabel = (key, index) => {
    const raw = String(key ?? "").trim();
    if (!raw) return `P${index + 1}`;
    const monthMatch = raw.match(/^(\d{4})-(\d{1,2})/);
    if (monthMatch) {
      const year = Number(monthMatch[1]);
      const month = Number(monthMatch[2]) - 1;
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(year, month, 1));
      }
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(parsed);
    }
    return raw.slice(0, 10);
  };

  const buckets = new Map();
  (analytics.monthly_summary ?? []).forEach((item, index) => {
    if (String(item.type || "").toLowerCase() !== String(mode).toLowerCase()) return;
    const key = item.bucketStartKey ?? item.bucket ?? item.label ?? `${item.year ?? "y"}-${item.month ?? index}`;
    const current = buckets.get(key) ?? 0;
    buckets.set(key, current + Math.abs(Number(item.total ?? item.amount ?? 0) || 0));
  });

  return [...buckets.entries()]
    .map(([key, value], index) => ({ key, value, date: toBucketDate(key, index) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item, index) => ({ label: toBucketLabel(item.key, index), value: item.value }));
}

function trendFromCurrentPrevious(current, previous, fallbackKind = "up") {
  const cur = Number(current ?? 0);
  const prev = Number(previous ?? 0);
  if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev === 0) {
    return { label: "Live", kind: fallbackKind };
  }
  const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
  return {
    value: Math.abs(pct),
    kind: pct >= 0 ? "up" : "down",
  };
}

function recentSeriesTrend(series = [], fallbackKind = "up") {
  if (!Array.isArray(series) || series.length < 2) return { label: "Live", kind: fallbackKind };
  const current = Number(series[series.length - 1]?.value ?? 0);
  const previous = Number(series[series.length - 2]?.value ?? 0);
  return trendFromCurrentPrevious(current, previous, fallbackKind);
}

function topCategoryCoverage(series = []) {
  const total = series.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const top3 = series.slice(0, 3).reduce((sum, item) => sum + Number(item.value || 0), 0);
  return total > 0 ? Math.round((top3 / total) * 100) : 0;
}

function seriesExtrema(series = []) {
  if (!Array.isArray(series) || !series.length) {
    return { high: null, low: null };
  }
  let high = series[0];
  let low = series[0];
  series.forEach((item) => {
    if (Number(item.value || 0) > Number(high.value || 0)) high = item;
    if (Number(item.value || 0) < Number(low.value || 0)) low = item;
  });
  return { high, low };
}

function truncateText(value, max = 80) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function monthlyTypeTrend(monthlySummary = [], type = "income", fallbackKind = "up") {
  const toBucketDate = (raw, index) => {
    const text = String(raw ?? "").trim();
    const monthMatch = text.match(/^(\d{4})-(\d{1,2})/);
    if (monthMatch) {
      const year = Number(monthMatch[1]);
      const month = Number(monthMatch[2]) - 1;
      if (!Number.isNaN(year) && !Number.isNaN(month)) return new Date(year, month, 1);
    }
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(2000 + index, 0, 1);
  };

  const grouped = new Map();
  (monthlySummary || []).forEach((entry, index) => {
    if (String(entry.type || "").toLowerCase() !== String(type).toLowerCase()) return;
    const key = entry.bucketStartKey ?? entry.bucket ?? entry.label ?? `${entry.year ?? "y"}-${entry.month ?? index}`;
    const current = grouped.get(key) ?? 0;
    grouped.set(key, current + Math.abs(Number(entry.total ?? 0) || 0));
  });

  const series = [...grouped.entries()]
    .map(([key, value], index) => ({ value, date: toBucketDate(key, index) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((entry) => entry.value);

  if (series.length < 2) return { label: "Live", kind: fallbackKind };
  return trendFromCurrentPrevious(series[series.length - 1], series[series.length - 2], fallbackKind);
}

function logLevelCount(stats = {}, level) {
  if (Array.isArray(stats.by_level)) {
    const match = stats.by_level.find((item) => String(item._id ?? "").toLowerCase() === String(level).toLowerCase());
    return Number(match?.count ?? 0);
  }
  return Number(stats.by_level?.[level] ?? stats.by_level?.[String(level).toUpperCase()] ?? 0);
}

function formatINRExport(value) {
  const amount = Number(value) || 0;
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function buildAdminReportCsvRows(analytics = {}) {
  const categories = adminCategorySeries(analytics);
  const trend = adminTrendSeries(analytics);
  const latest = trend[trend.length - 1]?.value ?? 0;
  const previous = trend[trend.length - 2]?.value ?? null;
  const delta = previous == null ? null : Number(latest) - Number(previous);
  return [
    ["Section", "Overview"],
    ["Balance", formatINRExport(analytics.balance ?? 0)],
    ["Income", formatINRExport(analytics.total_income ?? 0)],
    ["Expense", formatINRExport(analytics.total_expense ?? 0)],
    ["Latest movement", formatINRExport(latest)],
    ["Movement change", delta == null ? "—" : formatINRExport(delta)],
    ["Monthly entries", String((analytics.monthly_summary ?? []).length)],
    ["Category entries", String(categories.length)],
    ["", ""],
    ["Section", "Category breakdown"],
    ...categories.map((item) => [item.label, formatINRExport(item.value)]),
  ];
}

function buildAdminReportPdfPayload(analytics = {}) {
  const categories = adminCategorySeries(analytics);
  const trend = adminTrendSeries(analytics);
  const latest = trend[trend.length - 1]?.value ?? 0;
  const previous = trend[trend.length - 2]?.value ?? null;
  const delta = previous == null ? null : Number(latest) - Number(previous);
  const topCategory = categories[0] ?? null;
  const totalExpense = Number(analytics.total_expense ?? 0);
  const totalIncome = Number(analytics.total_income ?? 0);
  const spendShare = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
  const monthly = (analytics.monthly_summary ?? []).map((entry, index) => {
    const month = Number(entry.month ?? 1);
    const year = Number(entry.year ?? new Date().getFullYear());
    const label = entry.label ?? new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(new Date(year, Math.max(0, month - 1), 1));
    const income = Number(entry.type === "income" ? entry.total : entry.total_income ?? 0);
    const expense = Math.abs(Number(entry.type === "expense" ? entry.total : entry.total_expense ?? 0));
    const net = Number(entry.balance ?? income - expense);
    return {
      index,
      label,
      income,
      expense,
      net,
      incomeRaw: income,
      expenseRaw: expense,
      netRaw: net,
    };
  });

  const grouped = new Map();
  monthly.forEach((entry) => {
    const key = entry.label;
    const current = grouped.get(key) ?? { label: entry.label, income: 0, expense: 0, net: 0, incomeRaw: 0, expenseRaw: 0, netRaw: 0 };
    current.income += entry.income;
    current.expense += entry.expense;
    current.net += entry.net;
    current.incomeRaw += entry.incomeRaw;
    current.expenseRaw += entry.expenseRaw;
    current.netRaw += entry.netRaw;
    grouped.set(key, current);
  });

  const monthlyRows = [...grouped.values()].slice(-8).map((row) => ({
    label: row.label,
    income: formatINRExport(row.income),
    expense: formatINRExport(row.expense),
    net: formatINRExport(row.net),
    incomeRaw: row.incomeRaw,
    expenseRaw: row.expenseRaw,
    netRaw: row.netRaw,
  }));

  return {
    title: "Finly Report",
    subtitle: "Admin Finance Report",
    rangeLabel: "All time",
    generatedLabel: new Date().toLocaleString("en-IN"),
    metrics: [
      { label: "Net position", value: formatINRExport(analytics.balance ?? 0) },
      { label: "Avg. inflow", value: formatINRExport(monthlyRows.length ? totalIncome / monthlyRows.length : 0) },
      { label: "Avg. outflow", value: formatINRExport(monthlyRows.length ? totalExpense / monthlyRows.length : 0) },
      { label: "Spend ratio", value: `${spendShare}%` },
    ],
    executiveSummary: `System inflow is ${formatINRExport(totalIncome)} and outflow is ${formatINRExport(totalExpense)} in this window. Movement is ${delta >= 0 ? "improving" : "declining"}.`,
    takeaways: [
      topCategory ? `${topCategory.label} is the biggest category at ${formatINRExport(topCategory.value)}.` : "No category totals are available.",
      `Latest movement is ${formatINRExport(latest)} with a change of ${delta == null ? "—" : formatINRExport(delta)}.`,
      `Spending currently represents about ${spendShare}% of inflow.`,
      `Category coverage: ${categories.length} tracked segment(s).`,
    ],
    insights: [
      { label: "Top category", value: topCategory ? `${topCategory.label} (${formatINRExport(topCategory.value)})` : "—" },
      { label: "Latest movement", value: formatINRExport(latest) },
      { label: "Movement delta", value: delta == null ? "—" : formatINRExport(delta) },
      { label: "Total categories", value: String(categories.length) },
      { label: "Spend ratio", value: `${spendShare}%` },
    ],
    topCategories: categories.slice(0, 8).map((item) => ({
      label: item.label,
      value: formatINRExport(item.value),
      share: totalExpense > 0 ? Math.max(0, Math.round((Number(item.value || 0) / totalExpense) * 100)) : 0,
      rawValue: Number(item.value || 0),
    })),
    monthlyRows,
  };
}

function buildAdminTransactionCsvRows(transactions = []) {
  return transactions.map((txn) => {
    const amount = Number(txn.amount) || 0;
    return [
      String(txn.id ?? ""),
      txn.user_name ?? txn.user_email ?? "—",
      txn.description ?? "Transaction",
      txn.category_name ?? "Uncategorized",
      txn.type ?? (amount >= 0 ? "income" : "expense"),
      txn.is_deleted ? "archived" : "active",
      amount,
      formatDateTime(txn.date),
    ];
  });
}

function filterAdminFallbackTransactions(transactions = [], filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  const type = String(filters.type || "").toLowerCase();
  const archiveFilter = String(filters.archive_filter || "all").toLowerCase();
  const categoryId = String(filters.category_id || "");
  const minAmount = filters.min_amount === "" ? null : Number(filters.min_amount);
  const maxAmount = filters.max_amount === "" ? null : Number(filters.max_amount);
  const startDate = filters.start_date ? new Date(`${filters.start_date}T00:00:00`) : null;
  const endDate = filters.end_date ? new Date(`${filters.end_date}T23:59:59`) : null;

  const filtered = transactions.filter((txn) => {
    const amount = Number(txn.amount) || 0;
    const derivedType = String(txn.type ?? (amount >= 0 ? "income" : "expense")).toLowerCase();
    const isArchived = Boolean(txn.is_deleted);
    const createdAt = txn.date ? new Date(txn.date) : null;
    const searchable = `${txn.description || ""} ${txn.category_name || ""} ${txn.user_name || ""} ${txn.user_email || ""}`.toLowerCase();

    if (search && !searchable.includes(search)) return false;
    if (type && derivedType !== type) return false;
    if (archiveFilter === "active" && isArchived) return false;
    if (archiveFilter === "archived" && !isArchived) return false;
    if (categoryId && String(txn.category_id ?? "") !== categoryId) return false;
    if (minAmount != null && !Number.isNaN(minAmount) && Math.abs(amount) < minAmount) return false;
    if (maxAmount != null && !Number.isNaN(maxAmount) && Math.abs(amount) > maxAmount) return false;
    if (startDate && createdAt && createdAt < startDate) return false;
    if (endDate && createdAt && createdAt > endDate) return false;
    return true;
  });

  const sortBy = String(filters.sort_by || "date");
  const sortOrder = String(filters.sort_order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  filtered.sort((a, b) => {
    const aAmount = Math.abs(Number(a.amount) || 0);
    const bAmount = Math.abs(Number(b.amount) || 0);
    const aDate = new Date(a.date || 0).getTime();
    const bDate = new Date(b.date || 0).getTime();
    const aDescription = String(a.description || "").toLowerCase();
    const bDescription = String(b.description || "").toLowerCase();
    const aCreated = new Date(a.created_at || a.date || 0).getTime();
    const bCreated = new Date(b.created_at || b.date || 0).getTime();

    let delta = 0;
    if (sortBy === "amount") delta = aAmount - bAmount;
    else if (sortBy === "description") delta = aDescription.localeCompare(bDescription);
    else if (sortBy === "created_at") delta = aCreated - bCreated;
    else delta = aDate - bDate;

    return sortOrder === "asc" ? delta : -delta;
  });

  return filtered;
}

function adminTransactionFilterChips(filters = {}, categories = []) {
  const categoryMap = new Map(categories.map((category) => [String(category.id), category.name]));
  const chips = [];
  if (filters.search) chips.push(`Search: ${filters.search}`);
  if (filters.type) chips.push(`Type: ${filters.type}`);
  if (filters.category_id) chips.push(`Category: ${categoryMap.get(String(filters.category_id)) || "Selected"}`);
  if (filters.archive_filter && filters.archive_filter !== "all") chips.push(`Archive: ${filters.archive_filter}`);
  if (filters.start_date || filters.end_date) chips.push(`Date: ${filters.start_date || "..."} to ${filters.end_date || "..."}`);
  if (filters.min_amount || filters.max_amount) chips.push(`Amount: ${filters.min_amount || "0"} to ${filters.max_amount || "∞"}`);
  if (filters.sort_by !== "date" || filters.sort_order !== "desc") {
    chips.push(`Sort: ${filters.sort_by} (${filters.sort_order})`);
  }
  return chips;
}

function adminTransactionPresetButtons(filters = {}) {
  const presets = [
    {
      key: "all",
      label: "All",
      active: !filters.search && !filters.type && (filters.archive_filter || "all") === "all" && !filters.category_id,
    },
    {
      key: "income",
      label: "Income",
      active: filters.type === "income",
    },
    {
      key: "expense",
      label: "Expense",
      active: filters.type === "expense",
    },
    {
      key: "archived",
      label: "Archived",
      active: (filters.archive_filter || "all") === "archived",
    },
  ];

  return `
    <div class="filter-presets">
      ${presets
        .map((preset) =>
          button(preset.label, {
            variant: preset.active ? "primary" : "secondary",
            attrs: `data-action="apply-admin-transaction-preset" data-preset="${preset.key}"`,
          }),
        )
        .join("")}
    </div>
  `;
}

function adminLogFilterChips(filters = {}) {
  const chips = [];
  if (filters.action) chips.push(`Action: ${filters.action}`);
  if (filters.level) chips.push(`Level: ${filters.level}`);
  if (filters.request_id) chips.push(`Request: ${filters.request_id}`);
  if (filters.start_date || filters.end_date) chips.push(`Date: ${filters.start_date || "..."} to ${filters.end_date || "..."}`);
  return chips;
}

function filterAdminFallbackLogs(logs = [], filters = {}) {
  const action = String(filters.action || "").toUpperCase();
  const level = String(filters.level || "").toLowerCase();
  const requestId = String(filters.request_id || "").toLowerCase();
  const startDate = filters.start_date ? new Date(`${filters.start_date}T00:00:00`) : null;
  const endDate = filters.end_date ? new Date(`${filters.end_date}T23:59:59`) : null;

  return logs.filter((log) => {
    const rowAction = String(log.action ?? "").toUpperCase();
    const rowLevel = String(log.level ?? log.severity ?? "").toLowerCase();
    const rowRequest = String(log.request_id ?? "").toLowerCase();
    const rowDate = log.created_at || log.time ? new Date(log.created_at || log.time) : null;

    if (action && rowAction !== action) return false;
    if (level && rowLevel !== level) return false;
    if (requestId && !rowRequest.includes(requestId)) return false;
    if (startDate && rowDate && rowDate < startDate) return false;
    if (endDate && rowDate && rowDate > endDate) return false;
    return true;
  });
}

function renderUserRows(users = []) {
  return users.map((user) => `
    <tr data-searchable="${escapeHtml(`${user.name} ${user.email} ${user.role} ${user.status}`.toLowerCase())}">
      <td>
        <strong>${escapeHtml(user.name)}</strong>
        <div class="muted mono">${escapeHtml(user.email)}</div>
      </td>
      <td>${statusBadge(user.role ?? "user")}</td>
      <td>${statusBadge(user.status ?? "active")}</td>
      <td>
        <div class="table-actions">
          ${rowAction("View", `data-action="view-user" data-id="${user.id}"`)}
          ${rowAction(user.status === "blocked" ? "Unblock" : "Block", `data-action="${user.status === "blocked" ? "unblock-user" : "block-user"}" data-id="${user.id}"`)}
        </div>
      </td>
    </tr>
  `);
}

function renderTransactionRows(transactions = [], options = {}) {
  const selectable = Boolean(options.selectable);
  const includeHardDelete = Boolean(options.includeHardDelete);
  return transactions.map((txn) => {
    const amount = Number(txn.amount) || 0;
    const type = String(txn.type ?? (amount >= 0 ? "income" : "expense")).toLowerCase();
    const category = String(txn.category_name ?? "Uncategorized");
    const status = txn.is_deleted ? "archived" : "active";
    const userLabel = String(txn.user_name ?? txn.user_email ?? (txn.user_id ? `user-${txn.user_id}` : "unknown"));
    return `
    <tr data-transaction-row data-id="${txn.id}" data-type="${escapeHtml(type)}" data-category="${escapeHtml(category.toLowerCase())}" data-status="${escapeHtml(status)}" data-user="${escapeHtml(userLabel.toLowerCase())}" data-searchable="${escapeHtml(`${txn.description} ${category} ${type} ${status} ${userLabel}`.toLowerCase())}">
      ${
        selectable
          ? `<td><input class="table-check" type="checkbox" data-admin-transaction-check data-id="${txn.id}" aria-label="Select transaction ${txn.id}" /></td>`
          : ""
      }
      <td>
        <strong>${escapeHtml(txn.description ?? "Transaction")}</strong>
      </td>
      <td>${escapeHtml(userLabel)}</td>
      <td>${escapeHtml(txn.category_name ?? "Uncategorized")}</td>
      <td>${txn.is_deleted ? badge("Archived", "red") : statusBadge(type)}</td>
      <td>${formatTableAmount(amount)}</td>
      <td>${formatTableDate(txn.date)}</td>
      <td>
        <div class="table-actions">
          ${rowAction("View", `data-action="view-transaction" data-id="${txn.id}"`)}
          ${txn.is_deleted
            ? `${rowAction("Restore", `data-action="restore-transaction" data-id="${txn.id}"`)}${includeHardDelete ? rowAction("Delete forever", `data-action="hard-delete-transaction" data-id="${txn.id}"`) : ""}`
            : rowAction("Archive", `data-action="archive-transaction" data-id="${txn.id}"`)}
        </div>
      </td>
    </tr>
  `;
  });
}

function renderCategoryRows(categories = []) {
  return categories.map((category) => `
    <tr data-category-row data-type="${escapeHtml(String(category.type ?? "expense").toLowerCase())}" data-searchable="${escapeHtml(`${category.name} ${category.type}`.toLowerCase())}">
      <td><strong>${escapeHtml(category.name)}</strong></td>
      <td>${statusBadge(category.type ?? "expense")}</td>
      <td>${badge(`${category.usage_count ?? category.usage ?? 0} uses`, "accent")}</td>
      <td>
        <div class="table-actions">
          ${rowAction("Delete", `data-action="delete-category" data-id="${category.id}"`)}
        </div>
      </td>
    </tr>
  `);
}

function renderLogRows(logs = []) {
  return logs.map((log, index) => {
    const level = String(log.level ?? log.severity ?? "info").toLowerCase();
    const action = String(log.action ?? "").toUpperCase();
    const actionLabel = log.action_label ?? log.action ?? "Event";
    const description = log.action_description ?? log.message ?? "";
    const requestId = log.request_id ?? "—";
    const rowKey = log.id != null ? `id-${log.id}` : `idx-${index}`;
    return `
    <tr data-log-row data-level="${escapeHtml(level)}" data-action-name="${escapeHtml(action)}" data-request-id="${escapeHtml(String(requestId).toLowerCase())}" data-searchable="${escapeHtml(`${actionLabel} ${description} ${action} ${level} ${requestId}`.toLowerCase())}" data-log-key="${escapeHtml(rowKey)}">
      <td>
        ${statusBadge(level)}
      </td>
      <td>
        <strong>${escapeHtml(actionLabel)}</strong>
        <div class="muted">${escapeHtml(description)}</div>
      </td>
      <td class="mono">${escapeHtml(String(requestId))}</td>
      <td class="mono">${escapeHtml(formatDateTime(log.created_at ?? log.time ?? log.timestamp ?? new Date(), { withSeconds: true, compact: true }))}</td>
      <td>
        <div class="table-actions">
          ${rowAction("Details", `data-action="view-log" data-log-key="${escapeHtml(rowKey)}"`)}
        </div>
      </td>
    </tr>
  `;
  });
}

function renderFilterChips(chips = []) {
  if (!chips.length) return `<ul class="filter-chips"><li class="chip"><strong>Default view</strong></li></ul>`;
  return `<ul class="filter-chips">${chips.map((item) => `<li class="chip"><strong>${escapeHtml(item)}</strong></li>`).join("")}</ul>`;
}

function categoryForm(defaults = {}) {
  return `
    <form class="form-card" data-form="category">
      <div class="form-grid">
        ${inputField({ label: "Name", name: "name", value: defaults.name ?? "", required: true })}
        ${selectField({
          label: "Type",
          name: "type",
          value: defaults.type ?? "expense",
          options: [
            { value: "income", label: "Income" },
            { value: "expense", label: "Expense" },
          ],
          required: true,
        })}
      </div>
      <div class="toolbar">
        <button class="button button-primary" type="submit">${escapeHtml(defaults.id ? "Update category" : "Create category")}</button>
      </div>
    </form>
  `;
}

function validateCategoryPayload(name) {
  const trimmed = String(name || "").trim();
  if (trimmed.length < 2) {
    return { ok: false, message: "Category name must be at least 2 characters." };
  }
  return { ok: true, value: trimmed };
}

function profileForm(profile) {
  return `
    <div class="two-up">
      <form class="form-card panel" data-form="profile">
        <div class="panel-header">
          <div>
            <span class="panel-title">Admin account</span>
            <h3>Profile details</h3>
          </div>
        </div>
        <div class="form-grid">
          ${inputField({ label: "Name", name: "name", value: profile.name ?? "" })}
          ${inputField({ label: "Email", name: "email", type: "email", value: profile.email ?? "" })}
        </div>
        <div class="toolbar">
          <button class="button button-primary" type="submit">Update profile</button>
        </div>
      </form>

      <form class="form-card panel" data-form="password">
        <div class="panel-header">
          <div>
            <span class="panel-title">Security</span>
            <h3>Rotate credentials</h3>
          </div>
        </div>
        <div class="form-grid">
          ${inputField({ label: "Current password", name: "old_password", type: "password" })}
          ${inputField({ label: "New password", name: "new_password", type: "password" })}
        </div>
        <div class="toolbar">
          <button class="button button-secondary" type="submit">Update password</button>
          <button class="button button-danger" type="button" data-action="admin-delete-account">Delete account</button>
        </div>
      </form>
    </div>
  `;
}

function ensureFieldHintNode(input) {
  const field = input?.closest?.(".field");
  if (!field) return null;
  let hint = field.querySelector("[data-field-hint]");
  if (!hint) {
    hint = document.createElement("p");
    hint.className = "field-hint";
    hint.setAttribute("data-field-hint", "");
    field.appendChild(hint);
  }
  return hint;
}

function setFieldValidation(input, result) {
  if (!input) return;
  const hint = ensureFieldHintNode(input);
  const state = String(result?.state || "").toLowerCase();
  const message = String(result?.message || "");

  input.classList.remove("input-invalid", "input-valid");

  if (!hint || !message) {
    if (hint) {
      hint.textContent = "";
      hint.className = "field-hint";
    }
    return;
  }

  hint.textContent = message;
  hint.className = `field-hint field-hint-${state || "neutral"}`;

  if (state === "error") input.classList.add("input-invalid");
  if (state === "ok") input.classList.add("input-valid");
}

function emailLooksValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function passwordLooksStrong(value) {
  const text = String(value || "");
  return text.length >= 8 && /[A-Za-z]/.test(text) && /\d/.test(text);
}

function bindLiveValidation(form, rules = {}) {
  if (!form) return () => "";
  const fieldState = new Map();

  const runRule = (name, force = false) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return "";
    const started = fieldState.get(name) === true || input.dataset.validationStarted === "1";

    if (!started && !force) {
      setFieldValidation(input, { state: "", message: "" });
      return "";
    }

    input.dataset.validationStarted = "1";
    fieldState.set(name, true);

    const validator = rules[name];
    if (typeof validator !== "function") {
      setFieldValidation(input, { state: "", message: "" });
      return "";
    }

    const result = validator(String(input.value || ""), form) || { state: "", message: "" };
    setFieldValidation(input, result);
    return String(result.state || "").toLowerCase() === "error" ? String(result.message || "Invalid input") : "";
  };

  Object.keys(rules).forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;

    const handleTyping = () => {
      if (String(input.value || "").length > 0) {
        input.dataset.validationStarted = "1";
        fieldState.set(name, true);
      }
      runRule(name, false);
    };

    input.addEventListener("input", handleTyping);
    input.addEventListener("change", handleTyping);
    input.addEventListener("blur", () => runRule(name, true));
  });

  return () => {
    let firstError = "";
    Object.keys(rules).forEach((name) => {
      const error = runRule(name, true);
      if (!firstError && error) firstError = error;
    });
    return firstError;
  };
}

function attachCategoryFormValidation(form) {
  return bindLiveValidation(form, {
    name: (value) => {
      const text = String(value || "").trim();
      if (!text) return { state: "error", message: "Category name is required." };
      if (text.length < 2) return { state: "error", message: "Use at least 2 characters." };
      return { state: "ok", message: "Category name looks good." };
    },
  });
}

function attachProfileFormValidation(form) {
  return bindLiveValidation(form, {
    name: (value) => {
      const text = String(value || "").trim();
      if (!text) return { state: "error", message: "Name is required." };
      if (text.length < 2) return { state: "error", message: "Name must be at least 2 characters." };
      return { state: "ok", message: "Name looks good." };
    },
    email: (value) => {
      const text = String(value || "").trim();
      if (!text) return { state: "error", message: "Email is required." };
      if (!emailLooksValid(text)) return { state: "error", message: "Enter a valid email address." };
      return { state: "ok", message: "Email looks valid." };
    },
  });
}

function attachPasswordFormValidation(form) {
  return bindLiveValidation(form, {
    old_password: (value) => {
      if (!String(value || "").trim()) return { state: "error", message: "Current password is required." };
      return { state: "ok", message: "Current password entered." };
    },
    new_password: (value) => {
      const text = String(value || "");
      if (!text) return { state: "error", message: "New password is required." };
      if (!passwordLooksStrong(text)) return { state: "error", message: "Use 8+ chars with at least one letter and one number." };
      return { state: "ok", message: "Strong password format." };
    },
  });
}

export const adminWorkspace = {
  brand: "Finly Admin",
  contextLabel: "System Admin",
  nav: [
    { id: "dashboard", label: "Dashboard" },
    { id: "users", label: "Users" },
    { id: "transactions", label: "Transactions" },
    { id: "categories", label: "Categories" },
    { id: "reports", label: "Reports" },
    { id: "logs", label: "Logs" },
    { id: "profile", label: "Profile" },
  ],
  pages: {
    dashboard: {
      title: "Command Center",
      subtitle: "Users, activity, and core platform metrics.",
      actions: () => "",
      load: async (ctx) => {
        const [dashboard, analytics, users, transactions, logs] = await Promise.all([
          fetchOrFallback(ctx, "/admin/dashboard", buildFallbackAdminDashboard()),
          fetchOrFallback(ctx, "/admin/analytics", buildFallbackAdminAnalytics()),
          fetchOrFallback(ctx, "/admin/users", mockUsers),
          fetchOrFallback(ctx, "/transactions", mockTransactions),
          fetchOrFallback(ctx, "/logs/recent", mockLogs),
        ]);
        return {
          dashboard: normalizeDetail(dashboard?.data ?? dashboard ?? {}),
          analytics: normalizeDetail(analytics?.data ?? analytics ?? {}),
          users: normalizeList(users?.data ?? users ?? []),
          transactions: normalizeList(transactions?.data ?? transactions ?? []),
          logs: normalizeList(logs?.data ?? logs ?? []),
        };
      },
      render: (data) => {
        const stats = data.dashboard ?? {};
        const analytics = data.analytics ?? {};
        const users = Array.isArray(data.users) ? data.users : [];
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const logs = Array.isArray(data.logs) ? data.logs : [];
        const activity = adminTrendSeries(analytics);
        const categories = adminCategorySeries(analytics);
        const categoryTotal = categories.reduce((sum, item) => sum + Number(item.value || 0), 0);
        const activityExtrema = seriesExtrema(activity);
        const totalUsers = Number(stats.total_users ?? 0) || Number(users.length || 0);
        const activeUsers = Number(stats.active_users ?? 0);
        const blockedUsers = Number(stats.blocked_users ?? 0);
        const activeShare = totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0;
        const coverage = topCategoryCoverage(categories);
        const activityTrend = recentSeriesTrend(activity, "up");
        const composition = [
          { label: "Active", value: Number(stats.active_users ?? 0), color: "#34d399" },
          { label: "Blocked", value: Number(stats.blocked_users ?? 0), color: "#f87171" },
          { label: "Admins", value: Number(stats.admin_users ?? 0), color: "#7dd3fc" },
        ].filter((item) => item.value > 0);
        return `
          ${hero(
            "Command center",
            "A high-level view of the platform.",
            `
              <div class="hero-action-group">
                ${button("Refresh", { variant: "secondary", attrs: 'data-action="refresh"' })}
                ${button("Users", { variant: "secondary", attrs: 'data-go="users"' })}
                ${button("Reports", { variant: "secondary", attrs: 'data-go="reports"' })}
              </div>
            `,
          )}
          <section class="cards-grid">
            ${metricCard({ label: "Total users", value: String(stats.total_users ?? users.length), trend: { label: `${activeUsers} active`, kind: "up" }, hint: "Registered accounts", icon: "U" })}
            ${metricCard({ label: "Active users", value: String(stats.active_users ?? users.filter((user) => user.status === "active").length), trend: { label: `${activeShare}% share`, kind: "up" }, hint: "Currently active", icon: "A" })}
            ${metricCard({ label: "Blocked users", value: String(stats.blocked_users ?? users.filter((user) => user.status === "blocked").length), trend: { label: `${blockedUsers} blocked`, kind: blockedUsers > 0 ? "down" : "up" }, hint: "Needs review", icon: "!" })}
            ${metricCard({ label: "System txns", value: String(stats.total_transactions ?? transactions.length), trend: activityTrend, hint: "Recorded transactions", icon: "Σ" })}
          </section>
          <section class="analysis-grid">
            ${panel(
              "Platform activity",
              "Recent movement",
              activity.length
                ? `<div class="chart-shell"><div class="chart-canvas">${lineChartSVG(activity, { stroke: "#a78bfa" })}</div><div class="chart-legend"><span class="pill">Net movement</span>${activityExtrema.high ? `<span class="pill">Peak ${escapeHtml(activityExtrema.high.label)} ${escapeHtml(formatINR(activityExtrema.high.value))}</span>` : ""}${activityExtrema.low ? `<span class="pill">Low ${escapeHtml(activityExtrema.low.label)} ${escapeHtml(formatINR(activityExtrema.low.value))}</span>` : ""}</div></div>`
                : dashboardEmptyState(
                    "No activity yet",
                    "Platform movement will appear here after users start creating transactions and budgets.",
                    "View Users",
                    "users",
                    "↗",
                  ),
            )}
            ${panel(
              "Category mix",
              "Expense distribution",
              categories.length
                ? `<div class="chart-shell"><div class="chart-canvas">${donutChartSVG(categories, {
                    centerLabel: "",
                    centerValue: "",
                    valueFormatter: (value) => formatINR(value),
                  })}</div><div class="chart-legend"><span class="pill">Top 3 cover ${coverage}%</span></div></div>`
                : dashboardEmptyState(
                    "No category mix available",
                    "Expense categories will populate here when the platform starts capturing categorized transactions.",
                    "Open Reports",
                    "reports",
                    "◔",
                  ),
            )}
          </section>
          <section class="three-up">
            ${panel(
              "User composition",
              "Active, blocked, and admin split",
              composition.length
                ? `<div class="chart-canvas">${donutChartSVG(composition, {
                    centerLabel: "",
                    centerValue: "",
                    valueFormatter: (value) => String(value),
                  })}</div>`
                : dashboardEmptyState(
                    "No user data yet",
                    "Once accounts start using the system, this module will show how your user base is split.",
                    "Go to Users",
                    "users",
                    "◌",
                  ),
            )}
            ${panel(
              "User directory",
              "Recent accounts",
              `
                <div class="section-stack">
                  ${cardList(
                    users.slice(0, 4).map((user) => `
                      <article class="list-item">
                        <div>
                          ${statusBadge(user.role ?? "user")}
                          <strong>${escapeHtml(user.name)}</strong>
                          <p>${escapeHtml(user.email)}</p>
                        </div>
                        <div class="metric-meta">
                          ${statusBadge(user.status ?? "active")}
                          <span class="trend up">${escapeHtml(user.role ?? "user")}</span>
                        </div>
                      </article>
                    `),
                    "Newly created accounts will show up here as soon as users start signing in.",
                    button("View Users", { variant: "primary", attrs: 'data-go="users"' }),
                    "◌",
                  )}
                </div>
              `,
            )}
            ${panel(
              "System activity",
              "Recent signals",
              `
                <div class="section-stack">
                  <div class="toolbar">
                    ${badge(`Top 3 categories: ${coverage}%`, "accent")}
                  </div>
                  ${cardList(
                    logs.slice(0, 5).map((item) =>
                      timelineItem({
                        title: item.action_label ?? item.action ?? "Event",
                        note: truncateText(item.action_description ?? item.message ?? "", 84),
                        time: formatDateTime(item.created_at ?? item.time ?? item.timestamp ?? new Date(), { withSeconds: true, compact: true }),
                        tone: item.level ?? item.severity ?? "neutral",
                      }),
                    ),
                    "Audit and product events will appear here after the platform starts generating activity.",
                    button("Open Logs", { variant: "primary", attrs: 'data-go="logs"' }),
                    "!",
                  )}
                </div>
              `,
            )}
          </section>
        `;
      },
    },
    users: {
      title: "User Management",
      subtitle: "Search users, inspect details, and manage account status.",
      help: "Filter by status or search by identity, then open details or change access status.",
      actions: () => "",
      load: async (ctx) => {
        const filters = readAdminUsersFilters();
        const offset = (filters.page - 1) * filters.limit;
        let payload;
        try {
          payload = await ctx.api("/admin/users", {
            query: {
              search: filters.search,
              status: filters.status,
              limit: filters.limit,
              offset,
              sort_by: filters.sort_by,
              sort_order: filters.sort_order,
            },
          });
        } catch (error) {
          if (!isDemoMode()) throw error;
          const fallback = mockUsers;
          payload = {
            data: fallback.slice(offset, offset + filters.limit),
            meta: {
              total: fallback.length,
              limit: filters.limit,
              offset,
              page: filters.page,
              total_pages: Math.max(1, Math.ceil(fallback.length / filters.limit)),
              has_next: offset + filters.limit < fallback.length,
              has_prev: filters.page > 1,
            },
          };
        }
        return {
          users: normalizeList(payload?.data ?? payload ?? []),
          meta: normalizeDetail(payload?.meta ?? {}),
          filters,
        };
      },
      render: (data) => {
        const users = Array.isArray(data.users) ? data.users : [];
        const meta = data.meta ?? {};
        const filters = data.filters ?? defaultAdminUsersFilters();
        const chips = [];
        if (filters.search) chips.push(`Search: ${filters.search}`);
        if (filters.status) chips.push(`Status: ${filters.status}`);
        if (filters.sort_by !== "created_at" || filters.sort_order !== "desc") {
          chips.push(`Sort: ${filters.sort_by} (${filters.sort_order})`);
        }
        return `
          ${hero(
            "User management",
            "Block or unblock users and review key account details.",
            ``,
          )}
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Users</span>
                <h3>Directory</h3>
              </div>
              ${badge(`${meta.total ?? users.length} accounts`, "accent")}
            </div>
            <div class="panel-body">
              <div class="filter-shell">
                <div class="filter-row">
                  <label class="field">
                    <span>Search</span>
                    <input class="input" data-user-search type="search" placeholder="Name, email, role, or status" value="${escapeHtml(filters.search || "")}" />
                  </label>
                  ${selectField({
                    label: "Status",
                    name: "admin_users_status",
                    value: filters.status || "",
                    options: [
                      { value: "", label: "All statuses" },
                      { value: "active", label: "Active" },
                      { value: "blocked", label: "Blocked" },
                    ],
                  })}
                  ${selectField({
                    label: "Sort by",
                    name: "admin_users_sort_by",
                    value: String(filters.sort_by || "created_at"),
                    options: [
                      { value: "created_at", label: "Created at" },
                      { value: "name", label: "Name" },
                      { value: "email", label: "Email" },
                    ],
                  })}
                  ${button("Apply", { variant: "primary", attrs: 'data-action="apply-user-filters"' })}
                </div>
                <div class="filter-row">
                  ${selectField({
                    label: "Sort order",
                    name: "admin_users_sort_order",
                    value: String(filters.sort_order || "desc"),
                    options: [
                      { value: "desc", label: "Newest first" },
                      { value: "asc", label: "Oldest first" },
                    ],
                  })}
                  ${selectField({
                    label: "Rows per page",
                    name: "admin_users_limit",
                    value: String(filters.limit || 12),
                    options: [
                      { value: "10", label: "10" },
                      { value: "12", label: "12" },
                      { value: "20", label: "20" },
                      { value: "30", label: "30" },
                    ],
                  })}
                  <div class="filter-actions">
                    <div class="toolbar">
                      ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-user-filters"' })}
                    </div>
                  </div>
                </div>
                <div class="filter-summary">
                  ${renderFilterChips(chips)}
                </div>
              </div>
            </div>
            ${table({
              columns: ["User", "Role", "Status", "Actions"],
              rows: renderUserRows(users),
              emptyLabel: "No users match the current filters.",
            })}
            <div class="panel-body">
              ${renderPagination(meta, "admin-user-page")}
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const filters = data.filters ?? defaultAdminUsersFilters();
        const meta = data.meta ?? {};
        const search = root.querySelector("[data-user-search]");
        const status = root.querySelector('select[name="admin_users_status"]');
        const sortBy = root.querySelector('select[name="admin_users_sort_by"]');
        const sortOrder = root.querySelector('select[name="admin_users_sort_order"]');
        const limit = root.querySelector('select[name="admin_users_limit"]');

        status?.querySelector('option[value="inactive"]')?.remove();

        const applyUsersFilters = (nextPage = 1) => {
          writeAdminUsersFilters({
            ...filters,
            page: nextPage,
            search: (search?.value || "").trim(),
            status: status?.value || "",
            sort_by: sortBy?.value || "created_at",
            sort_order: sortOrder?.value || "desc",
            limit: Number(limit?.value || 12) || 12,
          });
          ctx.reload();
        };

        root.querySelector('[data-action="apply-user-filters"]')?.addEventListener("click", () => applyUsersFilters(1));
        root.querySelector('[data-action="reset-user-filters"]')?.addEventListener("click", () => {
          writeAdminUsersFilters(defaultAdminUsersFilters());
          ctx.reload();
        });
        search?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyUsersFilters(1);
          }
        });
        root.querySelector('[data-action="admin-user-page-prev"]')?.addEventListener("click", () => {
          applyUsersFilters(Math.max(1, Number(filters.page || 1) - 1));
        });
        root.querySelector('[data-action="admin-user-page-next"]')?.addEventListener("click", () => {
          applyUsersFilters(Math.min(Number(meta.total_pages || 1) || 1, Number(filters.page || 1) + 1));
        });

        root.querySelectorAll("[data-action='block-user'], [data-action='unblock-user']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const action = btn.getAttribute("data-action");
            const endpoint = action === "block-user" ? `/admin/users/${id}/block` : `/admin/users/${id}/unblock`;
            try {
              await ctx.api(endpoint, { method: "PUT" });
              ctx.toast("User updated", "The user status changed successfully.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Action failed", error.message, "danger");
            }
          });
        });

        root.querySelectorAll("[data-action='view-user']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const selectedUser = (data.users || []).find((item) => String(item.id) === String(id)) || null;
            try {
              const [detailResult, summaryResult, transactionsResult] = await Promise.allSettled([
                fetchOrFallback(ctx, `/admin/users/${id}`, selectedUser ?? {}),
                fetchOrFallback(ctx, `/admin/users/${id}/summary`, {}),
                fetchOrFallback(ctx, `/admin/users/${id}/transactions`, []),
              ]);

              const detailPayload = detailResult.status === "fulfilled" ? detailResult.value : selectedUser ?? {};
              const detail = normalizeDetail(detailPayload ?? selectedUser ?? {});
              const summaryPayload = summaryResult.status === "fulfilled" ? summaryResult.value : {};
              const summary = normalizeDetail(summaryPayload ?? {});
              const transactionsPayload = transactionsResult.status === "fulfilled" ? transactionsResult.value : [];
              const transactions = normalizeList(transactionsPayload ?? []);

              ctx.openModal({
                title: "User Details",
                note: `User #${detail?.id ?? id ?? "—"}`,
                content: `
                  <div class="section-stack">
                    ${infoRow("Name", detail?.name ?? "User")}
                    ${infoRow("Email", detail?.email ?? "—")}
                    ${infoRow("Role", detail?.role ?? "user")}
                    ${infoRow("Status", detail?.status ?? "active")}
                    ${infoRow("Net balance", formatINR(summary?.balance ?? detail?.balance ?? 0))}
                    ${panel("Recent Transactions", "Latest account activity", table({
                      columns: ["Transaction", "Category", "Amount", "Date"],
                      rows: transactions.slice(0, 6).map((txn) => `
                        <tr>
                          <td>${escapeHtml(txn.description ?? "Transaction")}</td>
                          <td>${escapeHtml(txn.category_name ?? "Uncategorized")}</td>
                          <td>${formatTableAmount(txn.amount)}</td>
                          <td>${formatTableDate(txn.date)}</td>
                        </tr>
                      `),
                    }))}
                  </div>
                `,
              });
            } catch (error) {
              ctx.toast("Could not load", error.message, "danger");
            }
          });
        });
      },
    },
    transactions: {
      title: "Transactions",
      subtitle: "Audit and manage transactions across all users.",
      help: "Filter by archive state, amount, category, and date; then archive, restore, or permanently delete rows.",
      actions: () => "",
      load: async (ctx) => {
        const filters = readAdminTxnFilters();
        const offset = (filters.page - 1) * filters.limit;
        let transactionPayload;
        try {
          transactionPayload = await ctx.api("/transactions", {
            query: {
              search: filters.search,
              type: filters.type,
              category_id: filters.category_id,
              min_amount: filters.min_amount,
              max_amount: filters.max_amount,
              start_date: filters.start_date ? new Date(`${filters.start_date}T00:00:00`).toISOString() : "",
              end_date: filters.end_date ? new Date(`${filters.end_date}T23:59:59`).toISOString() : "",
              archive_filter: filters.archive_filter,
              sort_by: filters.sort_by,
              sort_order: filters.sort_order,
              limit: filters.limit,
              offset,
            },
          });
        } catch (error) {
          if (!isDemoMode()) throw error;
          const fallback = filterAdminFallbackTransactions(mockTransactions, filters);
          transactionPayload = {
            data: fallback.slice(offset, offset + filters.limit),
            meta: {
              total: fallback.length,
              limit: filters.limit,
              offset,
              page: filters.page,
              total_pages: Math.max(1, Math.ceil(fallback.length / filters.limit)),
              has_next: offset + filters.limit < fallback.length,
              has_prev: filters.page > 1,
            },
          };
        }

        const categories = await fetchOrFallback(ctx, "/categories", mockCategories);

        return {
          transactions: normalizeList(transactionPayload?.data ?? transactionPayload ?? []),
          categories: normalizeList(categories?.data ?? categories ?? []),
          filters,
          meta:
            transactionPayload?.meta && typeof transactionPayload.meta === "object"
              ? transactionPayload.meta
              : {},
        };
      },
      render: (data) => {
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const categoryList = Array.isArray(data.categories) ? data.categories : [];
        const filters = data.filters ?? defaultAdminTxnFilters();
        const meta = data.meta ?? {};
        const chips = adminTransactionFilterChips(filters, categoryList);
        return `
          ${hero(
            "Platform transactions",
            "Use server filters to narrow results and run bulk actions safely.",
            `
            `,
          )}
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Filters</span>
                <h3>Narrow transaction list</h3>
              </div>
            </div>
            <div class="panel-body">
              <div class="filter-shell">
                ${adminTransactionPresetButtons(filters)}
                <div class="filter-row">
                  <label class="field">
                    <span>Search</span>
                    <input class="input" data-admin-transaction-search type="search" placeholder="Search by description, user, category, or type" value="${escapeHtml(filters.search || "")}" />
                  </label>
                  ${selectField({
                    label: "Type",
                    name: "admin_filter_type",
                    value: String(filters.type || ""),
                    options: [
                      { value: "", label: "All types" },
                      { value: "income", label: "Income" },
                      { value: "expense", label: "Expense" },
                    ],
                  })}
                    ${selectField({
                      label: "Category",
                      name: "admin_filter_category_id",
                      value: String(filters.category_id || ""),
                      options: [{ value: "", label: "All categories" }, ...categoryList.map((category) => ({ value: category.id, label: category.name }))],
                    })}
                  ${button("Apply", { variant: "primary", attrs: 'data-action="apply-admin-transaction-filters"' })}
                </div>
                <details class="filter-advanced">
                  <summary>Advanced filters <span class="muted">Archive, range, and ordering</span></summary>
                  <div class="filter-advanced-grid">
                    ${selectField({
                      label: "Archive filter",
                      name: "admin_filter_archive",
                      value: String(filters.archive_filter || "all"),
                      options: [
                        { value: "all", label: "Active + archived" },
                        { value: "active", label: "Active only" },
                        { value: "archived", label: "Archived only" },
                      ],
                    })}
                    ${inputField({
                      label: "Min amount",
                      name: "admin_filter_min_amount",
                      type: "number",
                      value: filters.min_amount || "",
                      placeholder: "0",
                    })}
                    ${inputField({
                      label: "Max amount",
                      name: "admin_filter_max_amount",
                      type: "number",
                      value: filters.max_amount || "",
                      placeholder: "100000",
                    })}
                    ${inputField({
                      label: "Start date",
                      name: "admin_filter_start_date",
                      type: "date",
                      value: filters.start_date || "",
                    })}
                    ${inputField({
                      label: "End date",
                      name: "admin_filter_end_date",
                      type: "date",
                      value: filters.end_date || "",
                    })}
                    ${selectField({
                      label: "Sort by",
                      name: "admin_filter_sort_by",
                      value: String(filters.sort_by || "date"),
                      options: [
                        { value: "date", label: "Date" },
                        { value: "amount", label: "Amount" },
                        { value: "description", label: "Description" },
                        { value: "created_at", label: "Created at" },
                      ],
                    })}
                    ${selectField({
                      label: "Sort order",
                      name: "admin_filter_sort_order",
                      value: String(filters.sort_order || "desc"),
                      options: [
                        { value: "desc", label: "Newest first" },
                        { value: "asc", label: "Oldest first" },
                      ],
                    })}
                    ${selectField({
                      label: "Rows per page",
                      name: "admin_filter_limit",
                      value: String(filters.limit || 12),
                      options: [
                        { value: "10", label: "10" },
                        { value: "12", label: "12" },
                        { value: "20", label: "20" },
                        { value: "30", label: "30" },
                      ],
                    })}
                  </div>
                  <div class="filter-actions">
                    <div class="toolbar">
                      ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-admin-transaction-filters"' })}
                    </div>
                  </div>
                </details>
                <div class="filter-summary">
                  ${renderFilterChips(chips)}
                </div>
              </div>
            </div>
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Transactions</span>
                <h3>System ledger</h3>
              </div>
              <div class="toolbar">
                <span class="pill">${meta.total ?? transactions.length} total</span>
                ${button("Download CSV", { variant: "ghost", attrs: 'data-action="export-admin-transactions"' })}
              </div>
            </div>
            <div class="section-stack">
              <div class="bulk-toolbar">
                <div class="toolbar">
                  ${button("Select page", { variant: "secondary", attrs: 'data-action="select-admin-transactions"' })}
                  ${button("Clear", { variant: "ghost", attrs: 'data-action="clear-admin-transactions"' })}
                </div>
                <div class="toolbar">
                  ${button("Archive selected", { variant: "secondary", attrs: 'data-action="bulk-admin-archive"' })}
                  ${button("Restore selected", { variant: "secondary", attrs: 'data-action="bulk-admin-restore"' })}
                  ${button("Delete selected", { variant: "danger", attrs: 'data-action="bulk-admin-delete"' })}
                </div>
              </div>
              ${table({
                columns: ["Select", "Transaction", "User", "Category", "Type", "Amount", "Date", "Actions"],
                rows: renderTransactionRows(transactions, { selectable: true, includeHardDelete: true }),
                emptyLabel: "No transactions match the selected filters.",
              })}
              ${renderPagination(meta, "admin-txn-page")}
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const transactions = data.transactions || [];
        const filters = data.filters ?? defaultAdminTxnFilters();
        const meta = data.meta ?? {};
        const search = root.querySelector("[data-admin-transaction-search]");
        const typeFilter = root.querySelector('select[name="admin_filter_type"]');
        const archiveFilter = root.querySelector('select[name="admin_filter_archive"]');
        const categoryFilter = root.querySelector('select[name="admin_filter_category_id"]');
        const minAmountFilter = root.querySelector('input[name="admin_filter_min_amount"]');
        const maxAmountFilter = root.querySelector('input[name="admin_filter_max_amount"]');
        const startDateFilter = root.querySelector('input[name="admin_filter_start_date"]');
        const endDateFilter = root.querySelector('input[name="admin_filter_end_date"]');
        const sortByFilter = root.querySelector('select[name="admin_filter_sort_by"]');
        const sortOrderFilter = root.querySelector('select[name="admin_filter_sort_order"]');
        const limitFilter = root.querySelector('select[name="admin_filter_limit"]');

        const applyFilters = (nextPage = 1) => {
          writeAdminTxnFilters({
            ...filters,
            page: nextPage,
            search: (search?.value || "").trim(),
            type: typeFilter?.value || "",
            archive_filter: archiveFilter?.value || "all",
            category_id: categoryFilter?.value || "",
            min_amount: minAmountFilter?.value || "",
            max_amount: maxAmountFilter?.value || "",
            start_date: startDateFilter?.value || "",
            end_date: endDateFilter?.value || "",
            sort_by: sortByFilter?.value || "date",
            sort_order: sortOrderFilter?.value || "desc",
            limit: Number(limitFilter?.value || 12) || 12,
          });
          ctx.reload();
        };

        const checkedIds = () =>
          [...root.querySelectorAll("[data-admin-transaction-check]:checked")]
            .map((node) => node.getAttribute("data-id"))
            .filter(Boolean);

        root.querySelector('[data-action="apply-admin-transaction-filters"]')?.addEventListener("click", () => applyFilters(1));
        root.querySelector('[data-action="reset-admin-transaction-filters"]')?.addEventListener("click", () => {
          writeAdminTxnFilters(defaultAdminTxnFilters());
          ctx.reload();
        });
        search?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyFilters(1);
          }
        });

        root.querySelectorAll('[data-action="apply-admin-transaction-preset"]').forEach((button) => {
          button.addEventListener("click", () => {
            const preset = button.getAttribute("data-preset");
            const next = defaultAdminTxnFilters();
            if (preset === "income") {
              next.type = "income";
            } else if (preset === "expense") {
              next.type = "expense";
            } else if (preset === "archived") {
              next.archive_filter = "archived";
            }
            writeAdminTxnFilters(next);
            ctx.reload();
          });
        });

        root.querySelector('[data-action="admin-txn-page-prev"]')?.addEventListener("click", () => {
          applyFilters(Math.max(1, Number(filters.page || 1) - 1));
        });
        root.querySelector('[data-action="admin-txn-page-next"]')?.addEventListener("click", () => {
          applyFilters(Math.min(Number(meta.total_pages || 1) || 1, Number(filters.page || 1) + 1));
        });

        root.querySelector('[data-action="select-admin-transactions"]')?.addEventListener("click", () => {
          root.querySelectorAll("[data-admin-transaction-check]").forEach((node) => {
            node.checked = true;
          });
        });

        root.querySelector('[data-action="clear-admin-transactions"]')?.addEventListener("click", () => {
          root.querySelectorAll("[data-admin-transaction-check]").forEach((node) => {
            node.checked = false;
          });
        });

        root.querySelector('[data-action="bulk-admin-archive"]')?.addEventListener("click", async () => {
          const ids = checkedIds();
          if (!ids.length) return ctx.toast("No rows selected", "Select one or more rows first.", "warning");
          try {
            await ctx.api("/transactions", { method: "DELETE", query: { ids: ids.join(","), mode: "soft" } });
            ctx.toast("Transactions archived", `${ids.length} row(s) archived.`, "success");
            ctx.reload();
          } catch (error) {
            ctx.toast("Bulk archive failed", error.message, "danger");
          }
        });

        root.querySelector('[data-action="bulk-admin-restore"]')?.addEventListener("click", async () => {
          const ids = checkedIds();
          if (!ids.length) return ctx.toast("No rows selected", "Select one or more rows first.", "warning");
          try {
            await ctx.api("/transactions/restore-many", { method: "PUT", query: { ids: ids.join(",") } });
            ctx.toast("Transactions restored", `${ids.length} row(s) restored.`, "success");
            ctx.reload();
          } catch (error) {
            ctx.toast("Bulk restore failed", error.message, "danger");
          }
        });

        root.querySelector('[data-action="bulk-admin-delete"]')?.addEventListener("click", async () => {
          const ids = checkedIds();
          if (!ids.length) return ctx.toast("No rows selected", "Select one or more rows first.", "warning");
          if (!window.confirm(`Delete ${ids.length} transaction(s) permanently? This cannot be undone.`)) return;
          try {
            await ctx.api("/transactions", { method: "DELETE", query: { ids: ids.join(","), mode: "hard" } });
            ctx.toast("Transactions deleted", `${ids.length} row(s) permanently deleted.`, "success");
            ctx.reload();
          } catch (error) {
            ctx.toast("Bulk delete failed", error.message, "danger");
          }
        });

        root.querySelectorAll("[data-action='view-transaction']").forEach((btn) => {
          btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const txn = transactions.find((item) => String(item.id) === String(id));
            if (!txn) return;
            const amount = Number(txn.amount) || 0;
            ctx.openModal({
              title: "Transaction Details",
              note: `Transaction #${txn.id ?? "—"}`,
              content: `
                <div class="section-stack">
                  ${infoRow("ID", String(txn.id ?? "—"))}
                  ${infoRow("User", txn.user_name ?? txn.user_email ?? (txn.user_id ? `user-${txn.user_id}` : "unknown"))}
                  ${infoRow("Description", txn.description ?? "—")}
                  ${infoRow("Category", txn.category_name ?? "Uncategorized")}
                  ${infoRow("Type", txn.type ?? (amount >= 0 ? "income" : "expense"))}
                  ${infoRow("Status", txn.is_deleted ? "archived" : "active")}
                  ${infoRow("Amount", formatINR(amount))}
                  ${infoRow("Date", formatDateTime(txn.date))}
                </div>
              `,
            });
          });
        });

        root.querySelectorAll("[data-action='archive-transaction']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!window.confirm("Archive this transaction?")) return;
            try {
              await ctx.api(`/transactions/${id}`, { method: "DELETE", query: { mode: "soft" } });
              ctx.toast("Transaction archived", "The row moved to archived state.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Archive failed", error.message, "danger");
            }
          });
        });

        root.querySelectorAll("[data-action='restore-transaction']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            try {
              await ctx.api(`/transactions/${id}/restore`, { method: "PUT" });
              ctx.toast("Transaction restored", "The row is active again.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Restore failed", error.message, "danger");
            }
          });
        });

        root.querySelectorAll("[data-action='hard-delete-transaction']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            if (!window.confirm("Delete this transaction forever? This action cannot be undone.")) return;
            try {
              await ctx.api(`/transactions/${id}`, { method: "DELETE", query: { mode: "hard" } });
              ctx.toast("Transaction deleted", "The row was removed permanently.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Delete failed", error.message, "danger");
            }
          });
        });

        root.querySelector("[data-action='export-admin-transactions']")?.addEventListener("click", () => {
          downloadCsv(
            `admin-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
            ["ID", "User", "Description", "Category", "Type", "Status", "Amount", "Date"],
            buildAdminTransactionCsvRows(transactions),
          );
          ctx.toast("CSV downloaded", "Admin transactions export has started.", "success");
        });
      },
    },
    categories: {
      title: "Categories",
      subtitle: "Create and maintain global income and expense categories.",
      actions: () => "",
      load: async (ctx) => {
        const categories = await fetchOrFallback(ctx, "/categories", mockCategories);
        return { categories: normalizeList(categories?.data ?? categories ?? []) };
      },
      render: (data) => {
        const categories = Array.isArray(data.categories) ? data.categories : [];
        return `
          ${hero(
            "Categories",
            "Manage shared categories used across the platform.",
            `
              <label class="field field-search-wide">
                <span class="sr-only">Search categories</span>
                <input class="input" data-category-search type="search" placeholder="Search category names" />
              </label>
              ${button("Apply", { variant: "primary", attrs: 'data-action="apply-category-filters"' })}
              ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-category-filters"' })}
              ${button("Create category", { variant: "primary", attrs: 'data-action="open-create-category"' })}
            `,
          )}
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Category usage</span>
                <h3>Income and expense categories</h3>
              </div>
            </div>
            <div class="panel-body">
              <div class="section-stack">
                <div class="form-grid">
                  ${selectField({
                    label: "Type",
                    name: "category_filter_type",
                    value: "",
                    options: [
                      { value: "", label: "All types" },
                      { value: "income", label: "Income" },
                      { value: "expense", label: "Expense" },
                    ],
                  })}
                </div>
                <div class="toolbar toolbar-split">
                  ${badge(`${categories.filter((category) => category.type === "income").length} income`, "green")}
                  ${badge(`${categories.filter((category) => category.type === "expense").length} expense`, "red")}
                  <span class="pill" data-category-count>${categories.length} shown</span>
                </div>
                ${table({
                  columns: ["Category", "Type", "Usage", "Actions"],
                  rows: renderCategoryRows(categories),
                })}
              </div>
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const search = root.querySelector("[data-category-search]");
        const typeFilter = root.querySelector('select[name="category_filter_type"]');
        const rows = [...root.querySelectorAll("[data-category-row]")];
        const countNode = root.querySelector("[data-category-count]");

        const applyCategoryFilters = () => {
          const query = (search?.value || "").trim().toLowerCase();
          const type = (typeFilter?.value || "").toLowerCase();
          let visible = 0;
          rows.forEach((row) => {
            const searchable = row.getAttribute("data-searchable") || "";
            const rowType = (row.getAttribute("data-type") || "").toLowerCase();
            const matches = (!query || searchable.includes(query)) && (!type || rowType === type);
            row.style.display = matches ? "" : "none";
            if (matches) visible += 1;
          });
          if (countNode) countNode.textContent = `${visible} shown`;
        };

        root.querySelector("[data-action='open-create-category']")?.addEventListener("click", () => {
          ctx.openModal({
            title: "Create Category",
            note: "Add a shared income or expense category",
            content: categoryForm(),
          });
          const modalRoot = document.getElementById("modal-root");
          const categoryFormNode = modalRoot?.querySelector('[data-form="category"]');
          const validateCategoryForm = attachCategoryFormValidation(categoryFormNode);
          categoryFormNode?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const validationError = validateCategoryForm();
            if (validationError) {
              ctx.toast("Invalid category", validationError, "warning");
              return;
            }
            const formData = new FormData(event.currentTarget);
            const validation = validateCategoryPayload(formData.get("name"));
            if (!validation.ok) {
              ctx.toast("Invalid category", validation.message, "warning");
              return;
            }
            try {
              await ctx.api("/categories", {
                method: "POST",
                body: {
                  name: validation.value,
                  type: String(formData.get("type") || "expense"),
                },
              });
              ctx.closeModal();
              ctx.toast("Category created", "It has been added to the global catalog.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Create failed", error.message, "danger");
            }
          });
        });

        search?.addEventListener("input", applyCategoryFilters);
        typeFilter?.addEventListener("change", applyCategoryFilters);
        root.querySelector('[data-action="apply-category-filters"]')?.addEventListener("click", applyCategoryFilters);
        root.querySelector('[data-action="reset-category-filters"]')?.addEventListener("click", () => {
          if (search) search.value = "";
          if (typeFilter) typeFilter.value = "";
          applyCategoryFilters();
        });

        root.querySelectorAll("[data-action='delete-category']").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const category = (data.categories || []).find((item) => String(item.id) === String(id));
            if (!category) return;

            const replacementOptions = (data.categories || [])
              .filter((item) => String(item.id) !== String(id) && String(item.type) === String(category.type))
              .map((item) => ({ value: String(item.id), label: item.name }));

            const usageCount = Number(category.usage_count || 0) || 0;
            const requiresReassignment = usageCount > 0;

            if (requiresReassignment && !replacementOptions.length) {
              ctx.openModal({
                title: "Delete Category",
                note: "Category is in use",
                content: `
                  <div class="section-stack">
                    ${badge("Reassignment required", "yellow")}
                    ${infoRow("Category", category.name)}
                    ${infoRow("Type", category.type)}
                    ${infoRow("Linked transactions", String(usageCount))}
                    <div class="toolbar">
                      ${button("Cancel", { variant: "secondary", attrs: 'data-action="close-modal"' })}
                    </div>
                  </div>
                `,
              });
              return;
            }

            ctx.openModal({
              title: "Delete Category",
              note: "This action is permanent",
              content: `
                <form class="form-card" data-form="delete-category">
                  <div class="section-stack">
                    ${infoRow("Name", category.name)}
                    ${infoRow("Type", category.type)}
                    ${requiresReassignment ? infoRow("Linked transactions", String(usageCount)) : ""}
                    ${replacementOptions.length ? selectField({
                      label: "Reassign transactions to",
                      name: "reassign_to",
                      value: "",
                      options: [
                        { value: "", label: requiresReassignment ? "Select replacement" : "No reassignment" },
                        ...replacementOptions,
                      ],
                      required: requiresReassignment,
                    }) : ""}
                    <div class="toolbar">
                      <button class="button button-danger" type="submit">Delete category</button>
                      ${button("Cancel", { variant: "secondary", attrs: 'data-action="close-modal"' })}
                    </div>
                  </div>
                </form>
              `,
            });

            const modalRoot = document.getElementById("modal-root");
            modalRoot?.querySelector('[data-form="delete-category"]')?.addEventListener("submit", async (event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const reassignTo = String(formData.get("reassign_to") || "");

              if (requiresReassignment && !reassignTo) {
                ctx.toast("Select replacement", "Choose a category to reassign existing transactions.", "warning");
                return;
              }

              try {
                await ctx.api(`/categories/${id}`, {
                  method: "DELETE",
                  query: {
                    reassign_to: reassignTo || undefined,
                  },
                });
                ctx.closeModal();
                ctx.toast("Category deleted", "The category was removed successfully.", "success");
                ctx.reload();
              } catch (error) {
                ctx.toast("Delete failed", error.message, "danger");
              }
            });
          });
        });

        applyCategoryFilters();
      },
    },
    reports: {
      title: "Reports",
      subtitle: "Review platform analytics and export concise summaries.",
      actions: () => `${button("Export PDF", { variant: "secondary", attrs: 'data-action="export-report-pdf"' })}${button("Export CSV", { variant: "primary", attrs: 'data-action="export-report-csv"' })}`,
      load: async (ctx) => {
        const trendMode = readAdminReportTrendMode();
        const analytics = await fetchOrFallback(ctx, "/admin/analytics", buildFallbackAdminAnalytics());
        return { analytics: normalizeDetail(analytics?.data ?? analytics ?? {}), trendMode };
      },
      render: (data) => {
        const analytics = data.analytics ?? buildFallbackAdminAnalytics();
        const trendMode = data.trendMode ?? readAdminReportTrendMode();
        const trend = adminTrendSeriesByMode(analytics, trendMode);
        const categories = adminCategorySeries(analytics);
        const hasTrendData = hasMeaningfulSeries(trend);
        const hasCategoryData = hasMeaningfulCategories(categories);
        const categoryTotal = categories.reduce((sum, entry) => sum + Number(entry.value || 0), 0);
        const balanceTrend = recentSeriesTrend(trend, Number(analytics.balance ?? 0) >= 0 ? "up" : "down");
        const incomeTrend = monthlyTypeTrend(analytics.monthly_summary ?? [], "income", "up");
        const expenseTrend = monthlyTypeTrend(analytics.monthly_summary ?? [], "expense", "down");
        const coverage = topCategoryCoverage(categories);
        const trendExtrema = seriesExtrema(trend);
        return `
          ${hero("Analytics", "Track net position, inflow, outflow, and category mix.")}
          <section class="cards-grid">
            ${metricCard({ label: "Net position", value: formatINR(analytics.balance ?? 0), trend: hasTrendData ? balanceTrend : { label: "Waiting", kind: "up" }, hint: hasTrendData ? "System level balance" : "Activity will appear after platform usage begins", icon: "Σ" })}
            ${metricCard({ label: "Inflow", value: formatINR(analytics.total_income ?? 0), trend: hasTrendData ? incomeTrend : { label: "Waiting", kind: "up" }, hint: hasTrendData ? "Credits across the platform" : "Credits will appear once income is recorded", icon: "↑" })}
            ${metricCard({ label: "Outflow", value: formatINR(analytics.total_expense ?? 0), trend: hasTrendData ? expenseTrend : { label: "Waiting", kind: "down" }, hint: hasTrendData ? "Debits and expenses" : "Debits will appear once expense activity begins", icon: "↓" })}
          </section>
          <section class="analysis-grid">
            ${panel(
              "Trend",
              trendMode === "income" ? "Monthly inflow" : trendMode === "expense" ? "Monthly outflow" : "System movement",
              hasTrendData
                ? `<div class="chart-shell"><div class="chart-canvas">${lineChartSVG(trend, { stroke: "#7dd3fc" })}</div><div class="chart-legend"><span class="pill">${escapeHtml(ADMIN_REPORT_TREND_LABELS[trendMode] || "Net")} trend</span>${trendExtrema.high ? `<span class="pill">Peak ${escapeHtml(trendExtrema.high.label)} ${escapeHtml(formatINR(trendExtrema.high.value))}</span>` : ""}${trendExtrema.low ? `<span class="pill">Low ${escapeHtml(trendExtrema.low.label)} ${escapeHtml(formatINR(trendExtrema.low.value))}</span>` : ""}</div></div>`
                : dashboardEmptyState("No platform trend yet", "System movement will render here once enough financial activity exists across users.", "View Users", "users", "↗"),
              `
                ${button("Net", { variant: trendMode === "net" ? "primary" : "secondary", attrs: 'data-action="set-admin-report-trend-mode" data-mode="net"' })}
                ${button("Inflow", { variant: trendMode === "income" ? "primary" : "secondary", attrs: 'data-action="set-admin-report-trend-mode" data-mode="income"' })}
                ${button("Outflow", { variant: trendMode === "expense" ? "primary" : "secondary", attrs: 'data-action="set-admin-report-trend-mode" data-mode="expense"' })}
              `,
            )}
            ${panel("Category mix", "Usage distribution", hasCategoryData ? `<div class="chart-shell"><div class="chart-canvas">${donutChartSVG(categories, {
              centerLabel: "",
              centerValue: "",
              valueFormatter: (value) => formatINR(value),
              showLegend: true,
            })}</div><div class="chart-legend"><span class="pill">Top 3 cover ${coverage}%</span></div></div>` : dashboardEmptyState("No category usage yet", "This category view will populate after the platform records categorized financial activity.", "Open Reports", "reports", "◔"))}
          </section>
          <section class="two-up">
            ${panel("Category summary", "Top categories by usage", `
              <div class="section-stack">
                <div class="toolbar">${badge(`Top 3 cover ${coverage}%`, "accent")}</div>
                ${cardList(categories.map((item) => `
                  <article class="list-item">
                    <div>
                      <strong>${escapeHtml(item.label)}</strong>
                      <p>${escapeHtml(formatINR(item.value))}</p>
                    </div>
                    ${badge(`${Math.max(0, Math.round((Number(item.value) || 0) / Math.max(categories.reduce((sum, entry) => sum + Number(entry.value || 0), 0), 1) * 100))}%`, "accent")}
                  </article>
                `))}
              </div>
            `)}
            ${panel("Export", "Download and handoff", `
              <div class="section-stack">
                <div class="toolbar">
                  ${button("Export CSV", { variant: "primary", attrs: 'data-action="export-report-csv"' })}
                  ${button("Export PDF", { variant: "secondary", attrs: 'data-action="export-report-pdf"' })}
                </div>
                <div class="list">
                  ${infoRow("Rows", String((analytics.monthly_summary ?? []).length))}
                  ${infoRow("Categories", String(categories.length))}
                  ${infoRow("Total tracked", formatINR(categoryTotal))}
                </div>
              </div>
            `)}
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const analytics = data.analytics ?? buildFallbackAdminAnalytics();
        const trendMode = data.trendMode ?? readAdminReportTrendMode();

        root.querySelectorAll("[data-action='set-admin-report-trend-mode']").forEach((node) => {
          node.addEventListener("click", () => {
            const next = node.getAttribute("data-mode") || "net";
            if (next === trendMode) return;
            writeAdminReportTrendMode(next);
            ctx.reload();
          });
        });

        root.querySelectorAll("[data-action='export-report-csv']").forEach((node) => {
          node.addEventListener("click", () => {
            downloadCsv(
              `admin-report-${new Date().toISOString().slice(0, 10)}.csv`,
              ["Metric", "Value"],
              buildAdminReportCsvRows(analytics),
            );
            ctx.toast("CSV downloaded", "Report export has started.", "success");
          });
        });

        root.querySelectorAll("[data-action='export-report-pdf']").forEach((node) => {
          node.addEventListener("click", () => {
            downloadFinancialReportPdf(
              `admin-report-${new Date().toISOString().slice(0, 10)}.pdf`,
              buildAdminReportPdfPayload(analytics),
            );
            ctx.toast("PDF downloaded", "Report export has started.", "success");
          });
        });

      },
    },
    logs: {
      title: "Logs",
      subtitle: "Filter operational events by level and action.",
      help: "Filter by action, level, request id, and date range; open details for payload and entity context.",
      actions: () => "",
      load: async (ctx) => {
        const filters = readAdminLogFilters();
        const offset = (filters.page - 1) * filters.limit;

        let payload;
        try {
          payload = await ctx.api("/logs", {
            query: {
              action: filters.action,
              level: filters.level,
              request_id: filters.request_id,
              start_date: filters.start_date ? new Date(`${filters.start_date}T00:00:00`).toISOString() : "",
              end_date: filters.end_date ? new Date(`${filters.end_date}T23:59:59`).toISOString() : "",
              limit: filters.limit,
              offset,
            },
          });
        } catch (error) {
          if (!isDemoMode()) throw error;
          const fallback = filterAdminFallbackLogs(mockLogs, filters);
          payload = {
            data: fallback.slice(offset, offset + filters.limit),
            meta: {
              total: fallback.length,
              limit: filters.limit,
              offset,
              page: filters.page,
              total_pages: Math.max(1, Math.ceil(fallback.length / filters.limit)),
              has_next: offset + filters.limit < fallback.length,
              has_prev: filters.page > 1,
            },
          };
        }

        const stats = await fetchOrFallback(ctx, "/logs/stats", buildFallbackLogStats(), {
          query: {
            start_date: filters.start_date ? new Date(`${filters.start_date}T00:00:00`).toISOString() : "",
            end_date: filters.end_date ? new Date(`${filters.end_date}T23:59:59`).toISOString() : "",
          },
        });

        return {
          logs: normalizeList(payload?.data ?? payload ?? []),
          stats: normalizeDetail(stats?.data ?? stats ?? {}),
          meta: payload?.meta && typeof payload.meta === "object" ? payload.meta : {},
          filters,
        };
      },
      render: (data) => {
        const logs = data.logs || [];
        const stats = data.stats ?? buildFallbackLogStats();
        const meta = data.meta ?? {};
        const filters = data.filters ?? defaultAdminLogFilters();
        const actionOptions = [
          ...new Set([filters.action, ...logs.map((item) => String(item.action ?? "").toUpperCase())].filter(Boolean)),
        ].sort();
        const chips = adminLogFilterChips(filters);
        return `
          ${hero(
            "Operation logs",
            "Inspect events with timestamp, severity, and action context.",
            ``,
          )}
          <section class="cards-grid">
            ${metricCard({ label: "Events", value: String(stats.total ?? meta.total ?? logs.length), trend: { label: "Observed", kind: "up" }, hint: "Total log items", icon: "#" })}
            ${metricCard({ label: "This page", value: String(logs.length), trend: { label: "Visible", kind: "up" }, hint: "Rows in current view", icon: "↻" })}
            ${metricCard({ label: "Warnings", value: String(logLevelCount(stats, "warning") || logs.filter((item) => String(item.level ?? item.severity).toLowerCase() === "warning").length), trend: { label: "Review", kind: "down" }, hint: "Items to inspect", icon: "!" })}
            ${metricCard({ label: "Errors", value: String(logLevelCount(stats, "error") || logs.filter((item) => String(item.level ?? item.severity).toLowerCase() === "error").length), trend: { label: "Critical", kind: "down" }, hint: "Hard failures", icon: "×" })}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Logs</span>
                <h3>System timeline</h3>
              </div>
              <span class="pill">${meta.total ?? logs.length} total</span>
            </div>
            <div class="panel-body">
              <div class="filter-shell">
                <div class="filter-row">
                  <label class="field">
                    <span>Request ID</span>
                    <input class="input" data-log-request-id name="log_filter_request_id" type="search" value="${escapeHtml(filters.request_id || "")}" placeholder="req_..." />
                  </label>
                  ${selectField({
                    label: "Level",
                    name: "log_filter_level",
                    value: String(filters.level || ""),
                    options: [
                      { value: "", label: "All levels" },
                      { value: "info", label: "Info" },
                      { value: "success", label: "Success" },
                      { value: "warning", label: "Warning" },
                      { value: "error", label: "Error" },
                    ],
                  })}
                  ${selectField({
                    label: "Action",
                    name: "log_filter_action",
                    value: String(filters.action || ""),
                    options: [{ value: "", label: "All actions" }, ...actionOptions.map((value) => ({ value, label: value }))],
                  })}
                  ${button("Apply", { variant: "primary", attrs: 'data-action="apply-log-filters"' })}
                </div>
                <details class="filter-advanced">
                  <summary>Advanced filters <span class="muted">Date range and page size</span></summary>
                  <div class="filter-advanced-grid">
                    ${inputField({
                      label: "Start date",
                      name: "log_filter_start_date",
                      type: "date",
                      value: filters.start_date || "",
                    })}
                    ${inputField({
                      label: "End date",
                      name: "log_filter_end_date",
                      type: "date",
                      value: filters.end_date || "",
                    })}
                    ${selectField({
                      label: "Rows per page",
                      name: "log_filter_limit",
                      value: String(filters.limit || 12),
                      options: [
                        { value: "10", label: "10" },
                        { value: "12", label: "12" },
                        { value: "20", label: "20" },
                        { value: "30", label: "30" },
                      ],
                    })}
                  </div>
                  <div class="filter-actions">
                    <div class="toolbar">
                      ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-log-filters"' })}
                    </div>
                  </div>
                </details>
                <div class="filter-summary">
                  ${renderFilterChips(chips)}
                </div>
              </div>
            </div>
            ${table({
              columns: ["Level", "Action", "Request", "Time", "Actions"],
              rows: renderLogRows(logs),
              emptyLabel: "No log entries match the selected filters.",
            })}
            <div class="panel-body">
              ${renderPagination(meta, "admin-log-page")}
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const filters = data.filters ?? defaultAdminLogFilters();
        const meta = data.meta ?? {};
        const logs = data.logs || [];
        const requestIdInput = root.querySelector("[data-log-request-id]");
        const levelFilter = root.querySelector('select[name="log_filter_level"]');
        const actionFilter = root.querySelector('select[name="log_filter_action"]');
        const startDateFilter = root.querySelector('input[name="log_filter_start_date"]');
        const endDateFilter = root.querySelector('input[name="log_filter_end_date"]');
        const limitFilter = root.querySelector('select[name="log_filter_limit"]');

        const applyLogFilters = (nextPage = 1) => {
          writeAdminLogFilters({
            ...filters,
            page: nextPage,
            action: actionFilter?.value || "",
            level: levelFilter?.value || "",
            request_id: (requestIdInput?.value || "").trim(),
            start_date: startDateFilter?.value || "",
            end_date: endDateFilter?.value || "",
            limit: Number(limitFilter?.value || 12) || 12,
          });
          ctx.reload();
        };

        root.querySelector('[data-action="apply-log-filters"]')?.addEventListener("click", () => applyLogFilters(1));
        root.querySelector('[data-action="reset-log-filters"]')?.addEventListener("click", () => {
          writeAdminLogFilters(defaultAdminLogFilters());
          ctx.reload();
        });
        requestIdInput?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyLogFilters(1);
          }
        });

        root.querySelector('[data-action="admin-log-page-prev"]')?.addEventListener("click", () => {
          applyLogFilters(Math.max(1, Number(filters.page || 1) - 1));
        });
        root.querySelector('[data-action="admin-log-page-next"]')?.addEventListener("click", () => {
          applyLogFilters(Math.min(Number(meta.total_pages || 1) || 1, Number(filters.page || 1) + 1));
        });

        root.querySelectorAll("[data-action='view-log']").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.getAttribute("data-log-key") || "";
            const log =
              logs.find((entry, index) => {
                const rowKey = entry.id != null ? `id-${entry.id}` : `idx-${index}`;
                return rowKey === key;
              }) || null;
            if (!log) return;

            const payload = log.payload && typeof log.payload === "object" ? JSON.stringify(log.payload, null, 2) : "{}";
            ctx.openModal({
              title: "Log Details",
              note: `Request ${log.request_id ?? "—"}`,
              content: `
                <div class="section-stack">
                  ${infoRow("Action", log.action_label ?? log.action ?? "Event")}
                  ${infoRow("Action key", String(log.action ?? "—"))}
                  ${infoRow("Level", String(log.level ?? log.severity ?? "info"))}
                  ${infoRow("Request ID", String(log.request_id ?? "—"))}
                  ${infoRow("Entity", `${log.entity_type ?? "unknown"}${log.entity_id ? ` #${log.entity_id}` : ""}`)}
                  ${infoRow("Actor", log.user_name ?? log.user_email ?? "System")}
                  ${infoRow("Time", formatDateTime(log.created_at ?? log.time ?? log.timestamp ?? new Date(), { withSeconds: true, compact: true }))}
                  ${infoRow("Description", log.action_description ?? log.message ?? "—")}
                  <div class="list-item">
                    <div>
                      <span class="section-label">Payload</span>
                      <pre class="mono">${escapeHtml(payload)}</pre>
                    </div>
                  </div>
                </div>
              `,
            });
          });
        });
      },
    },
    profile: {
      title: "Profile",
      subtitle: "Manage admin identity and security settings.",
      actions: () => "",
      load: async (ctx) => {
        const profile = await fetchOrFallback(ctx, "/users/me", mockProfile);
        return { profile: normalizeDetail(profile?.data ?? profile ?? {}) };
      },
      render: (data) => {
        const profile = data.profile ?? mockProfile;
        return `
          ${hero("Admin profile", "Keep the system account current and secure.")}
          <section class="cards-grid">
            ${metricCard({ label: "Role", value: String(profile.role ?? "admin").toUpperCase(), trend: { label: "Access", kind: "up" }, hint: "Workspace identity", icon: "ID" })}
            ${metricCard({ label: "Status", value: String(profile.status ?? "active"), trend: { label: "Healthy", kind: "up" }, hint: "Access state", icon: "✓" })}
            ${metricCard({ label: "Joined", value: formatDate(profile.created_at ?? new Date()), trend: { label: "Established", kind: "up" }, hint: "Account age", icon: "⌁" })}
            ${metricCard({ label: "Email", value: String(profile.email ?? "—"), trend: { label: "Verified", kind: "up" }, hint: "Admin login", icon: "@" })}
          </section>
          ${profileForm(profile)}
        `;
      },
      bind: (root, data, ctx) => {
        const profileFormNode = root.querySelector('[data-form="profile"]');
        const validateProfileForm = attachProfileFormValidation(profileFormNode);
        profileFormNode?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const validationError = validateProfileForm();
          if (validationError) {
            ctx.toast("Invalid profile", validationError, "warning");
            return;
          }
          const formData = new FormData(event.currentTarget);
          try {
            await ctx.api("/users/me", {
              method: "PUT",
              body: {
                name: String(formData.get("name") || "").trim(),
                email: String(formData.get("email") || "").trim(),
              },
            });
            ctx.toast("Profile updated", "Admin details were saved.", "success");
            ctx.reload();
          } catch (error) {
            ctx.toast("Update failed", error.message, "danger");
          }
        });

        const passwordFormNode = root.querySelector('[data-form="password"]');
        const validatePasswordForm = attachPasswordFormValidation(passwordFormNode);
        passwordFormNode?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const validationError = validatePasswordForm();
          if (validationError) {
            ctx.toast("Invalid password", validationError, "warning");
            return;
          }
          const formData = new FormData(event.currentTarget);
          try {
            await ctx.api("/auth/change-password", {
              method: "POST",
              body: {
                old_password: String(formData.get("old_password") || ""),
                new_password: String(formData.get("new_password") || ""),
              },
            });
            ctx.toast("Password updated", "Security credentials were rotated.", "success");
            event.currentTarget.reset();
          } catch (error) {
            ctx.toast("Update failed", error.message, "danger");
          }
        });

        root.querySelector("[data-action='admin-delete-account']")?.addEventListener("click", async () => {
          if (!window.confirm("Delete the admin account permanently? This action removes access and signs you out.")) return;
          const confirmation = window.prompt("Type DELETE to confirm admin account removal.");
          if (confirmation !== "DELETE") {
            ctx.toast("Delete cancelled", "Confirmation text did not match.", "warning");
            return;
          }
          try {
            await ctx.api("/users/me", { method: "DELETE" });
            ctx.toast("Account deleted", "You have been signed out.", "success");
            ctx.logout(true);
          } catch (error) {
            ctx.toast("Delete failed", error.message, "danger");
          }
        });
      },
    },
  },
};
