const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

let lineChart;
let pieChart;
let reportsView = 'user';
let adminAnalyticsCacheKey = null;
let adminAnalyticsCachePromise = null;
const REPORT_CURRENCY_APP_VALUE = '__app__';
let reportState = {
  insights: null,
  monthly: [],
  categories: [],
  userSummary: [],
  params: {}
};

function getReportDateStamp() {
  return FinanceUtils.getLocalDateInputValue(new Date());
}

function getCurrentRangeLabel() {
  return document.getElementById('trendRangeLabel')?.textContent || 'All time';
}

function formatPeriodLabel(periodKey) {
  const [year, month] = String(periodKey || '').split('-');
  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (!parsedYear || !parsedMonth) return String(periodKey || '');
  return new Intl.DateTimeFormat(FinanceUtils.getCurrentLocale(), {
    month: 'short',
    year: 'numeric'
  }).format(new Date(parsedYear, parsedMonth - 1, 1));
}

function getEffectiveReportCurrency() {
  return FinanceUtils.getCurrencyDisplayOverride?.() || FinanceUtils.getPreferredCurrency();
}

function getCurrencyContextLabel() {
  const currency = getEffectiveReportCurrency();
  const isOverride = Boolean(FinanceUtils.getCurrencyDisplayOverride?.());
  return {
    currency,
    mode: isOverride ? 'Report override' : 'App currency',
    detail: `Values shown in ${currency} using ${isOverride ? 'this report override' : 'your app currency'}. Base values convert from INR using demo rates.`
  };
}

function getRoleReportMeta() {
  const currency = getEffectiveReportCurrency().toLowerCase();
  return reportsView === 'admin'
    ? {
        title: 'System Analytics Report',
        csvFilename: `system_analytics_report_${currency}_${getReportDateStamp()}.csv`,
        pdfFilename: `system_analytics_report_${currency}_${getReportDateStamp()}.pdf`
      }
    : {
        title: 'Personal Finance Report',
        csvFilename: `personal_finance_report_${currency}_${getReportDateStamp()}.csv`,
        pdfFilename: `personal_finance_report_${currency}_${getReportDateStamp()}.pdf`
      };
}

