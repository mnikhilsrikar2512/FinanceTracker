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
  loadingState,
  metricCard,
  panel,
  progressRow,
  rowAction,
  selectField,
  statusBadge,
  table,
  textareaField,
} from "../core/ui.js?v=20260507j";
import { escapeHtml } from "../core/dom.js?v=20260507j";
import { downloadCsv, downloadFinancialReportPdf } from "../core/export.js?v=20260507j";
import {
  formatDate,
  formatDateTime,
  formatDateTimeInput,
  formatINR,
  formatLongDate,
  timeAgo,
} from "../core/format.js?v=20260507j";
import {
  buildFallbackSummary,
  buildFallbackNotifications,
  mockCategories,
  mockProfile,
  mockTransactions,
} from "../data/mock.js?v=20260507j";

function fallbackTransactions() {
  return mockTransactions;
}

function fallbackCategories() {
  return mockCategories;
}

function fallbackProfile() {
  return mockProfile;
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
    if (isDemoMode()) {
      return typeof fallback === "function" ? fallback(error) : fallback;
    }
    throw error;
  }
}

function renderKpis(summary) {
  const overview = summary.overview ?? {};
  const income = Number(overview.total_income ?? 0);
  const expense = Number(overview.total_expense ?? 0);
  const balance = Number(overview.balance ?? 0);
  const isEmpty = income === 0 && expense === 0 && balance === 0;
  return `
    <section class="cards-grid">
      ${metricCard({ label: "Balance", value: formatINR(balance), trend: { label: isEmpty ? "Start here" : "Live", kind: "up" }, hint: isEmpty ? "Add a transaction to start your workspace" : "Current available cash", icon: "₹" })}
      ${metricCard({ label: "Income", value: formatINR(income), trend: { label: isEmpty ? "Waiting" : "Tracked", kind: "up" }, hint: isEmpty ? "Your inflows will appear after the first entry" : "Incoming amount this period", icon: "↑" })}
      ${metricCard({ label: "Expense", value: formatINR(expense), trend: { label: isEmpty ? "Waiting" : "Tracked", kind: "down" }, hint: isEmpty ? "Your outflows will appear after the first entry" : "Expenses captured this period", icon: "↓" })}
    </section>
  `;
}

function chartEmptyState({ title, description, actionLabel, actionTarget, icon = "◎" }) {
  return `
    <div class="chart-shell">
      ${emptyState(
        title,
        description,
        button(actionLabel, { variant: "primary", attrs: `data-go="${actionTarget}"` }),
        icon,
      )}
    </div>
  `;
}

function hasMeaningfulSeries(series = []) {
  return Array.isArray(series) && series.some((item) => Math.abs(Number(item?.value ?? 0)) > 0);
}

function hasMeaningfulCategories(series = []) {
  return Array.isArray(series) && series.some((item) => Number(item?.value ?? 0) > 0);
}

function formatINRExport(value) {
  const amount = Number(value) || 0;
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

function bucketDateFromKey(raw, index = 0) {
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
}

function normalizeMonthlySeries(summary) {
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
  (summary.monthly_summary ?? []).forEach((item, index) => {
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
      date: bucketDateFromKey(key, index),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item, index) => ({
      label: toBucketLabel(item.key, index),
      value: item.value,
    }));
}

function normalizeCategorySeries(summary) {
  return (summary.category_summary ?? [])
    .map((item, index) => ({
      label: item.category_name ?? item.name ?? item.category ?? `Category ${index + 1}`,
      value: Math.abs(Number(item.total_expense ?? item.total_amount ?? item.amount ?? item.total_income ?? item.total ?? item.value ?? 0) || 0),
      color: ["#7dd3fc", "#34d399", "#a78bfa", "#fbbf24"][index % 4],
    }))
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
}

function monthlySnapshotRows(summary = {}) {
  const rows = new Map();
  (summary.monthly_summary ?? []).forEach((item, index) => {
    const key = item.bucketStartKey ?? item.bucket ?? `${item.year ?? "y"}-${item.month ?? index}`;
    const date = bucketDateFromKey(key, index);
    const label = item.label ?? new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
    const current = rows.get(key) ?? { label, income: 0, expense: 0 };
    if (item.type === "income") {
      current.income += Number(item.total ?? 0) || 0;
    } else if (item.type === "expense") {
      current.expense += Math.abs(Number(item.total ?? 0) || 0);
    }
    rows.set(key, current);
  });

  return [...rows.entries()]
    .map(([key, item], index) => ({
      key,
      date: bucketDateFromKey(key, index),
      ...item,
      net: Number(item.income || 0) - Number(item.expense || 0),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function buildReportTrendSeries(monthlyRows = [], mode = "net") {
  return monthlyRows.map((row) => ({
    label: row.label,
    value: mode === "income"
      ? Number(row.income || 0)
      : mode === "expense"
        ? Number(row.expense || 0)
        : Number(row.net || 0),
  }));
}

function totalCategoryValue(series = []) {
  return series.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
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

function monthlyTypeTrend(summary = {}, type = "income", fallbackKind = "up") {
  const grouped = new Map();
  (summary.monthly_summary ?? []).forEach((entry, index) => {
    if (String(entry.type || "").toLowerCase() !== String(type).toLowerCase()) return;
    const key = entry.bucketStartKey ?? entry.bucket ?? entry.label ?? `${entry.year ?? "y"}-${entry.month ?? index}`;
    const current = grouped.get(key) ?? 0;
    grouped.set(key, current + Math.abs(Number(entry.total ?? 0) || 0));
  });
  const series = [...grouped.entries()]
    .map(([key, value], index) => ({ value, date: bucketDateFromKey(key, index) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => item.value);

  if (series.length < 2) return { label: "Live", kind: fallbackKind };
  return trendFromCurrentPrevious(series[series.length - 1], series[series.length - 2], fallbackKind);
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

const USER_REPORT_RANGE_KEY = "finly.userReports.range";
const USER_REPORT_TREND_MODE_KEY = "finly.userReports.trendMode";
const USER_TXN_FILTER_KEY = "finly.userTransactions.filters";
const USER_NOTIFICATIONS_PAGE_KEY = "finly.userNotifications.page";
const USER_NOTIFICATIONS_HIDDEN_KEY = "finly.userNotifications.hidden";
const USER_REPORT_RANGE_LABELS = {
  this_month: "This month",
  last_3_months: "Last 3 months",
  all_time: "All time",
};

const USER_REPORT_TREND_LABELS = {
  net: "Net",
  income: "Inflow",
  expense: "Outflow",
};

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

function notificationItemKey(item, index = 0) {
  if (item?.id != null) return `id-${item.id}`;
  const base = `${item?.action ?? "event"}-${item?.created_at ?? item?.time ?? item?.timestamp ?? index}`;
  return `event-${base}`;
}

function readHiddenNotificationKeys() {
  try {
    const parsed = JSON.parse(safeStorageGet(USER_NOTIFICATIONS_HIDDEN_KEY, "[]"));
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

function writeHiddenNotificationKeys(keys) {
  const deduped = [...new Set((keys || []).map((entry) => String(entry)).filter(Boolean))];
  safeStorageSet(USER_NOTIFICATIONS_HIDDEN_KEY, JSON.stringify(deduped));
}

function readUserReportTrendMode() {
  const saved = String(safeStorageGet(USER_REPORT_TREND_MODE_KEY, "net") || "net");
  return USER_REPORT_TREND_LABELS[saved] ? saved : "net";
}

function writeUserReportTrendMode(value) {
  if (USER_REPORT_TREND_LABELS[value]) {
    safeStorageSet(USER_REPORT_TREND_MODE_KEY, value);
  }
}

function defaultUserTxnFilters() {
  return {
    search: "",
    type: "",
    category_id: "",
    start_date: "",
    end_date: "",
    archive_filter: "active",
    sort_by: "date",
    sort_order: "desc",
    page: 1,
    limit: 12,
  };
}

function readUserTxnFilters() {
  try {
    const parsed = JSON.parse(safeStorageGet(USER_TXN_FILTER_KEY, "{}") || "{}");
    const base = defaultUserTxnFilters();
    return {
      ...base,
      ...parsed,
      page: Math.max(1, Number(parsed.page || base.page) || 1),
      limit: Math.min(50, Math.max(5, Number(parsed.limit || base.limit) || base.limit)),
      archive_filter: ["active", "archived", "all"].includes(String(parsed.archive_filter || "").toLowerCase())
        ? String(parsed.archive_filter).toLowerCase()
        : base.archive_filter,
      sort_by: ["date", "amount", "description"].includes(String(parsed.sort_by || "").toLowerCase())
        ? String(parsed.sort_by).toLowerCase()
        : base.sort_by,
      sort_order: String(parsed.sort_order || "").toLowerCase() === "asc" ? "asc" : "desc",
    };
  } catch {
    return defaultUserTxnFilters();
  }
}

function writeUserTxnFilters(filters) {
  safeStorageSet(USER_TXN_FILTER_KEY, JSON.stringify({ ...defaultUserTxnFilters(), ...filters }));
}

function readNotificationPage() {
  return Math.max(1, Number(safeStorageGet(USER_NOTIFICATIONS_PAGE_KEY, "1") || 1) || 1);
}

function writeNotificationPage(page) {
  safeStorageSet(USER_NOTIFICATIONS_PAGE_KEY, String(Math.max(1, Number(page) || 1)));
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

function transactionFilterChips(filters = {}, categories = []) {
  const categoryMap = new Map(categories.map((category) => [String(category.id), category.name]));
  const chips = [];
  if (filters.search) chips.push(`Search: ${filters.search}`);
  if (filters.type) chips.push(`Type: ${filters.type}`);
  if (filters.category_id) chips.push(`Category: ${categoryMap.get(String(filters.category_id)) || "Selected"}`);
  if (filters.start_date || filters.end_date) {
    chips.push(`Date: ${filters.start_date || "..."} to ${filters.end_date || "..."}`);
  }
  if (filters.archive_filter && filters.archive_filter !== "active") {
    chips.push(`Archive: ${filters.archive_filter}`);
  }
  if (filters.sort_by !== "date" || filters.sort_order !== "desc") {
    chips.push(`Sort: ${filters.sort_by} (${filters.sort_order})`);
  }

  if (!chips.length) return `<ul class="filter-chips"><li class="chip"><strong>Default view</strong></li></ul>`;

  return `<ul class="filter-chips">${chips.map((chip) => `<li class="chip"><strong>${escapeHtml(chip)}</strong></li>`).join("")}</ul>`;
}

function transactionPresetButtons(filters = {}) {
  const presets = [
    {
      key: "active",
      label: "Active",
      active: !filters.type && (filters.archive_filter || "active") === "active" && !filters.category_id && !filters.search,
      update: { type: "", archive_filter: "active", category_id: "", search: "", start_date: "", end_date: "" },
    },
    {
      key: "income",
      label: "Income",
      active: filters.type === "income",
      update: { type: "income", archive_filter: "active", category_id: "", search: "" },
    },
    {
      key: "expense",
      label: "Expense",
      active: filters.type === "expense",
      update: { type: "expense", archive_filter: "active", category_id: "", search: "" },
    },
    {
      key: "archived",
      label: "Archived",
      active: (filters.archive_filter || "active") === "archived",
      update: { archive_filter: "archived", type: "", category_id: "", search: "" },
    },
  ];

  return `
    <div class="filter-presets">
      ${presets
        .map((preset) =>
          button(preset.label, {
            variant: preset.active ? "primary" : "secondary",
            attrs: `data-action="apply-transaction-preset" data-preset="${preset.key}"`,
          }),
        )
        .join("")}
    </div>
  `;
}

function readUserReportRange() {
  const saved = String(safeStorageGet(USER_REPORT_RANGE_KEY, "all_time") || "all_time");
  return USER_REPORT_RANGE_LABELS[saved] ? saved : "all_time";
}

function writeUserReportRange(value) {
  if (USER_REPORT_RANGE_LABELS[value]) {
    safeStorageSet(USER_REPORT_RANGE_KEY, value);
  }
}

function reportRangeQuery(rangeKey) {
  const now = new Date();
  if (rangeKey === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { start_date: start.toISOString(), end_date: now.toISOString() };
  }

  if (rangeKey === "last_3_months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    return { start_date: start.toISOString(), end_date: now.toISOString() };
  }

  return {};
}

function buildTransactionCsvRows(transactions = [], categories = []) {
  const categoryMap = new Map(categories.map((category) => [String(category.id), category.name]));
  return transactions.map((txn) => [
    formatDateTime(txn.date),
    txn.description ?? "Transaction",
    txn.category_name ?? categoryMap.get(String(txn.category_id)) ?? "Uncategorized",
    txn.type ?? (Number(txn.amount) >= 0 ? "income" : "expense"),
    txn.is_deleted ? "deleted" : "active",
    Number(txn.amount) || 0,
  ]);
}

function buildReportCsvRows(summary = {}, formatAmount = formatINR) {
  const overview = summary.overview ?? {};
  const categories = normalizeCategorySeries(summary);
  const monthly = normalizeMonthlySeries(summary);
  const latest = monthly[monthly.length - 1]?.value ?? 0;
  const previous = monthly[monthly.length - 2]?.value ?? null;
  const delta = previous == null ? null : Number(latest) - Number(previous);
  return [
    ["Section", "Overview"],
    ["Balance", formatAmount(overview.balance ?? 0)],
    ["Income", formatAmount(overview.total_income ?? 0)],
    ["Expense", formatAmount(overview.total_expense ?? 0)],
    ["Latest movement", formatAmount(latest)],
    ["Movement change", delta == null ? "—" : formatAmount(delta)],
    ["Monthly entries", String((summary.monthly_summary ?? []).length)],
    ["Category entries", String(categories.length)],
    ["", ""],
    ["Section", "Category breakdown"],
    ...categories.map((item) => [item.label, formatAmount(item.value)]),
  ];
}

function buildReportPdfPayload(summary = {}, rangeKey = "all_time", formatAmount = formatINRExport) {
  const overview = summary.overview ?? {};
  const categories = normalizeCategorySeries(summary);
  const monthlyRows = monthlySnapshotRows(summary);
  const latestRow = monthlyRows[monthlyRows.length - 1] ?? { label: "—", income: 0, expense: 0, net: 0 };
  const prevRow = monthlyRows[monthlyRows.length - 2] ?? null;
  const topCategory = categories[0] ?? null;
  const totalExpense = Number(overview.total_expense ?? 0);
  const totalIncome = Number(overview.total_income ?? 0);
  const spendShare = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
  const trendDirection = latestRow.net >= 0 ? "Improving" : "Needs attention";
  const averageInflow = monthlyRows.length
    ? monthlyRows.reduce((sum, row) => sum + Number(row.income || 0), 0) / monthlyRows.length
    : 0;
  const averageOutflow = monthlyRows.length
    ? monthlyRows.reduce((sum, row) => sum + Number(row.expense || 0), 0) / monthlyRows.length
    : 0;

  const takeaways = [
    topCategory
      ? `${topCategory.label} is the biggest spending category at ${formatAmount(topCategory.value)} in this range.`
      : "No category expenses were recorded in this range.",
    `${latestRow.label} ended with a net result of ${formatAmount(latestRow.net)} after ${formatAmount(latestRow.expense)} in expenses.`,
    `Spending currently uses about ${spendShare}% of total inflow, which helps show how much room is left for saving.`,
    `Average monthly inflow is ${formatAmount(averageInflow)} while outflow is ${formatAmount(averageOutflow)}.`,
  ];

  return {
    title: "Finly Report",
    subtitle: "Personal Finance Report",
    rangeLabel: USER_REPORT_RANGE_LABELS[rangeKey] ?? "All time",
    generatedLabel: new Date().toLocaleString("en-IN"),
    metrics: [
      { label: "Net savings", value: formatAmount(overview.balance ?? 0) },
      { label: "Avg. inflow", value: formatAmount(averageInflow) },
      { label: "Avg. outflow", value: formatAmount(averageOutflow) },
      { label: "Spend ratio", value: `${spendShare}%` },
    ],
    executiveSummary: `You brought in ${formatAmount(totalIncome)} and spent ${formatAmount(totalExpense)} in this range. Overall momentum looks ${trendDirection.toLowerCase()}.`,
    takeaways,
    insights: [
      { label: "Top category", value: topCategory ? `${topCategory.label} (${formatAmount(topCategory.value)})` : "—" },
      { label: "Latest month", value: `${latestRow.label} (${formatAmount(latestRow.net)})` },
      { label: "Trend direction", value: trendDirection },
      { label: "Avg. inflow", value: formatAmount(averageInflow) },
      { label: "Avg. outflow", value: formatAmount(averageOutflow) },
    ],
    topCategories: categories.slice(0, 8).map((item) => ({
      label: item.label,
      value: formatAmount(item.value),
      share: totalExpense > 0 ? Math.max(0, Math.round((Number(item.value || 0) / totalExpense) * 100)) : 0,
      rawValue: Number(item.value || 0),
    })),
    monthlyRows: monthlyRows.slice(-8).map((row) => ({
      label: row.label,
      income: formatAmount(row.income),
      expense: formatAmount(row.expense),
      net: formatAmount(row.net),
      incomeRaw: Number(row.income || 0),
      expenseRaw: Number(row.expense || 0),
      netRaw: Number(row.net || 0),
    })),
  };
}

function joinBudgetRows(budgets = [], summaries = [], categories = []) {
  const summaryMap = new Map(
    summaries.map((item) => [String(item.budget_id ?? item.id ?? item.category_id), item]),
  );
  const categoryMap = new Map(categories.map((item) => [String(item.id), item.name]));
  return budgets.map((budget) => {
    const summary = summaryMap.get(String(budget.id ?? budget.category_id)) ?? {};
    const spent = Number(summary.spent ?? 0);
    const remaining = Number(summary.remaining ?? Number(budget.amount ?? 0) - spent);
    const percentageUsed =
      Number(summary.percentage_used ?? (budget.amount ? (spent / Number(budget.amount)) * 100 : 0)) || 0;
    const isOverBudget = Boolean(summary.is_over_budget ?? remaining < 0);
    return {
      ...budget,
      category_name: budget.category_name ?? categoryMap.get(String(budget.category_id)) ?? "Budget",
      spent,
      remaining,
      percentage_used: percentageUsed,
      is_over_budget: isOverBudget,
    };
  });
}

function renderRecentTransactions(transactions, categories = [], options = {}) {
  const selectable = Boolean(options.selectable);
  const includeHardDelete = Boolean(options.includeHardDelete);
  const categoryMap = new Map(categories.map((category) => [String(category.id), category.name]));
  const rows = transactions.map((txn) => {
    const amount = Number(txn.amount) || 0;
    const type = txn.type ?? (amount >= 0 ? "income" : "expense");
    const categoryLabel = txn.category_name ?? categoryMap.get(String(txn.category_id)) ?? "Uncategorized";
    const statusLabel = txn.is_deleted ? "archived" : "active";
    const searchType = txn.is_deleted ? "deleted" : type;
    return `
      <tr data-searchable="${escapeHtml(`${txn.description} ${categoryLabel} ${searchType}`.toLowerCase())}" data-type="${escapeHtml(String(type).toLowerCase())}" data-category="${escapeHtml(String(categoryLabel).toLowerCase())}" data-status="${escapeHtml(statusLabel)}" data-transaction-id="${txn.id}">
        ${
          selectable
            ? `<td><input class="table-check" type="checkbox" data-transaction-check data-id="${txn.id}" aria-label="Select transaction ${txn.id}" /></td>`
            : ""
        }
        <td>
          <strong>${escapeHtml(txn.description ?? "Untitled transaction")}</strong>
        </td>
        <td>${escapeHtml(categoryLabel)}</td>
        <td>${txn.is_deleted ? badge("Deleted", "red") : statusBadge(type)}</td>
        <td>${formatTableAmount(amount)}</td>
        <td>${formatTableDate(txn.date)}</td>
        <td>
          <div class="table-actions">
            ${rowAction("View", `data-action="view-transaction" data-id="${txn.id}"`)}
            ${
              txn.is_deleted
                ? `${rowAction("Restore", `data-action="restore-transaction" data-id="${txn.id}"`)}${includeHardDelete ? rowAction("Delete forever", `data-action="hard-delete-transaction" data-id="${txn.id}"`) : ""}`
                : `${rowAction("Edit", `data-action="edit-transaction" data-id="${txn.id}"`)}${rowAction("Archive", `data-action="delete-transaction" data-id="${txn.id}"`)}`
            }
          </div>
        </td>
      </tr>
    `;
  });

  return table({
    columns: [
      ...(selectable ? ["Select"] : []),
      "Transaction",
      "Category",
      "Type",
      "Amount",
      "Date",
      "Actions",
    ],
    rows,
    emptyLabel: "Add your first transaction to start seeing patterns.",
    emptyAction: options.emptyAction || "",
  });
}

function renderBudgetCards(budgets = [], options = {}) {
  const canDelete = options.canDelete !== false;
  if (!budgets.length) {
    return emptyState(
      "No budgets yet",
      options.emptyMessage || "Create a budget to track category-level spending.",
      options.emptyAction || button("Create Budget", { variant: "primary", attrs: 'data-action="open-create-budget"' }),
    );
  }
  return `
    <div class="budget-card-grid">
      ${budgets
        .map((budget) => {
          const spent = Number(budget.spent ?? 0);
          const amount = Number(budget.amount ?? 0);
          const percent = Number(budget.percentage_used ?? (amount ? (spent / amount) * 100 : 0)) || 0;
          const remaining = Number(budget.remaining ?? amount - spent);
          const normalizedPercent = Math.max(0, percent);
          let status = { label: "Comfortable", kind: "green" };
          if (remaining < 0 || normalizedPercent > 100) {
            status = { label: "Over Budget", kind: "red" };
          } else if (normalizedPercent >= 100) {
            status = { label: "At Limit", kind: "red" };
          } else if (normalizedPercent >= 75) {
            status = { label: "Approaching Limit", kind: "yellow" };
          } else if (normalizedPercent >= 50) {
            status = { label: "On Watch", kind: "yellow" };
          }
          return `
            <article class="panel budget-card">
              <div class="budget-card-header">
                <div class="budget-card-meta">
                  <div>
                    <span class="panel-title">${escapeHtml(budget.period ?? "Monthly")}</span>
                    <h3>${escapeHtml(budget.category_name ?? "Budget")}</h3>
                  </div>
                  ${badge(status.label, status.kind)}
                </div>
                <div class="budget-card-actions">
                  ${canDelete && budget.id != null ? button("Delete", { variant: "ghost", attrs: `data-action="delete-budget" data-id="${budget.id}" data-name="${escapeHtml(String(budget.category_name ?? "Budget"))}"` }) : ""}
                </div>
              </div>
              <div class="kpi-stack">
                ${progressRow({ label: "Spend progress", value: normalizedPercent, max: 100, note: `${Math.round(normalizedPercent)}% of ${formatINR(amount)}` })}
                <div class="budget-stat-grid">
                  <div class="budget-stat">
                    <span>Budgeted</span>
                    <strong>${formatINR(amount)}</strong>
                  </div>
                  <div class="budget-stat">
                    <span>Spent</span>
                    <strong>${formatINR(spent)}</strong>
                  </div>
                  <div class="budget-stat budget-stat-full">
                    <span>Remaining</span>
                    <strong>${formatINR(remaining)}</strong>
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderNotifications(items = [], emptyAction = "") {
  return cardList(
    items.map(
      (item) => `
        <article class="list-item">
          <div>
            ${badge(item.level ?? "neutral", item.level === "success" ? "green" : item.level === "warning" ? "yellow" : item.level === "error" ? "red" : "neutral")}
            <strong>${escapeHtml(item.action_label ?? item.action ?? "Activity")}</strong>
            <p>${escapeHtml(item.action_description ?? item.message ?? "")}</p>
          </div>
          <span class="muted">${escapeHtml(item.created_at ?? item.time ? timeAgo(item.created_at ?? item.time) : "")}</span>
        </article>
      `,
    ),
    "Notifications and activity will appear here as the backend responds.",
    emptyAction,
  );
}

function truncateText(value, max = 96) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function transactionForm(categories = [], defaults = {}) {
  const categoryOptions = categories.length
    ? categories.map((category) => ({ value: category.id, label: `${category.name} (${category.type})` }))
    : [{ value: "", label: "No categories available" }];
  const typeOptions = [
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
  ];
  return `
    <form class="form-card" data-form="transaction">
      <div class="form-grid">
        ${selectField({
          label: "Type",
          name: "type",
          value: defaults.type ?? "expense",
          options: typeOptions,
          required: true,
        })}
        ${selectField({
          label: "Category",
          name: "category_id",
          value: defaults.category_id ?? categories[0]?.id ?? "",
          options: categoryOptions,
          required: true,
        })}
        ${inputField({
          label: "Amount",
          name: "amount",
          type: "number",
          value: defaults.amount ?? "",
          placeholder: "0",
          required: true,
        })}
        ${inputField({
          label: "Date and time",
          name: "date",
          type: "datetime-local",
          value: formatDateTimeInput(defaults.date ?? new Date()),
          required: true,
        })}
      </div>
      ${inputField({
        label: "Description",
        name: "description",
        value: defaults.description ?? "",
        placeholder: "Coffee, salary, invoice payment...",
        required: true,
      })}
      <div class="toolbar">
        <button class="button button-primary" type="submit">${escapeHtml(defaults.id ? "Update transaction" : "Add transaction")}</button>
      </div>
    </form>
  `;
}

function budgetForm(categories = [], defaults = {}) {
  const categoryOptions = categories.length
    ? categories.map((category) => ({ value: category.id, label: category.name }))
    : [{ value: "", label: "No categories available" }];
  return `
    <form class="form-card" data-form="budget">
      <div class="form-grid">
        ${selectField({
          label: "Category",
          name: "category_id",
          value: defaults.category_id ?? categories[0]?.id ?? "",
          options: categoryOptions,
          required: true,
        })}
        ${selectField({
          label: "Period",
          name: "period",
          value: defaults.period ?? "monthly",
          options: [
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "custom", label: "Custom" },
          ],
          required: true,
        })}
        ${inputField({
          label: "Budget amount",
          name: "amount",
          type: "number",
          value: defaults.amount ?? "",
          required: true,
        })}
        ${inputField({
          label: "Start date",
          name: "start_date",
          type: "date",
          value: defaults.start_date ?? new Date().toISOString().slice(0, 10),
          required: true,
        })}
        ${inputField({
          label: "End date",
          name: "end_date",
          type: "date",
          value: defaults.end_date ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          required: true,
        })}
      </div>
      ${textareaField({
        label: "Notes",
        name: "description",
        value: defaults.description ?? "",
        placeholder: "What this budget should cover",
        rows: 4,
      })}
      <div class="toolbar">
        <button class="button button-primary" type="submit">${escapeHtml(defaults.id ? "Update budget" : "Create budget")}</button>
      </div>
    </form>
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
    const value = String(input.value || "");
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

    const result = validator(value, form) || { state: "", message: "" };
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

function attachTransactionFormValidation(form) {
  return bindLiveValidation(form, {
    amount: (value) => {
      if (!String(value || "").trim()) return { state: "error", message: "Enter amount in INR." };
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return { state: "error", message: "Amount must be greater than 0." };
      return { state: "ok", message: "Amount looks good." };
    },
    description: (value) => {
      const text = String(value || "").trim();
      if (!text) return { state: "error", message: "Enter a short description." };
      if (text.length < 2) return { state: "error", message: "Use at least 2 characters." };
      return { state: "ok", message: "Description looks good." };
    },
    date: (value) => {
      if (!String(value || "").trim()) return { state: "error", message: "Choose date and time." };
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return { state: "error", message: "Enter a valid date and time." };
      return { state: "ok", message: "Date and time are valid." };
    },
  });
}

function attachBudgetFormValidation(form) {
  return bindLiveValidation(form, {
    amount: (value) => {
      if (!String(value || "").trim()) return { state: "error", message: "Enter a budget amount." };
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) return { state: "error", message: "Budget amount must be greater than 0." };
      return { state: "ok", message: "Budget amount looks good." };
    },
    start_date: (value) => {
      if (!String(value || "").trim()) return { state: "error", message: "Choose a start date." };
      const start = new Date(value);
      if (Number.isNaN(start.getTime())) return { state: "error", message: "Enter a valid start date." };
      return { state: "ok", message: "Start date is valid." };
    },
    end_date: (value, formNode) => {
      if (!String(value || "").trim()) return { state: "error", message: "Choose an end date." };
      const end = new Date(value);
      const startRaw = String(formNode.querySelector('[name="start_date"]')?.value || "");
      const start = new Date(startRaw);
      if (Number.isNaN(end.getTime())) return { state: "error", message: "Enter a valid end date." };
      if (!Number.isNaN(start.getTime()) && end < start) return { state: "error", message: "End date must be on or after start date." };
      return { state: "ok", message: "End date is valid." };
    },
    description: (value) => {
      const text = String(value || "").trim();
      if (!text) return { state: "", message: "" };
      if (text.length < 3) return { state: "error", message: "Use at least 3 characters for notes." };
      return { state: "ok", message: "Notes look good." };
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

function buildTransactionPayload(formData) {
  const type = String(formData.get("type") || "expense");
  const categoryId = Number(formData.get("category_id"));
  const amountValue = Math.abs(Number(formData.get("amount")) || 0);
  const description = String(formData.get("description") || "").trim();
  const dateRaw = String(formData.get("date") || "");
  const date = new Date(dateRaw);

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Select a valid category." };
  }
  if (!amountValue) {
    return { ok: false, message: "Amount must be greater than zero." };
  }
  if (description.length < 2) {
    return { ok: false, message: "Description must be at least 2 characters." };
  }
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: "Choose a valid date and time." };
  }

  return {
    ok: true,
    payload: {
      category_id: categoryId,
      amount: type === "income" ? amountValue : -amountValue,
      description,
      date: date.toISOString(),
    },
  };
}

function buildBudgetPayload(formData) {
  const categoryId = Number(formData.get("category_id"));
  const amount = Number(formData.get("amount")) || 0;
  const period = String(formData.get("period") || "monthly");
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  const description = String(formData.get("description") || "").trim();
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return { ok: false, message: "Select a valid category." };
  }
  if (amount <= 0) {
    return { ok: false, message: "Budget amount must be greater than zero." };
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, message: "Choose valid start and end dates." };
  }
  if (end < start) {
    return { ok: false, message: "End date must be on or after start date." };
  }

  return {
    ok: true,
    payload: {
      category_id: categoryId,
      amount,
      period,
      start_date: startDate,
      end_date: endDate,
      description,
    },
  };
}

function profileForm(profile) {
  return `
    <div class="two-up">
      <form class="form-card panel" data-form="profile">
        <div class="panel-header">
          <div>
            <span class="panel-title">Account</span>
            <h3>Profile details</h3>
          </div>
        </div>
        <div class="form-grid">
          ${inputField({ label: "Name", name: "name", value: profile.name ?? "" })}
          ${inputField({ label: "Email", name: "email", type: "email", value: profile.email ?? "" })}
        </div>
        <div class="section-stack">
          ${profile.phone ? infoRow("Phone", profile.phone) : ""}
          ${profile.city ? infoRow("City", profile.city) : ""}
        </div>
        <div class="toolbar">
          <button class="button button-primary" type="submit">Update profile</button>
        </div>
      </form>

      <form class="form-card panel" data-form="password">
        <div class="panel-header">
          <div>
            <span class="panel-title">Security</span>
            <h3>Change password</h3>
          </div>
        </div>
        <div class="form-grid">
          ${inputField({ label: "Current password", name: "old_password", type: "password" })}
          ${inputField({ label: "New password", name: "new_password", type: "password" })}
        </div>
        <div class="toolbar">
          <button class="button button-secondary" type="submit">Update password</button>
          <button class="button button-danger" type="button" data-action="delete-account">Delete account</button>
        </div>
      </form>
    </div>
  `;
}

export const userWorkspace = {
  brand: "Finly",
  contextLabel: "Personal Workspace",
  nav: [
    { id: "dashboard", label: "Dashboard" },
    { id: "transactions", label: "Transactions" },
    { id: "reports", label: "Reports" },
    { id: "budgets", label: "Budgets" },
    { id: "notifications", label: "Notifications" },
    { id: "profile", label: "Profile" },
  ],
  pages: {
    dashboard: {
      title: "Dashboard",
      subtitle: "Your money, activity, and budgets in one place.",
      actions: (ctx) => `
        ${button("Add transaction", { variant: "primary", attrs: 'data-go="transactions"' })}
        ${button("Refresh", { variant: "secondary", attrs: 'data-action="refresh"' })}
      `,
      load: async (ctx) => {
        const [summary, transactions, budgets, budgetSummary, notifications] = await Promise.all([
          fetchOrFallback(ctx, "/summary/dashboard", buildFallbackSummary(), { query: { granularity: "month" } }),
          fetchOrFallback(ctx, "/transactions/recent", fallbackTransactions()),
          fetchOrFallback(ctx, "/budgets", []),
          fetchOrFallback(ctx, "/budgets/summary", []),
          fetchOrFallback(ctx, "/logs", buildFallbackNotifications()),
        ]);
        return {
          summary: summary?.data ?? summary ?? buildFallbackSummary(),
          transactions: normalizeList(transactions?.data ?? transactions ?? []),
          budgets: normalizeList(budgets?.data ?? budgets ?? []),
          budgetSummary: normalizeList(budgetSummary?.data ?? budgetSummary ?? []),
          notifications: normalizeList(notifications?.data ?? notifications ?? []),
        };
      },
      render: (data, ctx = {}) => {
        const summary = data.summary ?? buildFallbackSummary();
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const budgets = Array.isArray(data.budgets) ? data.budgets : [];
        const budgetSummary = Array.isArray(data.budgetSummary) ? data.budgetSummary : [];
        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        const cashflow = normalizeMonthlySeries(summary);
        const cashflowRows = monthlySnapshotRows(summary).slice(-6);
        const cashflowTrend = recentSeriesTrend(cashflow, "up");
        const cashflowExtrema = seriesExtrema(cashflow);
        const spendingSegments = normalizeCategorySeries(summary);
        const spendingTotal = totalCategoryValue(spendingSegments);
        const topCategory = spendingSegments[0];
        return `
          ${hero(
            `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, ${ctx?.me?.name ?? "there"}.`,
            `Today is ${formatLongDate(new Date())}.`,
            `
              <div class="hero-toolbar-stack">
                <label class="field field-search-wide">
                  <span class="sr-only">Search dashboard</span>
                  <input class="input" data-dashboard-search type="search" placeholder="Search transactions or categories" />
                </label>
                <div class="hero-action-group">
                  ${button("Transactions", { variant: "secondary", attrs: 'data-go="transactions"' })}
                  ${button("Budgets", { variant: "secondary", attrs: 'data-go="budgets"' })}
                </div>
              </div>
            `,
          )}
          ${renderKpis(summary)}
          <section class="analysis-grid">
            ${panel(
              "Cashflow",
              "Monthly trend",
              hasMeaningfulSeries(cashflow)
                ? `
                  <div class="chart-shell">
                    <div class="chart-header">
                      <span class="pill pill-accent">Updated ${timeAgo(summary.updated_at ?? new Date())}</span>
                      <span class="pill">${cashflowTrend.label ? escapeHtml(cashflowTrend.label) : `${cashflowTrend.kind === "down" ? "-" : "+"}${cashflowTrend.value}%`}</span>
                    </div>
                    <div class="chart-canvas">${lineChartSVG(cashflow, { stroke: "#7dd3fc" })}</div>
                    <div class="chart-legend">
                      ${cashflowExtrema.high ? `<span class="pill">Peak ${escapeHtml(cashflowExtrema.high.label)} ${escapeHtml(formatINR(cashflowExtrema.high.value))}</span>` : ""}
                      ${cashflowExtrema.low ? `<span class="pill">Low ${escapeHtml(cashflowExtrema.low.label)} ${escapeHtml(formatINR(cashflowExtrema.low.value))}</span>` : ""}
                    </div>
                    <ul class="filter-chips">
                      ${cashflowRows.map((row) => `<li class="chip"><strong>${escapeHtml(row.label)}</strong> In ${escapeHtml(formatINR(row.income))} · Out ${escapeHtml(formatINR(row.expense))}</li>`).join("")}
                    </ul>
                  </div>
                `
                : chartEmptyState({
                    title: "No cashflow history yet",
                    description: "Add your first income or expense to unlock the monthly trend and see how money moves over time.",
                    actionLabel: "Add Transaction",
                    actionTarget: "transactions",
                    icon: "↗",
                  }),
            )}
            ${panel(
              "Spending Mix",
              "Categories",
              hasMeaningfulCategories(spendingSegments)
                ? `
                  <div class="chart-shell">
                    <div class="chart-canvas" data-spending-chart>${donutChartSVG(spendingSegments, {
                      centerLabel: "",
                      centerValue: "",
                      valueFormatter: (value) => formatINR(value),
                      showLegend: true,
                    })}</div>
                    <div class="chart-legend" data-spending-legend>
                      ${topCategory ? `<span class="pill pill-accent">Top ${escapeHtml(topCategory.label)} ${escapeHtml(formatINR(topCategory.value))}</span>` : ""}
                      <span class="pill">Top 3 cover ${Math.round((spendingSegments.slice(0, 3).reduce((sum, item) => sum + Number(item.value || 0), 0) / Math.max(spendingTotal, 1)) * 100)}%</span>
                    </div>
                  </div>
                `
                : chartEmptyState({
                    title: "No category data yet",
                    description: "Once you log a few expenses, Finly will group them here so you can spot spending patterns fast.",
                    actionLabel: "Log Expense",
                    actionTarget: "transactions",
                    icon: "◔",
                  }),
            )}
          </section>
          <section class="two-up">
            ${panel(
              "Recent Transactions",
              "Latest activity",
              `
                <div class="toolbar toolbar-split">
                  <span class="pill">Showing ${transactions.length} items</span>
                  ${button("View all", { variant: "ghost", attrs: 'data-go="transactions"' })}
                </div>
                <div data-dashboard-recent>
                  ${cardList(
                    transactions.slice(0, 6).map(
                      (txn) => `
                        <article class="list-item" data-searchable="${escapeHtml(`${txn.description} ${txn.category_name ?? ""}`.toLowerCase())}">
                          <div>
                            ${statusBadge(txn.type ?? (Number(txn.amount) >= 0 ? "income" : "expense"))}
                            <strong>${escapeHtml(txn.description ?? "Transaction")}</strong>
                            <p>${escapeHtml(txn.category_name ?? "Uncategorized")} • ${escapeHtml(formatDate(txn.date))}</p>
                          </div>
                          <span class="trend ${Number(txn.amount) >= 0 ? "up" : "down"}">${formatINR(txn.amount)}</span>
                        </article>
                      `,
                    ),
                    "Your latest transactions will appear here.",
                    button("Add Transaction", { variant: "primary", attrs: 'data-go="transactions"' }),
                  )}
                </div>
              `,
            )}
            ${panel(
              "Budget Health",
              "At a glance",
              `
                <div class="section-stack">
                  ${renderBudgetCards(joinBudgetRows(budgets, budgetSummary), {
                    canDelete: false,
                    emptyAction: button("Create Budget", { variant: "primary", attrs: 'data-go="budgets"' }),
                  })}
                </div>
              `,
            )}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Alerts</span>
                <h3>Recent notifications</h3>
              </div>
              ${button("Notifications", { variant: "ghost", attrs: 'data-go="notifications"' })}
            </div>
            ${renderNotifications(notifications.slice(0, 3))}
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const search = root.querySelector("[data-dashboard-search]");
        const rows = [...root.querySelectorAll("[data-searchable]")];
        search?.addEventListener("input", () => {
          const query = search.value.trim().toLowerCase();
          rows.forEach((row) => {
            const searchable = row.getAttribute("data-searchable") || "";
            row.style.display = searchable.includes(query) ? "" : "none";
          });
        });

      },
    },
    transactions: {
      title: "Transactions",
      subtitle: "Track, filter, and manage every transaction in one table.",
      help: "Use filters to narrow scope, then archive, restore, or permanently delete selected transactions.",
      actions: () => "",
      load: async (ctx) => {
        const filters = readUserTxnFilters();
        const offset = (filters.page - 1) * filters.limit;

        let transactionPayload;
        try {
          transactionPayload = await ctx.api("/transactions", {
            query: {
              search: filters.search,
              type: filters.type,
              category_id: filters.category_id,
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
          transactionPayload = {
            data: fallbackTransactions(),
            meta: { total: fallbackTransactions().length, limit: filters.limit, offset, page: filters.page, total_pages: 1, has_next: false, has_prev: false },
          };
        }

        const categories = await fetchOrFallback(ctx, "/categories", fallbackCategories());

        return {
          transactions: normalizeList(transactionPayload?.data ?? transactionPayload ?? []),
          categories: normalizeList(categories?.data ?? categories ?? []),
          filters,
          meta: normalizeDetail(transactionPayload?.meta ?? {}),
        };
      },
      render: (data) => {
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const filters = data.filters ?? defaultUserTxnFilters();
        const meta = data.meta ?? {};
        return `
          ${hero(
            "Transactions workspace",
            "Capture income and expenses quickly, then review or restore rows without leaving this page.",
            `
              ${button("Quick add", { variant: "primary", attrs: 'data-action="open-create-transaction"' })}
            `,
          )}
          ${panel(
            "Filters",
            "Refine the list",
            `
              <div class="filter-shell">
                ${transactionPresetButtons(filters)}
                <div class="filter-row">
                  <label class="field">
                    <span>Search</span>
                    <input class="input" data-transaction-search type="search" placeholder="Search by description, category, or type" value="${escapeHtml(filters.search || "")}" />
                  </label>
                  ${selectField({
                    label: "Type",
                    name: "filter_type",
                    value: String(filters.type || ""),
                    options: [
                      { value: "", label: "All types" },
                      { value: "income", label: "Income" },
                      { value: "expense", label: "Expense" },
                    ],
                  })}
                    ${selectField({
                      label: "Category",
                      name: "filter_category_id",
                      value: String(filters.category_id || ""),
                      options: [{ value: "", label: "All categories" }, ...categories.map((category) => ({ value: category.id, label: category.name }))],
                    })}
                  ${button("Apply", { variant: "primary", attrs: 'data-action="apply-transaction-filters"' })}
                </div>
                <details class="filter-advanced">
                  <summary>Advanced filters <span class="muted">Dates, archive, and ordering</span></summary>
                  <div class="filter-advanced-grid">
                    ${selectField({
                      label: "Archive filter",
                      name: "filter_archive",
                      value: String(filters.archive_filter || "active"),
                      options: [
                        { value: "active", label: "Active only" },
                        { value: "archived", label: "Archived only" },
                        { value: "all", label: "Active + archived" },
                      ],
                    })}
                    ${inputField({
                      label: "Start date",
                      name: "filter_start_date",
                      type: "date",
                      value: filters.start_date || "",
                    })}
                    ${inputField({
                      label: "End date",
                      name: "filter_end_date",
                      type: "date",
                      value: filters.end_date || "",
                    })}
                    ${selectField({
                      label: "Sort by",
                      name: "filter_sort_by",
                      value: String(filters.sort_by || "date"),
                      options: [
                        { value: "date", label: "Date" },
                        { value: "amount", label: "Amount" },
                        { value: "description", label: "Description" },
                      ],
                    })}
                    ${selectField({
                      label: "Sort order",
                      name: "filter_sort_order",
                      value: String(filters.sort_order || "desc"),
                      options: [
                        { value: "desc", label: "Newest first" },
                        { value: "asc", label: "Oldest first" },
                      ],
                    })}
                    ${selectField({
                      label: "Rows per page",
                      name: "filter_limit",
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
                      ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-transaction-filters"' })}
                    </div>
                  </div>
                </details>
                <div class="filter-summary">
                  ${transactionFilterChips(filters, categories)}
                </div>
              </div>
            `,
          )}
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">All transactions</span>
                <h3>Audit-ready ledger</h3>
              </div>
              <div class="toolbar">
                <span class="pill">${meta.total ?? transactions.length} total</span>
                ${button("Download CSV", { variant: "ghost", attrs: 'data-action="export-transactions"' })}
              </div>
            </div>
            <div class="section-stack">
              <div class="bulk-toolbar">
                <div class="toolbar">
                  ${button("Select page", { variant: "secondary", attrs: 'data-action="select-page-transactions"' })}
                  ${button("Clear", { variant: "ghost", attrs: 'data-action="clear-page-transactions"' })}
                </div>
                <div class="toolbar">
                  ${button("Archive selected", { variant: "secondary", attrs: 'data-action="bulk-archive-transactions"' })}
                  ${button("Restore selected", { variant: "secondary", attrs: 'data-action="bulk-restore-transactions"' })}
                  ${button("Delete selected", { variant: "danger", attrs: 'data-action="bulk-hard-delete-transactions"' })}
                </div>
              </div>
              ${renderRecentTransactions(transactions, categories, {
                selectable: true,
                includeHardDelete: true,
              })}
              ${renderPagination(meta, "txn-page")}
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const transactions = Array.isArray(data.transactions) ? data.transactions : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const filters = data.filters ?? defaultUserTxnFilters();
        const meta = data.meta ?? {};
        const search = root.querySelector("[data-transaction-search]");
        const typeFilter = root.querySelector('select[name="filter_type"]');
        const categoryFilter = root.querySelector('select[name="filter_category_id"]');
        const archiveFilter = root.querySelector('select[name="filter_archive"]');
        const startDateFilter = root.querySelector('input[name="filter_start_date"]');
        const endDateFilter = root.querySelector('input[name="filter_end_date"]');
        const sortByFilter = root.querySelector('select[name="filter_sort_by"]');
        const sortOrderFilter = root.querySelector('select[name="filter_sort_order"]');
        const limitFilter = root.querySelector('select[name="filter_limit"]');

        const applyFilterState = (nextPage = 1) => {
          writeUserTxnFilters({
            ...filters,
            page: nextPage,
            search: (search?.value || "").trim(),
            type: typeFilter?.value || "",
            category_id: categoryFilter?.value || "",
            archive_filter: archiveFilter?.value || "active",
            start_date: startDateFilter?.value || "",
            end_date: endDateFilter?.value || "",
            sort_by: sortByFilter?.value || "date",
            sort_order: sortOrderFilter?.value || "desc",
            limit: Number(limitFilter?.value || 12) || 12,
          });
          ctx.reload();
        };

        root.querySelector('[data-action="apply-transaction-filters"]')?.addEventListener("click", () => applyFilterState(1));
        root.querySelector('[data-action="reset-transaction-filters"]')?.addEventListener("click", () => {
          writeUserTxnFilters(defaultUserTxnFilters());
          ctx.reload();
        });
        search?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyFilterState(1);
          }
        });

        root.querySelectorAll('[data-action="apply-transaction-preset"]').forEach((button) => {
          button.addEventListener("click", () => {
            const preset = button.getAttribute("data-preset");
            const next = defaultUserTxnFilters();
            if (preset === "income") {
              Object.assign(next, { type: "income" });
            } else if (preset === "expense") {
              Object.assign(next, { type: "expense" });
            } else if (preset === "archived") {
              Object.assign(next, { archive_filter: "archived" });
            }
            writeUserTxnFilters(next);
            ctx.reload();
          });
        });

        root.querySelector('[data-action="txn-page-prev"]')?.addEventListener("click", () => {
          applyFilterState(Math.max(1, Number(filters.page || 1) - 1));
        });
        root.querySelector('[data-action="txn-page-next"]')?.addEventListener("click", () => {
          applyFilterState(Math.min(Number(meta.total_pages || 1) || 1, Number(filters.page || 1) + 1));
        });

        const checkedIds = () => [...root.querySelectorAll("[data-transaction-check]:checked")].map((el) => el.getAttribute("data-id")).filter(Boolean);

        root.querySelector('[data-action="select-page-transactions"]')?.addEventListener("click", () => {
          root.querySelectorAll("[data-transaction-check]").forEach((node) => { node.checked = true; });
        });

        root.querySelector('[data-action="clear-page-transactions"]')?.addEventListener("click", () => {
          root.querySelectorAll("[data-transaction-check]").forEach((node) => { node.checked = false; });
        });

        root.querySelector('[data-action="bulk-archive-transactions"]')?.addEventListener("click", async () => {
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

        root.querySelector('[data-action="bulk-restore-transactions"]')?.addEventListener("click", async () => {
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

        root.querySelector('[data-action="bulk-hard-delete-transactions"]')?.addEventListener("click", async () => {
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

        root.querySelectorAll("[data-action='edit-transaction']").forEach((button) => {
          button.addEventListener("click", () => {
            const txn = transactions.find((item) => String(item.id) === button.getAttribute("data-id"));
            if (!txn) return;
            ctx.openModal({
              title: "Edit Transaction",
              note: `Transaction #${txn.id ?? "—"}`,
              content: transactionForm(categories, {
                ...txn,
                type: Number(txn.amount) >= 0 ? "income" : "expense",
                amount: Math.abs(Number(txn.amount) || 0),
                date: formatDateTimeInput(txn.date),
              }),
            });
            const modalRoot = document.getElementById("modal-root");
            const modalForm = modalRoot?.querySelector('[data-form="transaction"]');
            const validateTransactionForm = attachTransactionFormValidation(modalForm);
            modalForm?.addEventListener("submit", async (event) => {
              event.preventDefault();
              const validationError = validateTransactionForm();
              if (validationError) {
                ctx.toast("Invalid transaction", validationError, "warning");
                return;
              }
              const formData = new FormData(modalForm);
              const parsed = buildTransactionPayload(formData);
              if (!parsed.ok) {
                ctx.toast("Invalid transaction", parsed.message, "warning");
                return;
              }
              try {
                await ctx.api(`/transactions/${txn.id}`, { method: "PUT", body: parsed.payload });
                ctx.closeModal();
                ctx.toast("Transaction updated", "Changes were saved successfully.", "success");
                ctx.reload();
              } catch (error) {
                ctx.toast("Update failed", error.message, "danger");
              }
            });
          });
        });

        root.querySelectorAll("[data-action='view-transaction']").forEach((button) => {
          button.addEventListener("click", () => {
            const txn = transactions.find((item) => String(item.id) === button.getAttribute("data-id"));
            if (!txn) return;
            const amount = Number(txn.amount) || 0;
            const type = txn.type ?? (amount >= 0 ? "income" : "expense");
            ctx.openModal({
              title: "Transaction Details",
              note: `Transaction #${txn.id ?? "—"}`,
              content: `
                <div class="section-stack">
                  ${infoRow("ID", String(txn.id ?? "—"))}
                  ${infoRow("Description", txn.description ?? "—")}
                  ${infoRow("Category", txn.category_name ?? "Uncategorized")}
                  ${infoRow("Type", type)}
                  ${infoRow("Status", txn.is_deleted ? "archived" : "active")}
                  ${infoRow("Amount", formatINR(amount))}
                  ${infoRow("Date", formatDateTime(txn.date))}
                </div>
              `,
            });
          });
        });

        root.querySelectorAll("[data-action='delete-transaction']").forEach((button) => {
          button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
            if (!window.confirm("Archive this transaction? You can restore it later.")) return;
            try {
              await ctx.api(`/transactions/${id}`, { method: "DELETE", query: { mode: "soft" } });
              ctx.toast("Transaction archived", "The row was moved to the archive.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Delete failed", error.message, "danger");
            }
          });
        });

        root.querySelectorAll("[data-action='restore-transaction']").forEach((button) => {
          button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
            try {
              await ctx.api(`/transactions/${id}/restore`, { method: "PUT" });
              ctx.toast("Transaction restored", "The row is active again.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Restore failed", error.message, "danger");
            }
          });
        });

        root.querySelectorAll("[data-action='hard-delete-transaction']").forEach((button) => {
          button.addEventListener("click", async () => {
            const id = button.getAttribute("data-id");
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

        root.querySelector("[data-action='export-transactions']")?.addEventListener("click", () => {
          downloadCsv(
            `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Date", "Description", "Category", "Type", "Status", "Amount"],
            buildTransactionCsvRows(transactions, categories),
          );
          ctx.toast("CSV downloaded", "Transactions export has started.", "success");
        });

        root.querySelector("[data-action='open-create-transaction']")?.addEventListener("click", () => {
          if (!categories.length) {
            ctx.toast("No categories", "Create at least one category before adding a transaction.", "warning");
            return;
          }
          ctx.openModal({
            title: "Add Transaction",
            note: "Capture income or expense",
            content: transactionForm(categories),
          });
          const modalRoot = document.getElementById("modal-root");
          const modalForm = modalRoot?.querySelector('[data-form="transaction"]');
          const validateTransactionForm = attachTransactionFormValidation(modalForm);
          modalForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const validationError = validateTransactionForm();
            if (validationError) {
              ctx.toast("Invalid transaction", validationError, "warning");
              return;
            }
            const formData = new FormData(modalForm);
            const parsed = buildTransactionPayload(formData);
            if (!parsed.ok) {
              ctx.toast("Invalid transaction", parsed.message, "warning");
              return;
            }
            try {
              await ctx.api("/transactions", { method: "POST", body: parsed.payload });
              ctx.closeModal();
              ctx.toast("Transaction created", "Saved to your ledger.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Could not save", error.message, "danger");
            }
          });
        });
      },
    },
    reports: {
      title: "Reports",
      subtitle: "Review trends, category mix, and export-ready summaries.",
      help: "Choose a time range and trend view, then export the report to CSV or PDF.",
      actions: () => `${button("Export PDF", { variant: "primary", attrs: 'data-action="export-report"' })}`,
      load: async (ctx) => {
        const rangeKey = readUserReportRange();
        const trendMode = readUserReportTrendMode();
        const summary = await fetchOrFallback(ctx, "/summary/dashboard", buildFallbackSummary(), {
          query: {
            granularity: "month",
            ...reportRangeQuery(rangeKey),
          },
        });
        return { summary: summary?.data ?? summary, rangeKey, trendMode };
      },
      render: (data) => {
        const summary = data.summary ?? buildFallbackSummary();
        const rangeKey = data.rangeKey ?? "all_time";
        const trendMode = data.trendMode ?? readUserReportTrendMode();
        const overview = summary.overview ?? {};
        const categorySeries = normalizeCategorySeries(summary);
        const categoryTotalRaw = totalCategoryValue(categorySeries);
        const categoryTotal = Math.max(categoryTotalRaw, Number(overview.total_expense ?? 0), 1);
        const monthlyRows = monthlySnapshotRows(summary);
        const trend = buildReportTrendSeries(monthlyRows, trendMode);
        const hasTrendData = hasMeaningfulSeries(trend);
        const hasCategoryData = hasMeaningfulCategories(categorySeries);
        const trendDelta = recentSeriesTrend(trend, trendMode === "expense" ? "down" : "up");
        const incomeTrend = monthlyTypeTrend(summary, "income", "up");
        const expenseTrend = monthlyTypeTrend(summary, "expense", "down");
        const topCategory = categorySeries[0] ?? null;
        const top3Coverage = categoryTotal
          ? Math.round((categorySeries.slice(0, 3).reduce((sum, item) => sum + Number(item.value || 0), 0) / categoryTotal) * 100)
          : 0;
        const extrema = seriesExtrema(trend);
        return `
          ${hero(
            "Reporting center",
            "Use a date range, review trends, and export what you need.",
            `
              <div class="hero-toolbar-stack">
                <div class="hero-action-group hero-action-group-range">
                  ${button("This month", { variant: rangeKey === "this_month" ? "primary" : "secondary", attrs: 'data-action="set-report-range" data-range="this_month"' })}
                  ${button("Last 3 months", { variant: rangeKey === "last_3_months" ? "primary" : "secondary", attrs: 'data-action="set-report-range" data-range="last_3_months"' })}
                  ${button("All time", { variant: rangeKey === "all_time" ? "primary" : "secondary", attrs: 'data-action="set-report-range" data-range="all_time"' })}
                </div>
                <div class="hero-action-group hero-action-group-export">
                  ${button("Download CSV", { variant: "ghost", attrs: 'data-action="export-report-csv"' })}
                  ${button("Download PDF", { variant: "ghost", attrs: 'data-action="export-report-pdf"' })}
                </div>
              </div>
            `,
          )}
          <section class="toolbar">
            ${badge(`Range: ${USER_REPORT_RANGE_LABELS[rangeKey] ?? USER_REPORT_RANGE_LABELS.all_time}`, "accent")}
          </section>
          <section class="cards-grid">
            ${metricCard({ label: "Net Position", value: formatINR(overview.balance ?? 0), trend: hasTrendData ? trendDelta : { label: "Waiting", kind: "up" }, hint: hasTrendData ? "Income less expense" : "Add transactions to generate reporting insights", icon: "≈" })}
            ${metricCard({ label: "Inflow", value: formatINR(overview.total_income ?? 0), trend: hasTrendData ? incomeTrend : { label: "Waiting", kind: "up" }, hint: hasTrendData ? "Total credits" : "Credits will appear once income is recorded", icon: "↑" })}
            ${metricCard({ label: "Outflow", value: formatINR(overview.total_expense ?? 0), trend: hasTrendData ? expenseTrend : { label: "Waiting", kind: "down" }, hint: hasTrendData ? "Total debits" : "Debits will appear once expenses are recorded", icon: "↓" })}
          </section>
          <section class="analysis-grid">
            ${panel(
              "Growth trend",
              trendMode === "income"
                ? "Monthly inflow across the selected range"
                : trendMode === "expense"
                  ? "Monthly outflow across the selected range"
                  : "Rolling movement across the selected range",
              hasTrendData
                ? `<div class="chart-shell"><div class="chart-canvas">${lineChartSVG(trend, { stroke: "#34d399" })}</div><div class="chart-legend"><span class="pill">${escapeHtml(USER_REPORT_TREND_LABELS[trendMode] || "Net")} trend</span>${extrema.high ? `<span class="pill">Peak ${escapeHtml(extrema.high.label)} ${escapeHtml(formatINR(extrema.high.value))}</span>` : ""}${extrema.low ? `<span class="pill">Low ${escapeHtml(extrema.low.label)} ${escapeHtml(formatINR(extrema.low.value))}</span>` : ""}</div></div>`
                : chartEmptyState({
                    title: "No reporting trend yet",
                    description: "Once transactions are recorded, Finly will plot monthly movement here for the selected range.",
                    actionLabel: "Add Transaction",
                    actionTarget: "transactions",
                    icon: "↗",
                  }),
              `
                ${button("Net", { variant: trendMode === "net" ? "primary" : "secondary", attrs: 'data-action="set-report-trend-mode" data-mode="net"' })}
                ${button("Inflow", { variant: trendMode === "income" ? "primary" : "secondary", attrs: 'data-action="set-report-trend-mode" data-mode="income"' })}
                ${button("Outflow", { variant: trendMode === "expense" ? "primary" : "secondary", attrs: 'data-action="set-report-trend-mode" data-mode="expense"' })}
              `,
            )}
            ${panel(
              "Spending mix",
              "By category share",
              hasCategoryData
                ? `<div class="chart-shell"><div class="chart-canvas">${donutChartSVG(categorySeries, {
                    centerLabel: "",
                    centerValue: "",
                    valueFormatter: (value) => formatINR(value),
                    showLegend: true,
                  })}</div><div class="chart-legend">${topCategory ? `<span class="pill pill-accent">Top ${escapeHtml(topCategory.label)} ${escapeHtml(formatINR(topCategory.value))}</span>` : ""}<span class="pill">Top 3 cover ${top3Coverage}%</span></div></div>`
                : chartEmptyState({
                    title: "No spending mix yet",
                    description: "Category share becomes useful once multiple expenses have been captured in the selected range.",
                    actionLabel: "Log Expense",
                    actionTarget: "transactions",
                    icon: "◔",
                  }),
            )}
          </section>
          <section class="two-up">
            ${panel(
              "Category mix",
              "Ranked breakdown",
              `
                 ${hasCategoryData ? `<div class="list">
                   ${categorySeries
                     .slice(0, 6)
                    .map(
                      (item) => `
                        <article class="list-item">
                          <div>
                            <strong>${escapeHtml(item.label)}</strong>
                            <p>${escapeHtml(formatINR(item.value))}</p>
                          </div>
                          ${badge(`${Math.max(0, Math.round((Number(item.value) || 0) / categoryTotal * 100))}%`, "accent")}
                        </article>
                      `,
                    )
                    .join("")}
                 </div>` : emptyState("No category ranking yet", "Your top categories will appear here once reportable spending exists.", button("Log Expense", { variant: "primary", attrs: 'data-go="transactions"' }), "◔")}
               `,
            )}
            ${panel(
              "Highlights",
              "Range summary",
              `
                ${cardList([
                  topCategory ? `Top category: ${topCategory.label} (${formatINR(topCategory.value)})` : "Top category: —",
                  extrema.high ? `Peak month: ${extrema.high.label} (${formatINR(extrema.high.value)})` : "Peak month: —",
                  extrema.low ? `Lowest month: ${extrema.low.label} (${formatINR(extrema.low.value)})` : "Lowest month: —",
                ].map((item) => `
                  <article class="list-item">
                    <div>
                      ${statusBadge("info")}
                      <strong>${escapeHtml(item)}</strong>
                    </div>
                  </article>
                `))}
              `,
            )}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Monthly snapshot</span>
                <h3>Inflow, outflow, and net by period</h3>
              </div>
            </div>
            ${table({
              columns: ["Period", "Inflow", "Outflow", "Net"],
              rows: monthlyRows.map((row) => `
                <tr>
                  <td>${escapeHtml(row.label)}</td>
                  <td>${escapeHtml(formatINR(row.income))}</td>
                  <td>${escapeHtml(formatINR(row.expense))}</td>
                  <td>${row.net >= 0 ? `<span class="trend up">${escapeHtml(formatINR(row.net))}</span>` : `<span class="trend down">${escapeHtml(formatINR(row.net))}</span>`}</td>
                </tr>
              `),
              emptyLabel: "No monthly snapshot is available for this range.",
            })}
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const summary = data.summary ?? buildFallbackSummary();
        const rangeKey = data.rangeKey ?? "all_time";
        const trendMode = data.trendMode ?? readUserReportTrendMode();

        root.querySelectorAll("[data-action='set-report-range']").forEach((buttonEl) => {
          buttonEl.addEventListener("click", () => {
            const nextRange = buttonEl.getAttribute("data-range") || "all_time";
            const current = readUserReportRange();
            if (nextRange === current) return;
            writeUserReportRange(nextRange);
            ctx.toast("Report range updated", `Showing ${USER_REPORT_RANGE_LABELS[nextRange] ?? "selected range"}.`, "success");
            ctx.reload();
          });
        });

        root.querySelectorAll("[data-action='set-report-trend-mode']").forEach((buttonEl) => {
          buttonEl.addEventListener("click", () => {
            const next = buttonEl.getAttribute("data-mode") || "net";
            if (next === trendMode) return;
            writeUserReportTrendMode(next);
            ctx.reload();
          });
        });

        root.querySelector("[data-action='export-report-csv']")?.addEventListener("click", () => {
          downloadCsv(
            `report-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Metric", "Value"],
            buildReportCsvRows(summary, formatINRExport),
          );
          ctx.toast("CSV downloaded", "Report export has started.", "success");
        });

        root.querySelector("[data-action='export-report-pdf']")?.addEventListener("click", () => {
          downloadFinancialReportPdf(
            `report-${new Date().toISOString().slice(0, 10)}.pdf`,
            buildReportPdfPayload(summary, rangeKey, formatINRExport),
          );
          ctx.toast("PDF downloaded", "Report export has started.", "success");
        });
      },
    },
    budgets: {
      title: "Budgets",
      subtitle: "Plan spending by category and monitor progress early.",
      actions: () => "",
      load: async (ctx) => {
        const [budgets, categories, summary] = await Promise.all([
          fetchOrFallback(ctx, "/budgets", []),
          fetchOrFallback(ctx, "/categories", fallbackCategories()),
          fetchOrFallback(ctx, "/budgets/summary", []),
        ]);
        return {
          budgets: normalizeList(budgets?.data ?? budgets ?? []),
          categories: normalizeList(categories?.data ?? categories ?? []),
          budgetSummary: normalizeList(summary?.data ?? summary ?? []),
        };
      },
      render: (data) => {
        const budgets = Array.isArray(data.budgets) ? data.budgets : [];
        const budgetSummary = Array.isArray(data.budgetSummary) ? data.budgetSummary : [];
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const canCreateBudget = categories.length > 0;
        const budgetRows = joinBudgetRows(budgets, budgetSummary, categories);
        const totalBudgeted = budgetRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalSpent = budgetRows.reduce((sum, item) => sum + Number(item.spent || 0), 0);
        const totalRemaining = Math.max(totalBudgeted - totalSpent, 0);
        return `
          ${hero(
            "Budget planner",
            "Create budgets, track progress, and spot overspend quickly.",
            canCreateBudget
              ? `${button("Create budget", { variant: "primary", attrs: 'data-action="open-create-budget"' })}`
              : `${button("Create budget", { variant: "secondary", attrs: 'disabled aria-disabled="true" title="No categories available"' })}`,
          )}
          <section class="cards-grid">
            ${metricCard({ label: "Total budgeted", value: formatINR(totalBudgeted), trend: budgets.length ? { label: "Planned", kind: "up" } : { label: "Create one", kind: "up" }, hint: budgets.length ? "All active plans" : "Set a first target to start planning", icon: "↦" })}
            ${metricCard({ label: "Spent", value: formatINR(totalSpent), trend: budgets.length ? { label: "Tracked", kind: "down" } : { label: "Waiting", kind: "down" }, hint: budgets.length ? "Drawn from actuals" : "Spending will sync after activity starts", icon: "↧" })}
            ${metricCard({ label: "Remaining", value: formatINR(totalRemaining), trend: budgets.length ? { label: "Available", kind: "up" } : { label: "Waiting", kind: "up" }, hint: budgets.length ? "Still available" : "Remaining budget appears after setup", icon: "↺" })}
            ${metricCard({ label: "Active plans", value: String(budgets.length), trend: budgets.length ? { label: "Tracked", kind: "up" } : { label: "None yet", kind: "up" }, hint: "Tracked categories", icon: "◌" })}
          </section>
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Budget breakdown</span>
                <h3>Progress and status by category</h3>
              </div>
            </div>
            ${renderBudgetCards(budgetRows, {
              emptyMessage: canCreateBudget
                ? "Create a budget to track category-level spending."
                : "No categories are available. Ask an admin to create categories first.",
              emptyAction: canCreateBudget
                ? button("Create Budget", { variant: "primary", attrs: 'data-action="open-create-budget"' })
                : button("No categories available", { variant: "secondary", attrs: 'disabled aria-disabled="true" title="Ask an admin to create categories"' }),
            })}
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const categories = Array.isArray(data.categories) ? data.categories : [];
        const openCreateBudget = () => {
          if (!categories.length) {
            ctx.toast("No categories", "Create at least one category before creating a budget.", "warning");
            return;
          }
          ctx.openModal({
            title: "Create Budget",
            note: "Set a target and date range",
            content: budgetForm(categories),
          });
          const modalRoot = document.getElementById("modal-root");
          const modalForm = modalRoot?.querySelector('[data-form="budget"]');
          const validateBudgetForm = attachBudgetFormValidation(modalForm);
          modalForm?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const validationError = validateBudgetForm();
            if (validationError) {
              ctx.toast("Invalid budget", validationError, "warning");
              return;
            }
            const formData = new FormData(modalForm);
            const parsed = buildBudgetPayload(formData);
            if (!parsed.ok) {
              ctx.toast("Invalid budget", parsed.message, "warning");
              return;
            }
            try {
              await ctx.api("/budgets", { method: "POST", body: parsed.payload });
              ctx.closeModal();
              ctx.toast("Budget created", "The new plan is live.", "success");
              ctx.reload();
            } catch (error) {
              ctx.toast("Could not save", error.message, "danger");
            }
          });
        };

        root.querySelectorAll("[data-action='open-create-budget']").forEach((buttonEl) => {
          buttonEl.addEventListener("click", openCreateBudget);
        });

        root.querySelectorAll("[data-action='delete-budget']").forEach((buttonEl) => {
          buttonEl.addEventListener("click", () => {
            const id = buttonEl.getAttribute("data-id");
            const name = buttonEl.getAttribute("data-name") || "Budget";
            if (!id) return;

            ctx.openModal({
              title: "Delete Budget",
              note: "This action is permanent",
              content: `
                <div class="section-stack">
                  ${infoRow("Name", String(name))}
                  ${infoRow("ID", String(id))}
                  <div class="toolbar">
                    ${button("Delete budget", { variant: "danger", attrs: `data-action="confirm-delete-budget" data-id="${id}"` })}
                    ${button("Cancel", { variant: "secondary", attrs: 'data-action="close-modal"' })}
                  </div>
                </div>
              `,
            });

            document.getElementById("modal-root")?.querySelector("[data-action='confirm-delete-budget']")?.addEventListener("click", async () => {
              try {
                await ctx.api(`/budgets/${id}`, { method: "DELETE" });
                ctx.closeModal();
                ctx.toast("Budget deleted", "The budget has been removed.", "success");
                ctx.reload();
              } catch (error) {
                ctx.toast("Delete failed", error.message, "danger");
              }
            });
          });
        });
      },
    },
    notifications: {
      title: "Notifications",
      subtitle: "Review account activity and alerts in one feed.",
      help: "Use this feed to review account, transaction, and budget events in chronological order.",
      actions: () => "",
      load: async (ctx) => {
        const page = readNotificationPage();
        const limit = 8;
        const offset = (page - 1) * limit;
        let payload;
        try {
          payload = await ctx.api("/logs", { query: { limit, offset } });
        } catch (error) {
          if (!isDemoMode()) throw error;
          const fallback = buildFallbackNotifications();
          payload = {
            data: fallback.slice(offset, offset + limit),
            meta: {
              total: fallback.length,
              limit,
              offset,
              page,
              total_pages: Math.max(1, Math.ceil(fallback.length / limit)),
              has_next: offset + limit < fallback.length,
              has_prev: page > 1,
            },
          };
        }
        return {
          notifications: normalizeList(payload?.data ?? payload ?? []),
          meta: normalizeDetail(payload?.meta ?? {}),
        };
      },
      render: (data) => {
        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        const meta = data.meta ?? { total: notifications.length, page: 1, total_pages: 1, has_next: false, has_prev: false, limit: notifications.length, offset: 0 };
        const hidden = new Set(readHiddenNotificationKeys());
        const visibleNotifications = notifications.filter((item, index) => !hidden.has(notificationItemKey(item, index)));
        const hiddenCount = Math.max(0, notifications.length - visibleNotifications.length);
        return `
          ${hero("Notifications", "Recent activity and alerts from your account.") }
          <section class="panel">
            <div class="panel-header">
              <div>
                <span class="panel-title">Activity feed</span>
                <h3>Event timeline</h3>
              </div>
              <div class="toolbar">
                ${badge(`${visibleNotifications.length} visible`, "accent")}
                ${hiddenCount ? badge(`${hiddenCount} hidden`, "yellow") : ""}
              </div>
            </div>
            <div class="panel-body">
              <div class="filter-row notification-filter-row">
                <label class="field">
                  <span>Search</span>
                  <input class="input" data-notification-search type="search" placeholder="Filter by action or description" />
                </label>
                ${selectField({
                  label: "Level",
                  name: "notification_level",
                  value: "",
                  options: [
                    { value: "", label: "All levels" },
                    { value: "info", label: "Info" },
                    { value: "success", label: "Success" },
                    { value: "warning", label: "Warning" },
                    { value: "error", label: "Error" },
                  ],
                })}
                ${button("Apply", { variant: "primary", attrs: 'data-action="apply-notification-filters"' })}
                ${button("Reset", { variant: "secondary", attrs: 'data-action="reset-notification-filters"' })}
                ${hiddenCount ? button("Restore hidden", { variant: "ghost", attrs: 'data-action="restore-hidden-notifications"' }) : ""}
              </div>
            </div>
            ${cardList(
              visibleNotifications.map((item, index) => {
                const key = notificationItemKey(item, index);
                const level = String(item.level ?? item.severity ?? "neutral").toLowerCase();
                const action = item.action_label ?? item.action ?? "Notification";
                const note = truncateText(item.action_description ?? item.message ?? "", 112);
                const timeValue = item.created_at ?? item.time ?? item.timestamp ?? new Date();
                const search = `${action} ${note} ${level}`.toLowerCase();
                return `
                  <article class="list-item" data-notification-row data-notification-key="${escapeHtml(key)}" data-level="${escapeHtml(level)}" data-searchable="${escapeHtml(search)}">
                    <div>
                      ${statusBadge(level)}
                      <strong>${escapeHtml(action)}</strong>
                      <p>${escapeHtml(note)}</p>
                      <p class="muted">${escapeHtml(formatDateTime(timeValue, { withSeconds: true, compact: true }))} · ${escapeHtml(timeAgo(timeValue))}</p>
                    </div>
                    <div class="table-actions">
                      ${rowAction("Details", `data-action="open-notification-details" data-key="${escapeHtml(key)}"`)}
                      ${rowAction("Hide", `data-action="hide-notification" data-key="${escapeHtml(key)}"`)}
                    </div>
                  </article>
                `;
              }),
              "No notifications yet.",
              button("Go to Dashboard", { variant: "secondary", attrs: 'data-go="dashboard"' }),
            )}
            <div class="empty-state" data-notification-filter-empty style="display:none;">
              <h4>No matching notifications</h4>
              <p>Adjust your search or level filter to see more activity.</p>
            </div>
            <div class="panel-body">
              ${renderPagination(meta, "notification-page")}
            </div>
          </section>
        `;
      },
      bind: (root, data, ctx) => {
        const meta = data.meta ?? {};
        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        const allByKey = new Map(notifications.map((item, index) => [notificationItemKey(item, index), item]));
        if (Number(meta.page || 1) > Math.max(1, Number(meta.total_pages || 1) || 1)) {
          writeNotificationPage(Math.max(1, Number(meta.total_pages || 1) || 1));
          ctx.reload();
          return;
        }

        const searchInput = root.querySelector("[data-notification-search]");
        const levelFilter = root.querySelector('select[name="notification_level"]');
        const emptyFiltered = root.querySelector("[data-notification-filter-empty]");

        const applyNotificationFilters = () => {
          const query = String(searchInput?.value || "").trim().toLowerCase();
          const level = String(levelFilter?.value || "").toLowerCase();
          let visible = 0;
          root.querySelectorAll("[data-notification-row]").forEach((row) => {
            const searchable = String(row.getAttribute("data-searchable") || "").toLowerCase();
            const rowLevel = String(row.getAttribute("data-level") || "").toLowerCase();
            const matches = (!query || searchable.includes(query)) && (!level || rowLevel === level);
            row.style.display = matches ? "" : "none";
            if (matches) visible += 1;
          });
          if (emptyFiltered) emptyFiltered.style.display = visible ? "none" : "";
        };

        root.querySelector('[data-action="apply-notification-filters"]')?.addEventListener("click", applyNotificationFilters);
        root.querySelector('[data-action="reset-notification-filters"]')?.addEventListener("click", () => {
          if (searchInput) searchInput.value = "";
          if (levelFilter) levelFilter.value = "";
          applyNotificationFilters();
        });
        searchInput?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyNotificationFilters();
          }
        });

        root.querySelectorAll('[data-action="open-notification-details"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = String(btn.getAttribute("data-key") || "");
            const item = allByKey.get(key);
            if (!item) return;
            const timeValue = item.created_at ?? item.time ?? item.timestamp ?? new Date();
            ctx.openModal({
              title: "Notification Details",
              note: `Event ${key}`,
              content: `
                <div class="section-stack">
                  ${infoRow("Action", String(item.action_label ?? item.action ?? "Notification"))}
                  ${infoRow("Level", String(item.level ?? item.severity ?? "info"))}
                  ${infoRow("Time", formatDateTime(timeValue, { withSeconds: true, compact: true }))}
                  ${infoRow("Ago", timeAgo(timeValue))}
                  ${infoRow("Description", String(item.action_description ?? item.message ?? "—"))}
                </div>
              `,
            });
          });
        });

        root.querySelectorAll('[data-action="hide-notification"]').forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = String(btn.getAttribute("data-key") || "");
            if (!key) return;
            const hidden = readHiddenNotificationKeys();
            writeHiddenNotificationKeys([...hidden, key]);
            ctx.toast("Notification hidden", "You can restore hidden notifications anytime.", "success");
            ctx.reload();
          });
        });

        root.querySelector('[data-action="restore-hidden-notifications"]')?.addEventListener("click", () => {
          writeHiddenNotificationKeys([]);
          ctx.toast("Hidden notifications restored", "All hidden entries are visible again.", "success");
          ctx.reload();
        });

        root.querySelector('[data-action="notification-page-prev"]')?.addEventListener("click", () => {
          const page = Math.max(1, Number(meta.page || 1) - 1);
          writeNotificationPage(page);
          ctx.reload();
        });
        root.querySelector('[data-action="notification-page-next"]')?.addEventListener("click", () => {
          const page = Math.min(Number(meta.total_pages || 1) || 1, Number(meta.page || 1) + 1);
          writeNotificationPage(page);
          ctx.reload();
        });

        applyNotificationFilters();
      },
    },
    profile: {
      title: "Profile",
      subtitle: "Manage profile details, password, and account access.",
      actions: () => "",
      load: async (ctx) => {
        const profile = await fetchOrFallback(ctx, "/users/me", fallbackProfile());
        return { profile: normalizeDetail(profile?.data ?? profile ?? {}) };
      },
      render: (data) => {
        const profile = data.profile ?? fallbackProfile();
        return `
          ${hero("Profile and security", "Manage your account and password from one place.")}
          <section class="cards-grid">
            ${metricCard({ label: "Role", value: String(profile.role ?? "user").toUpperCase(), trend: { label: "Access", kind: "up" }, hint: "Current workspace access", icon: "ID" })}
            ${metricCard({ label: "Status", value: String(profile.status ?? "active"), trend: { label: "Healthy", kind: "up" }, hint: "Account standing", icon: "✓" })}
            ${metricCard({ label: "Member since", value: formatDate(profile.created_at ?? new Date()), trend: { label: "Established", kind: "up" }, hint: "Account creation date", icon: "⌁" })}
            ${metricCard({ label: "Email", value: String(profile.email ?? "—"), trend: { label: "Verified", kind: "up" }, hint: "Login identity", icon: "@" })}
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
            ctx.toast("Profile updated", "Your account details were saved.", "success");
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
            ctx.toast("Password updated", "You can continue using the same session.", "success");
            event.currentTarget.reset();
          } catch (error) {
            ctx.toast("Update failed", error.message, "danger");
          }
        });

        root.querySelector("[data-action='delete-account']")?.addEventListener("click", async () => {
          if (!window.confirm("Delete your account? This will remove your profile and sign you out.")) return;
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