function formatCurrencyPdf(value) {
  const preferredCurrency = getEffectiveReportCurrency();
  const converted = FinanceUtils.convertCurrency(value || 0, 'INR', preferredCurrency);
  return new Intl.NumberFormat(FinanceUtils.getCurrentLocale(), {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(converted).replace(/\u00A0/g, ' ');
}

function pdfSafeText(value) {
  return String(value ?? '')
    .replace(/₹/g, 'INR ')
    .replace(/[•]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function setAdminCopy(isAdmin) {
  const subtitle = document.getElementById('reportsSubtitle');
  const kpiBalanceLabel = document.getElementById('kpiBalanceLabel');
  const kpiIncomeLabel = document.getElementById('kpiIncomeLabel');
  const kpiExpenseLabel = document.getElementById('kpiExpenseLabel');
  const insightsHeading = document.getElementById('insightsHeading');
  const topCategoryLabel = document.getElementById('insightTopCategoryLabel');
  const highestExpenseLabel = document.getElementById('insightHighestExpenseLabel');
  const savingsRateLabel = document.getElementById('insightSavingsRateLabel');
  const totalTransactionsLabel = document.getElementById('insightTotalTransactionsLabel');
  const avgTransactionLabel = document.getElementById('insightAvgTransactionLabel');
  const trendDirectionLabel = document.getElementById('insightTrendDirectionLabel');
  const narrative = document.getElementById('reportNarrativeText');
  const highlightOneLabel = document.getElementById('highlightOneLabel');
  const highlightTwoLabel = document.getElementById('highlightTwoLabel');
  const highlightThreeLabel = document.getElementById('highlightThreeLabel');
  const categoryTableHeading = document.getElementById('categoryTableHeading');
  const monthlyTableHeading = document.getElementById('monthlyTableHeading');
  const monthlyTableDescription = document.getElementById('monthlyTableDescription');
  const monthlyTableMetaLabel = document.getElementById('monthlyTableMetaLabel');
  const monthlyTableCoverageNote = document.getElementById('monthlyTableCoverageNote');

  if (subtitle) {
    subtitle.textContent = isAdmin
      ? 'Track platform-wide inflow, outflow, and category movement.'
      : 'Deep dive into your financial patterns.';
  }
  if (kpiBalanceLabel) {
    kpiBalanceLabel.textContent = isAdmin ? 'Net Position' : 'Net Savings';
  }
  if (kpiIncomeLabel) {
    kpiIncomeLabel.textContent = isAdmin ? 'Avg. Daily Inflow' : 'Avg. Inflow';
  }
  if (kpiExpenseLabel) {
    kpiExpenseLabel.textContent = isAdmin ? 'Avg. Daily Outflow' : 'Avg. Outflow';
  }
  if (insightsHeading) {
    insightsHeading.textContent = isAdmin ? 'System Insights' : 'Personal Insights';
  }
  if (topCategoryLabel) {
    topCategoryLabel.textContent = isAdmin ? 'Top Spend Category' : 'Primary Category';
  }
  if (highestExpenseLabel) {
    highestExpenseLabel.textContent = isAdmin ? 'Largest System Expense' : 'Largest Single Expense';
  }
  if (savingsRateLabel) {
    savingsRateLabel.textContent = isAdmin ? 'Net Margin' : 'Retention Rate';
  }
  if (totalTransactionsLabel) {
    totalTransactionsLabel.textContent = isAdmin ? 'Platform Activity' : 'Daily Activity';
  }
  if (avgTransactionLabel) {
    avgTransactionLabel.textContent = isAdmin ? 'Avg System Transaction' : 'Avg Transaction';
  }
  if (trendDirectionLabel) {
    trendDirectionLabel.textContent = isAdmin ? 'System Trend' : 'Trend Direction';
  }
  if (narrative) {
    narrative.textContent = isAdmin
      ? 'Loading system-level analytics summary...'
      : 'Loading a quick summary of how your money moved in this range...';
  }
  if (highlightOneLabel) {
    highlightOneLabel.textContent = isAdmin ? 'Platform Reach' : 'Category Focus';
  }
  if (highlightTwoLabel) {
    highlightTwoLabel.textContent = isAdmin ? 'Peak Net Month' : 'Best Month';
  }
  if (highlightThreeLabel) {
    highlightThreeLabel.textContent = 'Watchpoint';
  }
  if (categoryTableHeading) {
    categoryTableHeading.textContent = isAdmin ? 'System Spend Leaders' : 'Top Spending Categories';
  }
  if (monthlyTableHeading) {
    monthlyTableHeading.textContent = isAdmin ? 'Top Active Users' : 'Monthly Snapshot';
  }
  if (monthlyTableDescription) {
    monthlyTableDescription.textContent = isAdmin
      ? 'A ranked view of the busiest users in the selected range.'
      : 'A compact view of income, expense, and net movement.';
  }
  if (monthlyTableMetaLabel) {
    monthlyTableMetaLabel.textContent = isAdmin ? 'All Users' : 'Recent Months';
  }
  if (monthlyTableCoverageNote && !isAdmin) {
    monthlyTableCoverageNote.classList.add('hidden');
    monthlyTableCoverageNote.textContent = '';
  }
}

function initReportCurrencySelector() {
  const select = document.getElementById('reportCurrency');
  if (!select) return;
  const appCurrency = FinanceUtils.getPreferredCurrency();
  const options = [
    `<option value="${REPORT_CURRENCY_APP_VALUE}">Use app currency (${appCurrency})</option>`,
    ...FinanceUtils.getSupportedCurrencies().map((currency) => `<option value="${currency.code}">${currency.label}</option>`)
  ];
  select.innerHTML = options.join('');
  const override = FinanceUtils.getCurrencyDisplayOverride?.();
  select.value = override || REPORT_CURRENCY_APP_VALUE;
  if (select.dataset.currencyBound === 'true') return;
  select.addEventListener('change', (event) => {
    const value = event.target.value;
    if (value === REPORT_CURRENCY_APP_VALUE) {
      FinanceUtils.clearCurrencyDisplayOverride();
    } else {
      FinanceUtils.setCurrencyDisplayOverride(value);
    }
    syncReportCurrencyContext();
  });
  select.dataset.currencyBound = 'true';
}

function syncReportCurrencyContext() {
  initReportCurrencySelector();
  const context = getCurrencyContextLabel();
  const note = document.getElementById('reportCurrencyContext');
  const exportNote = document.getElementById('reportExportContext');
  if (note) {
    note.textContent = context.detail;
  }
  if (exportNote) {
    exportNote.textContent = `${context.mode.toUpperCase()} • ${context.currency} • exports include this context`;
  }
}

function setChartVisibility(canvasWrapId, emptyId, hasData) {
  const canvasWrap = document.getElementById(canvasWrapId);
  const empty = document.getElementById(emptyId);
  if (!canvasWrap || !empty) return;
  canvasWrap.classList.toggle('hidden', !hasData);
  empty.classList.toggle('hidden', hasData);
}

function updateTrendRangeLabel() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const label = document.getElementById('trendRangeLabel');
  if (!label) return;
  const formatDate = (value) => FinanceUtils.formatDate(value, 'short');

  if (startDate && endDate) {
    label.textContent = `${formatDate(startDate)} to ${formatDate(endDate)}`;
    return;
  }
  if (startDate || endDate) {
    label.textContent = startDate ? `From ${formatDate(startDate)}` : `Until ${formatDate(endDate)}`;
    return;
  }
  label.textContent = 'All time';
}

function buildDateParams() {
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const params = {};

  if (startDate) params.start_date = FinanceUtils.formatDateForApi(startDate);
  if (endDate) params.end_date = FinanceUtils.formatDateForApi(endDate, true);

  return params;
}

async function getAdminAnalytics(params = {}) {
  const query = new URLSearchParams(params).toString();
  const cacheKey = query || '__all__';

  if (adminAnalyticsCacheKey !== cacheKey) {
    const endpoint = query ? `/admin/analytics?${query}` : '/admin/analytics';
    adminAnalyticsCacheKey = cacheKey;
    adminAnalyticsCachePromise = FinanceUtils.fetchWithAuth(endpoint);
  }

  const res = await adminAnalyticsCachePromise;
  if (!res.success) throw new Error(res.error || 'Failed to load admin analytics');
  return res.data;
}

async function loadInsights(params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const data = reportsView === 'admin'
      ? await getAdminAnalytics(params)
      : await (async () => {
          const res = await FinanceUtils.fetchWithAuth(`/summary/insights?${query}`);
          if (!res.success) throw new Error(res.error || 'Failed to load insights');
          return res.data;
        })();

    document.getElementById('kpiBalance').textContent = FinanceUtils.formatCurrency((data.total_income || 0) - (data.total_expense || 0));
    document.getElementById('kpiIncome').textContent = FinanceUtils.formatCurrency(Math.round((data.total_income || 0) / 30));
    document.getElementById('kpiExpense').textContent = FinanceUtils.formatCurrency(Math.round((data.total_expense || 0) / 30));

    document.getElementById('insightTopCategory').textContent = data.top_category
      ? `${data.top_category.name} (${FinanceUtils.formatCurrency(data.top_category.amount)})`
      : '-';

    document.getElementById('insightHighestExpense').textContent = data.highest_transaction
      ? `${data.highest_transaction.description || 'Largest transaction'} (${FinanceUtils.formatCurrency(Math.abs(data.highest_transaction.amount || 0))})`
      : '-';

    const denominator = data.total_income || 0;
    const savingsRate = denominator > 0
      ? Math.round((((data.total_income || 0) - (data.total_expense || 0)) / denominator) * 100)
      : 0;
    document.getElementById('insightSavingsRate').textContent = `${savingsRate}%`;
    document.getElementById('insightTotalTransactions').textContent = `${data.transactions_per_day || 0}/day`;

    const avgTransaction = reportsView === 'admin'
      ? (data.avg_transaction || 0)
      : (data.avg_transaction || 0);
    document.getElementById('insightAvgTransaction').textContent = FinanceUtils.formatCurrency(avgTransaction);

    const trendDirection = reportsView === 'admin'
      ? (data.trend_direction || 'Stable')
      : getUserTrendDirection(data.spending_trend || []);
    document.getElementById('insightTrendDirection').textContent = trendDirection;

    reportState.insights = data;
    if (reportsView === 'admin') {
      reportState.userSummary = data.user_summary || [];
      renderSecondaryTable();
    }
    reportState.params = params;
    renderNarrative(data, trendDirection);
    renderHighlights();
  } catch (err) {
    console.error('Load insights error:', err);
  }
}

function renderNarrative(data, trendDirection) {
  const node = document.getElementById('reportNarrativeText');
  if (!node) return;

  const totalIncome = data.total_income || 0;
  const totalExpense = data.total_expense || 0;
  const topCategoryName = data.top_category?.name || 'your leading category';
  const topCategoryAmount = data.top_category?.amount || 0;
  const avgTransaction = data.avg_transaction || 0;

  if (!totalIncome && !totalExpense) {
    node.textContent = reportsView === 'admin'
      ? 'No system activity is available in this range yet. Once transactions start flowing, this summary will highlight the strongest categories and movement trends.'
      : 'No activity is available in this range yet. Add a few income or expense transactions and this summary will explain your strongest spending patterns.';
    return;
  }

  if (reportsView === 'admin') {
    node.textContent = `${topCategoryName} leads system spending at ${FinanceUtils.formatCurrency(topCategoryAmount)}. Net position is ${FinanceUtils.formatCurrency(totalIncome - totalExpense)}, average transaction size is ${FinanceUtils.formatCurrency(avgTransaction)}, and the current system trend looks ${trendDirection.toLowerCase()}.`;
    return;
  }

  node.textContent = `${topCategoryName} is your biggest expense category at ${FinanceUtils.formatCurrency(topCategoryAmount)}. You brought in ${FinanceUtils.formatCurrency(totalIncome)} and spent ${FinanceUtils.formatCurrency(totalExpense)} in this range, with an average transaction of ${FinanceUtils.formatCurrency(avgTransaction)}. Overall momentum looks ${trendDirection.toLowerCase()}.`;
}

function getUserTrendDirection(spendingTrend = []) {
  if (!Array.isArray(spendingTrend) || spendingTrend.length < 2) {
    return 'Stable';
  }

  const previous = spendingTrend[spendingTrend.length - 2];
  const current = spendingTrend[spendingTrend.length - 1];
  const previousNet = (previous.income || 0) - (previous.expense || 0);
  const currentNet = (current.income || 0) - (current.expense || 0);

  if (currentNet > previousNet) return 'Improving';
  if (currentNet < previousNet) return 'Cooling';
  return 'Stable';
}

async function loadMonthlySummary(params = {}) {
  try {
    let monthlyData;
    if (reportsView === 'admin') {
      monthlyData = (await getAdminAnalytics(params)).monthly_summary || [];
    } else {
      const query = new URLSearchParams(params).toString();
      const res = await FinanceUtils.fetchWithAuth(`/summary/monthly?${query}`);
      if (!res.success) throw new Error(res.error || 'Failed to load monthly summary');
      monthlyData = res.data;
    }

    const grouped = {};
    monthlyData.forEach((item) => {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
      if (item.type === 'income') grouped[key].income += item.total;
      else grouped[key].expense += Math.abs(item.total);
    });

    const sortedKeys = Object.keys(grouped).sort();
    const labels = [];
    const incomeData = [];
    const expenseData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    sortedKeys.forEach((key) => {
      const [, month] = key.split('-');
      labels.push(monthNames[parseInt(month, 10) - 1]);
      incomeData.push(grouped[key].income);
      expenseData.push(grouped[key].expense);
    });

    const hasData = labels.length > 0;
    setChartVisibility('lineChartWrap', 'lineChartEmpty', hasData);
    if (!hasData) {
      if (lineChart) {
        lineChart.destroy();
        lineChart = null;
      }
      reportState.monthly = [];
      renderSecondaryTable();
      renderHighlights();
      return;
    }

    if (lineChart) lineChart.destroy();
    lineChart = FinanceCharts.createCashflowLineChart(document.getElementById('lineChart'), {
      labels,
      incomeData,
      expenseData,
      palette: 'minimal',
      legendPosition: 'top',
      showLegend: false
    });
    reportState.monthly = monthlyData;
    renderSecondaryTable();
    renderHighlights();
  } catch (err) {
    console.error('Load monthly summary error:', err);
  }
}

async function loadCategorySummary(params = {}) {
  try {
    let categoryData;
    if (reportsView === 'admin') {
      categoryData = (await getAdminAnalytics(params)).category_summary || [];
    } else {
      const query = new URLSearchParams(params).toString();
      const endpoint = query ? `/summary/by-category?type=expense&${query}` : '/summary/by-category?type=expense';
      const res = await FinanceUtils.fetchWithAuth(endpoint);
      if (!res.success) throw new Error(res.error || 'Failed to load category summary');
      categoryData = res.data;
    }

    const sorted = [...categoryData]
      .map((c) => ({ category: c.category, amount: Math.abs(c.total) }))
      .sort((a, b) => b.amount - a.amount);

    const topCategories = sorted.slice(0, 6);
    const remainingTotal = sorted.slice(6).reduce((sum, item) => sum + item.amount, 0);
    if (remainingTotal > 0) {
      topCategories.push({ category: 'Others', amount: remainingTotal });
    }

    const labels = topCategories.map((c) => c.category);
    const data = topCategories.map((c) => c.amount);
    const total = data.reduce((sum, value) => sum + value, 0);

    const totalNode = document.getElementById('expenseTotal');
    if (totalNode) totalNode.textContent = FinanceCharts.formatCurrency(total);

    const hasData = total > 0;
    setChartVisibility('pieChartWrap', 'pieChartEmpty', hasData);
    if (!hasData) {
      if (pieChart) {
        pieChart.destroy();
        pieChart = null;
      }
      reportState.categories = [];
      renderCategoryTable();
      return;
    }

    if (pieChart) pieChart.destroy();
    pieChart = FinanceCharts.createSpendingDonutChart(document.getElementById('pieChart'), {
      labels,
      data,
      total,
      palette: 'minimal',
      legendPosition: 'bottom',
      legendAlign: 'center',
      centerLabel: 'Total spend',
      centerCompact: true
    });
    reportState.categories = topCategories;
    renderCategoryTable();
    renderHighlights();
  } catch (err) {
    console.error('Load category summary error:', err);
  }
}

function renderCategoryTable() {
  const rowsNode = document.getElementById('categoryTableRows');
  const emptyNode = document.getElementById('categoryTableEmpty');
  if (!rowsNode || !emptyNode) return;

  const categories = reportState.categories || [];
  if (!categories.length) {
    rowsNode.classList.add('hidden');
    rowsNode.innerHTML = '';
    emptyNode.classList.remove('hidden');
    emptyNode.textContent = reportsView === 'admin'
      ? 'No system category movement is available in this range yet.'
      : 'No category spending data is available in this range yet.';
    return;
  }

  const total = categories.reduce((sum, item) => sum + (item.amount || 0), 0);
  rowsNode.classList.remove('hidden');
  emptyNode.classList.add('hidden');
  rowsNode.innerHTML = categories.slice(0, 5).map((item, index) => {
    const share = total ? Math.round(((item.amount || 0) / total) * 100) : 0;
    return `
      <div class="px-6 py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4 min-w-0">
          <span class="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center">${index + 1}</span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-gray-900 dark:text-white truncate">${item.category}</p>
            <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">${share}% of displayed spend</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold text-gray-900 dark:text-white">${FinanceUtils.formatCurrency(item.amount)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">${reportsView === 'admin' ? 'system' : 'personal'} range</p>
        </div>
      </div>
    `;
  }).join('');
}

function buildMonthlyNetSummary(monthlyData = []) {
  const grouped = {};
  monthlyData.forEach((item) => {
    const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
    grouped[key] ??= { income: 0, expense: 0 };
    if (item.type === 'income') grouped[key].income += item.total || 0;
    else grouped[key].expense += Math.abs(item.total || 0);
  });
  return Object.entries(grouped).map(([key, value]) => ({
    key,
    net: (value.income || 0) - (value.expense || 0),
    income: value.income || 0,
    expense: value.expense || 0
  })).sort((a, b) => a.key.localeCompare(b.key));
}

function getRankedUserSummary(limit = null) {
  const users = [...(reportState.userSummary || [])].sort((a, b) => {
    const txnDelta = (b.transaction_count || 0) - (a.transaction_count || 0);
    if (txnDelta !== 0) return txnDelta;
    const netDelta = (b.net_total || 0) - (a.net_total || 0);
    if (netDelta !== 0) return netDelta;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  return typeof limit === 'number' ? users.slice(0, limit) : users;
}

function renderMonthlyTable() {
  const rowsNode = document.getElementById('monthlyTableRows');
  const emptyNode = document.getElementById('monthlyTableEmpty');
  if (!rowsNode || !emptyNode) return;

  const monthlyNet = buildMonthlyNetSummary(reportState.monthly || []);
  if (!monthlyNet.length) {
    rowsNode.classList.add('hidden');
    rowsNode.innerHTML = '';
    emptyNode.classList.remove('hidden');
    emptyNode.textContent = reportsView === 'admin'
      ? 'No monthly system movement is available in this range yet.'
      : 'No monthly summary is available in this range yet.';
    return;
  }

  rowsNode.classList.remove('hidden');
  emptyNode.classList.add('hidden');
  rowsNode.innerHTML = monthlyNet.slice(-4).reverse().map((item) => {
    const netTone = item.net >= 0
      ? 'text-emerald-600 dark:text-emerald-300'
      : 'text-orange-600 dark:text-orange-300';
    return `
      <div class="px-6 py-4 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-bold text-gray-900 dark:text-white">${formatPeriodLabel(item.key)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            Income ${FinanceUtils.formatCurrency(item.income)} • Expense ${FinanceUtils.formatCurrency(item.expense)}
          </p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold ${netTone}">${FinanceUtils.formatCurrency(item.net)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Net result</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderUserSummaryTable() {
  const rowsNode = document.getElementById('monthlyTableRows');
  const emptyNode = document.getElementById('monthlyTableEmpty');
  if (!rowsNode || !emptyNode) return;

  const allUsers = getRankedUserSummary();
  const users = getRankedUserSummary(6);
  const metaLabel = document.getElementById('monthlyTableMetaLabel');
  const description = document.getElementById('monthlyTableDescription');
  const coverageNote = document.getElementById('monthlyTableCoverageNote');
  if (!users.length) {
    rowsNode.classList.add('hidden');
    rowsNode.innerHTML = '';
    emptyNode.classList.remove('hidden');
    emptyNode.textContent = 'No user transaction activity is available in this range yet.';
    if (metaLabel) metaLabel.textContent = 'No Active Users';
    if (description) description.textContent = 'No users recorded transactions in the selected range.';
    if (coverageNote) {
      coverageNote.classList.add('hidden');
      coverageNote.textContent = '';
    }
    return;
  }

  if (metaLabel) {
    metaLabel.textContent = allUsers.length > users.length
      ? `Top ${users.length} of ${allUsers.length}`
      : `${users.length} Active Users`;
  }
  if (description) {
    description.textContent = allUsers.length > users.length
      ? 'A ranked view of the busiest users in the selected range, ordered by transaction activity.'
      : 'A user-by-user breakdown of transaction activity in the selected range.';
  }
  if (coverageNote) {
    coverageNote.classList.remove('hidden');
    coverageNote.textContent = allUsers.length > users.length
      ? `On-screen view shows the top ${users.length} users. Downloads include the top 10 active users for readability.`
      : 'This view includes every active user in the selected range.';
  }

  rowsNode.classList.remove('hidden');
  emptyNode.classList.add('hidden');
  rowsNode.innerHTML = users.map((item) => {
    const netTone = item.net_total >= 0
      ? 'text-emerald-600 dark:text-emerald-300'
      : 'text-orange-600 dark:text-orange-300';
    return `
      <div class="px-6 py-4 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="text-sm font-bold text-gray-900 dark:text-white truncate">${item.name || 'Unknown user'}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium truncate">${item.email || 'No email'} • ${item.transaction_count || 0} transaction${item.transaction_count === 1 ? '' : 's'}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold text-gray-900 dark:text-white">In ${FinanceUtils.formatCurrency(item.income_total || 0)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Out ${FinanceUtils.formatCurrency(item.expense_total || 0)}</p>
          <p class="text-[11px] font-bold ${netTone}">Net ${FinanceUtils.formatCurrency(item.net_total || 0)}</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderSecondaryTable() {
  if (reportsView === 'admin') {
    renderUserSummaryTable();
    return;
  }
  renderMonthlyTable();
}

function renderHighlights() {
  const one = document.getElementById('highlightOneValue');
  const two = document.getElementById('highlightTwoValue');
  const three = document.getElementById('highlightThreeValue');
  if (!one || !two || !three) return;

  const insights = reportState.insights || {};
  const categories = reportState.categories || [];
  const monthlyNet = buildMonthlyNetSummary(reportState.monthly || []);
  const bestMonth = monthlyNet.sort((a, b) => b.net - a.net)[0];
  const totalCategorySpend = categories.reduce((sum, item) => sum + (item.amount || 0), 0);
  const topCategory = categories[0];

  if (reportsView === 'admin') {
    const userCounts = insights.user_counts || {};
    const active = userCounts.active || 0;
    const total = userCounts.total || 0;
    const blocked = userCounts.blocked || 0;
    one.textContent = total ? `${active}/${total} users active` : 'No user data';
    two.textContent = bestMonth ? `${formatPeriodLabel(bestMonth.key)} • ${FinanceUtils.formatCurrency(bestMonth.net)}` : 'No monthly peak yet';
    three.textContent = blocked ? `${blocked} blocked user${blocked === 1 ? '' : 's'} need attention` : 'No blocked-user alerts right now';
    return;
  }

  const share = topCategory && totalCategorySpend
    ? Math.round((topCategory.amount / totalCategorySpend) * 100)
    : 0;
  one.textContent = topCategory ? `${topCategory.category} • ${share}% of spend` : 'No category leader yet';
  two.textContent = bestMonth ? `${formatPeriodLabel(bestMonth.key)} • ${FinanceUtils.formatCurrency(bestMonth.net)}` : 'No monthly peak yet';
  const income = insights.total_income || 0;
  const expense = insights.total_expense || 0;
  three.textContent = income
    ? `Spending is ${Math.round((expense / income) * 100)}% of inflow`
    : 'Add inflow to unlock pressure insights';
}

function triggerBlobDownload(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function buildReportTakeaways() {
  const insights = reportState.insights || {};
  const categories = reportState.categories || [];
  const monthlyNet = buildMonthlyNetSummary(reportState.monthly || []);
  const topCategory = categories[0];
  const latestMonth = monthlyNet[monthlyNet.length - 1];
  const takeaways = [];

  if (reportsView === 'admin') {
    const activeUsers = reportState.userSummary?.length || 0;
    if (topCategory) {
      takeaways.push(`${topCategory.category} is driving the highest system spend at ${FinanceUtils.formatCurrency(topCategory.amount)} in this range.`);
    }
    if (latestMonth) {
      takeaways.push(`${formatPeriodLabel(latestMonth.key)} closed with a net position of ${FinanceUtils.formatCurrency(latestMonth.net)}, based on ${FinanceUtils.formatCurrency(latestMonth.income)} in inflow and ${FinanceUtils.formatCurrency(latestMonth.expense)} in outflow.`);
    }
    if (activeUsers) {
      takeaways.push(`${activeUsers} users recorded transactions in this range, which gives a clear view of platform-wide behavior.`);
    }
    if ((insights.user_counts?.blocked || 0) > 0) {
      takeaways.push(`${insights.user_counts.blocked} blocked user${insights.user_counts.blocked === 1 ? '' : 's'} still need review from the admin side.`);
    }
  } else {
    if (topCategory) {
      takeaways.push(`${topCategory.category} is the biggest spending category at ${FinanceUtils.formatCurrency(topCategory.amount)} in this range.`);
    }
    if (latestMonth) {
      takeaways.push(`${formatPeriodLabel(latestMonth.key)} ended with a net result of ${FinanceUtils.formatCurrency(latestMonth.net)} after ${FinanceUtils.formatCurrency(latestMonth.expense)} in expenses.`);
    }
    if ((insights.total_income || 0) > 0) {
      const spendRatio = Math.round(((insights.total_expense || 0) / (insights.total_income || 1)) * 100);
      takeaways.push(`Spending currently uses about ${spendRatio}% of total inflow, which helps show how much room is left for saving.`);
    }
    if ((insights.transactions_per_day || 0) > 0) {
      takeaways.push(`Transaction activity is averaging ${insights.transactions_per_day}/day in the selected period.`);
    }
  }

  return takeaways.filter(Boolean).slice(0, 4);
}

function createReportCsvContent() {
  const meta = getRoleReportMeta();
  const currencyContext = getCurrencyContextLabel();
  const insights = reportState.insights || {};
  const categories = reportState.categories || [];
  const monthlyNet = buildMonthlyNetSummary(reportState.monthly || []);
  const userSummary = getRankedUserSummary(10);
  const totalActiveUsers = (reportState.userSummary || []).length;
  const highlightRows = [
    [document.getElementById('highlightOneLabel')?.textContent || 'Highlight 1', document.getElementById('highlightOneValue')?.textContent || '-'],
    [document.getElementById('highlightTwoLabel')?.textContent || 'Highlight 2', document.getElementById('highlightTwoValue')?.textContent || '-'],
    [document.getElementById('highlightThreeLabel')?.textContent || 'Highlight 3', document.getElementById('highlightThreeValue')?.textContent || '-']
  ];
  const rows = [];

  rows.push([meta.title]);
  rows.push(['Generated On', FinanceUtils.formatViewerTimestamp(new Date().toISOString())]);
  rows.push(['Range', getCurrentRangeLabel()]);
  rows.push(['Display Currency', currencyContext.currency]);
  rows.push(['Currency Mode', currencyContext.mode]);
  rows.push(['Conversion Basis', 'Base values are converted from INR using demo rates.']);
  rows.push([]);

  if (reportsView === 'admin') {
    rows.push(['System Overview']);
    rows.push(['Net Position', FinanceUtils.formatCurrency((insights.total_income || 0) - (insights.total_expense || 0))]);
    rows.push(['Average Inflow', FinanceUtils.formatCurrency(Math.round((insights.total_income || 0) / 30))]);
    rows.push(['Average Outflow', FinanceUtils.formatCurrency(Math.round((insights.total_expense || 0) / 30))]);
    rows.push(['Platform Activity', `${insights.transactions_per_day || 0}/day`]);
    rows.push(['Average Transaction', FinanceUtils.formatCurrency(insights.avg_transaction || 0)]);
    rows.push(['Trend Direction', insights.trend_direction || 'Stable']);
    rows.push(['Active Users', insights.user_counts?.active || 0]);
    rows.push(['Blocked Users', insights.user_counts?.blocked || 0]);
    rows.push([]);
    rows.push(['All User Transaction Summary']);
    rows.push(['Coverage', totalActiveUsers > userSummary.length ? `Top ${userSummary.length} active users by transaction count out of ${totalActiveUsers}` : `All ${totalActiveUsers} active users in range`]);
    rows.push(['User', 'Email', 'Transactions', 'Inflow', 'Outflow', 'Net']);
    userSummary.forEach((item) => {
      rows.push([
        item.name || 'Unknown user',
        item.email || '',
        item.transaction_count || 0,
        FinanceUtils.formatCurrency(item.income_total || 0),
        FinanceUtils.formatCurrency(item.expense_total || 0),
        FinanceUtils.formatCurrency(item.net_total || 0)
      ]);
    });
  } else {
    rows.push(['Personal Overview']);
    rows.push(['Net Savings', FinanceUtils.formatCurrency((insights.total_income || 0) - (insights.total_expense || 0))]);
    rows.push(['Average Inflow', FinanceUtils.formatCurrency(Math.round((insights.total_income || 0) / 30))]);
    rows.push(['Average Outflow', FinanceUtils.formatCurrency(Math.round((insights.total_expense || 0) / 30))]);
    rows.push(['Retention Rate', document.getElementById('insightSavingsRate')?.textContent || '0%']);
    rows.push(['Daily Activity', `${insights.transactions_per_day || 0}/day`]);
    rows.push(['Average Transaction', FinanceUtils.formatCurrency(insights.avg_transaction || 0)]);
    rows.push(['Trend Direction', getUserTrendDirection(insights.spending_trend || [])]);
  }

  rows.push([]);
  rows.push(['Summary']);
  rows.push([document.getElementById('reportNarrativeText')?.textContent || '']);
  rows.push([]);

  rows.push(['Key Takeaways']);
  buildReportTakeaways().forEach((item, index) => {
    rows.push([`Takeaway ${index + 1}`, item]);
  });
  rows.push([]);

  rows.push(['Highlights']);
  rows.push(['Focus Area', 'Observation']);
  highlightRows.forEach((row) => rows.push(row));

  rows.push([]);
  rows.push([reportsView === 'admin' ? 'System Spend Leaders' : 'Top Spending Categories']);
  rows.push(['Category', 'Amount']);
  categories.forEach((item) => {
    rows.push([item.category, FinanceUtils.formatCurrency(item.amount)]);
  });

  rows.push([]);
  rows.push([reportsView === 'admin' ? 'Platform Monthly Snapshot' : 'Monthly Snapshot']);
  rows.push(['Period', 'Income', 'Expense', 'Net']);
  monthlyNet.forEach((item) => {
    rows.push([formatPeriodLabel(item.key), FinanceUtils.formatCurrency(item.income), FinanceUtils.formatCurrency(item.expense), FinanceUtils.formatCurrency(item.net)]);
  });

  return rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

function applyDateFilter() {
  const params = buildDateParams();
  FinanceUtils.refreshFilterFieldStates();
  loadInsights(params);
  loadMonthlySummary(params);
  loadCategorySummary(params);
  updateTrendRangeLabel();
}

async function downloadReport(format = 'csv') {
  try {
    if (format === 'pdf') {
      await downloadReportPdf();
      return;
    }
    const meta = getRoleReportMeta();
    const csv = createReportCsvContent();
    triggerBlobDownload(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' }), meta.csvFilename);
  } catch (err) {
    console.error('Download error:', err);
  }
}

async function downloadReportPdf() {
  if (!window.jspdf?.jsPDF) {
    throw new Error('PDF export is unavailable right now');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 44;
  let cursorY = 52;
  const preferredCurrency = getEffectiveReportCurrency();
  const currencyContext = getCurrencyContextLabel();
  const formatValue = (value) => `${preferredCurrency} ${formatCurrencyPdf(value || 0)}`;
  const meta = getRoleReportMeta();
  const trendLabel = getCurrentRangeLabel();
  const insights = reportState.insights || {};
  const categories = reportState.categories || [];
  const monthlyNet = buildMonthlyNetSummary(reportState.monthly || []);
  const userSummary = getRankedUserSummary(10);
  const totalActiveUsers = (reportState.userSummary || []).length;
  const highlightRows = [
    [document.getElementById('highlightOneLabel')?.textContent || 'Highlight 1', document.getElementById('highlightOneValue')?.textContent || '-'],
    [document.getElementById('highlightTwoLabel')?.textContent || 'Highlight 2', document.getElementById('highlightTwoValue')?.textContent || '-'],
    [document.getElementById('highlightThreeLabel')?.textContent || 'Highlight 3', document.getElementById('highlightThreeValue')?.textContent || '-']
  ];
  const takeaways = buildReportTakeaways();
  const ensurePdfSpace = (needed = 80) => {
    if (cursorY + needed > 760) {
      doc.addPage();
      cursorY = 52;
    }
  };
  const addSectionGap = (gap = 20) => {
    ensurePdfSpace(gap);
    cursorY += gap;
  };
  const drawStackedDetail = (label, value) => {
    const labelLines = doc.splitTextToSize(pdfSafeText(String(label)), 500);
    const valueLines = doc.splitTextToSize(pdfSafeText(String(value)), 480);
    const rowHeight = 28 + (labelLines.length * 12) + (valueLines.length * 13);
    ensurePdfSpace(rowHeight + 10);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, cursorY - 14, 504, rowHeight, 14, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(labelLines, marginX + 14, cursorY + 2);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(valueLines, marginX + 14, cursorY + 20 + (labelLines.length - 1) * 12);
    cursorY += rowHeight + 12;
  };
  const renderChartForPdf = async (kind) => {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    wrapper.style.width = kind === 'line' ? '1000px' : '860px';
    wrapper.style.height = kind === 'line' ? '500px' : '600px';
    wrapper.style.background = '#ffffff';
    document.body.appendChild(wrapper);

    const canvas = document.createElement('canvas');
    canvas.width = kind === 'line' ? 1000 : 860;
    canvas.height = kind === 'line' ? 500 : 600;
    wrapper.appendChild(canvas);

    let chart;
    if (kind === 'line') {
      const monthlyData = reportState.monthly || [];
      const grouped = {};
      monthlyData.forEach((item) => {
        const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
        if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
        if (item.type === 'income') grouped[key].income += item.total;
        else grouped[key].expense += Math.abs(item.total);
      });
      const sortedKeys = Object.keys(grouped).sort();
      const labels = [];
      const incomeData = [];
      const expenseData = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      sortedKeys.forEach((key) => {
        const [, month] = key.split('-');
        labels.push(monthNames[parseInt(month, 10) - 1]);
        incomeData.push(grouped[key].income);
        expenseData.push(grouped[key].expense);
      });
      chart = FinanceCharts.createCashflowLineChart(canvas, {
        labels,
        incomeData,
        expenseData,
        palette: 'minimal',
        legendPosition: 'top',
        showLegend: true,
        themeOverride: 'light'
      });
    } else {
      chart = FinanceCharts.createSpendingDonutChart(canvas, {
        labels: categories.map((item) => item.category),
        data: categories.map((item) => item.amount),
        total: categories.reduce((sum, item) => sum + (item.amount || 0), 0),
        palette: 'minimal',
        legendPosition: 'bottom',
        legendAlign: 'center',
        centerLabel: 'Total spend',
        centerCompact: true,
        showLegend: true,
        themeOverride: 'light'
      });
    }

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    chart?.destroy?.();
    document.body.removeChild(wrapper);
    return dataUrl;
  };

  doc.setFillColor(47, 111, 237);
  doc.roundedRect(marginX, cursorY - 8, 98, 26, 12, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(pdfSafeText('Finly Report'), marginX + 17, cursorY + 9);

  doc.setTextColor(24, 24, 27);
  doc.setFontSize(24);
  doc.text(pdfSafeText(meta.title), marginX, cursorY + 44);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 97, 112);
  doc.text(pdfSafeText(`Range: ${trendLabel}`), marginX, cursorY + 66);
  doc.text(pdfSafeText(`Generated: ${FinanceUtils.formatViewerTimestamp(new Date().toISOString())}`), marginX + 220, cursorY + 66);
  doc.text(pdfSafeText(`Currency: ${currencyContext.currency} (${currencyContext.mode})`), marginX, cursorY + 84);
  doc.text(pdfSafeText('Conversion basis: Base values converted from INR using demo rates'), marginX, cursorY + 102);
  cursorY += 134;

  const stats = [
    [
      document.getElementById('kpiBalanceLabel')?.textContent || 'Net Savings',
      FinanceUtils.formatCurrency((insights.total_income || 0) - (insights.total_expense || 0))
    ],
    [
      document.getElementById('kpiIncomeLabel')?.textContent || 'Avg. Inflow',
      FinanceUtils.formatCurrency(Math.round((insights.total_income || 0) / 30))
    ],
    [
      document.getElementById('kpiExpenseLabel')?.textContent || 'Avg. Outflow',
      FinanceUtils.formatCurrency(Math.round((insights.total_expense || 0) / 30))
    ],
  ];

  stats.forEach(([label, value], index) => {
    const boxX = marginX + index * 170;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(boxX, cursorY, 152, 72, 18, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(pdfSafeText(label.toUpperCase()), boxX + 14, cursorY + 20);
    doc.setFontSize(21);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(value), boxX + 14, cursorY + 49);
  });
  cursorY += 112;

  ensurePdfSpace(95);
  if (reportsView === 'admin') {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('Platform Overview'), marginX, cursorY);
    cursorY += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    const userCounts = insights.user_counts || {};
    [
      `Active users: ${userCounts.active || 0}`,
      `Blocked users: ${userCounts.blocked || 0}`,
      `Transactions per day: ${insights.transactions_per_day || 0}`,
      `System trend: ${insights.trend_direction || 'Stable'}`
    ].forEach((line) => {
      doc.text(pdfSafeText(line), marginX, cursorY);
      cursorY += 16;
    });
    addSectionGap(8);
  }

  const summaryText = document.getElementById('reportNarrativeText')?.textContent || '';
  if (summaryText) {
    ensurePdfSpace(110);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('Executive Summary'), marginX, cursorY);
    cursorY += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    const summaryLines = doc.splitTextToSize(summaryText, 500);
    doc.text(summaryLines.map(pdfSafeText), marginX, cursorY);
    cursorY += summaryLines.length * 15 + 24;
  }

  if (takeaways.length) {
    ensurePdfSpace(110);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('Key Takeaways'), marginX, cursorY);
    cursorY += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    takeaways.forEach((item) => {
      const wrapped = doc.splitTextToSize(pdfSafeText(item), 480);
      ensurePdfSpace(wrapped.length * 14 + 10);
      doc.text(pdfSafeText('-'), marginX, cursorY);
      doc.text(wrapped, marginX + 14, cursorY);
      cursorY += wrapped.length * 14 + 8;
    });
    addSectionGap(8);
  }

  const insightRows = [
    [reportsView === 'admin' ? 'Top Spend Category' : 'Top Category', insights.top_category ? `${insights.top_category.name} (${formatValue(insights.top_category.amount)})` : '-'],
    [reportsView === 'admin' ? 'Largest System Expense' : 'Largest Expense', insights.highest_transaction ? `${insights.highest_transaction.description || 'Largest transaction'} (${formatValue(insights.highest_transaction.amount)})` : '-'],
    [reportsView === 'admin' ? 'Platform Activity' : 'Daily Activity', `${insights.transactions_per_day || 0}/day`],
    ['Avg Transaction', formatValue(insights.avg_transaction || 0)],
    ['Trend Direction', reportsView === 'admin' ? (insights.trend_direction || 'Stable') : getUserTrendDirection(insights.spending_trend || [])],
  ];

  addSectionGap(8);
  ensurePdfSpace(128);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(pdfSafeText('Insights'), marginX, cursorY);
  cursorY += 22;
  doc.setFontSize(11);
  insightRows.forEach(([label, value]) => {
    drawStackedDetail(label, value);
  });

  addSectionGap(10);
  ensurePdfSpace(124);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(pdfSafeText('Highlights At A Glance'), marginX, cursorY);
  cursorY += 24;
  highlightRows.forEach(([label, value]) => {
    const wrapped = doc.splitTextToSize(pdfSafeText(String(value)), 340);
    const boxHeight = Math.max(52, wrapped.length * 13 + 24);
    ensurePdfSpace(boxHeight + 12);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, cursorY - 13, 504, boxHeight, 14, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(label), marginX + 14, cursorY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(wrapped, marginX + 160, cursorY + 6);
    cursorY += boxHeight + 12;
  });

  if (categories.length) {
    addSectionGap(6);
    ensurePdfSpace(150);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(reportsView === 'admin' ? 'System Spend Leaders' : 'Top Spending Categories'), marginX, cursorY);
    cursorY += 24;
    doc.setFontSize(11);
    const categoryShareBase = categories.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    categories.slice(0, 5).forEach((item) => {
      ensurePdfSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfSafeText(item.category), marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const categoryShare = categoryShareBase ? Math.round(((item.amount || 0) / categoryShareBase) * 100) : 0;
      doc.text(pdfSafeText(`${categoryShare}% share`), marginX + 108, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(pdfSafeText(formatValue(item.amount)), marginX + 190, cursorY);
      cursorY += 20;
    });
  }

  if (monthlyNet.length) {
    addSectionGap(8);
    ensurePdfSpace(132);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText(reportsView === 'admin' ? 'Platform Monthly Snapshot' : 'Monthly Snapshot'), marginX, cursorY);
    cursorY += 24;
    doc.setFontSize(11);
    monthlyNet.slice(-4).forEach((item) => {
      const monthlyText = `Income ${formatValue(item.income)} - Expense ${formatValue(item.expense)} - Net ${formatValue(item.net)}`;
      const wrapped = doc.splitTextToSize(pdfSafeText(monthlyText), 400);
      ensurePdfSpace(Math.max(22, wrapped.length * 13 + 8));
      doc.setFont('helvetica', 'bold');
      doc.text(pdfSafeText(formatPeriodLabel(item.key)), marginX, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.text(wrapped, marginX + 88, cursorY);
      cursorY += Math.max(24, wrapped.length * 13 + 8);
    });
  }

  if (reportsView === 'admin' && userSummary.length) {
    addSectionGap(8);
    ensurePdfSpace(164);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('All User Transaction Summary'), marginX, cursorY);
    cursorY += 24;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafeText(
        totalActiveUsers > userSummary.length
          ? `Showing the top ${userSummary.length} active users by transaction count out of ${totalActiveUsers}.`
          : `Showing all ${totalActiveUsers} active users in the selected range.`
      ),
      marginX,
      cursorY
    );
    cursorY += 24;
    userSummary.forEach((item) => {
      const leftLines = [
        pdfSafeText(item.name || 'Unknown user'),
        pdfSafeText(item.email || '')
      ].filter(Boolean);
      const rightLines = [
        pdfSafeText(`${item.transaction_count || 0} txns`),
        pdfSafeText(`In ${formatValue(item.income_total || 0)} - Out ${formatValue(item.expense_total || 0)}`),
        pdfSafeText(`Net ${formatValue(item.net_total || 0)}`)
      ];
      const rightWrapped = rightLines.flatMap((line) => doc.splitTextToSize(line, 200));
      const leftHeight = leftLines.length * 14;
      const rightHeight = rightWrapped.length * 12;
      const boxHeight = Math.max(62, Math.max(leftHeight, rightHeight) + 22);
      ensurePdfSpace(boxHeight + 12);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(marginX, cursorY - 14, 504, boxHeight, 14, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(leftLines[0] || pdfSafeText('Unknown user'), marginX + 14, cursorY + 4);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      if (leftLines[1]) {
        doc.text(leftLines[1], marginX + 14, cursorY + 20);
      }
      doc.text(rightWrapped, marginX + 250, cursorY + 4);
      cursorY += boxHeight + 12;
    });
  }

  if (!document.getElementById('lineChartWrap')?.classList.contains('hidden') && (reportState.monthly || []).length) {
    const lineImage = await renderChartForPdf('line');
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('Growth Trend'), marginX, 48);
    doc.addImage(lineImage, 'PNG', marginX, 72, 500, 250);
  }

  if (!document.getElementById('pieChartWrap')?.classList.contains('hidden') && categories.length) {
    const pieImage = await renderChartForPdf('pie');
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text(pdfSafeText('Spending Mix'), marginX, 48);
    doc.addImage(pieImage, 'PNG', marginX + 30, 78, 430, 300);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(pdfSafeText(`Finly Report - Page ${page} of ${pageCount}`), 44, 820);
  }

  doc.save(meta.pdfFilename);
}

function resetDateFilter() {
  document.getElementById('startDate').value = '';
  document.getElementById('endDate').value = '';
  FinanceUtils.refreshFilterFieldStates();
  syncReportCurrencyContext();
  loadInsights();
  loadMonthlySummary();
  loadCategorySummary();
  updateTrendRangeLabel();
}

(async () => {
  const user = await FinancePages.initSharedPageContext({
    badgeId: 'pageContextBadge',
    adminLabel: 'System Analytics',
    personalLabel: 'Personal View'
  });
  reportsView = user?.role === 'admin' ? 'admin' : 'user';
  setAdminCopy(reportsView === 'admin');
  initReportCurrencySelector();
  syncReportCurrencyContext();
  updateTrendRangeLabel();
  await Promise.all([
    loadInsights(),
    loadMonthlySummary(),
    loadCategorySummary()
  ]);
})();

window.addEventListener('finly:currencychange', () => {
  syncReportCurrencyContext();
  applyDateFilter();
});

window.addEventListener('finly:localechange', () => {
  applyDateFilter();
});
