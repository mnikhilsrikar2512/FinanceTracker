const token = localStorage.getItem("token");
if (!token) {
  window.location.href = "login.html";
}

let budgets = [];
let categories = [];
let editingId = null;

function budgetTone(percent, isOver) {
  if (isOver) {
    return {
      progress: 'var(--apple-red)',
      text: 'var(--apple-red)',
      label: 'Over Budget'
    };
  }
  if (percent > 85) {
    return {
      progress: 'var(--apple-amber)',
      text: 'var(--apple-amber)',
      label: 'Watch Closely'
    };
  }
  return {
    progress: 'var(--apple-blue)',
    text: 'var(--apple-green)',
    label: 'On Track'
  };
}

async function loadCategories() {
  try {
    const res = await FinanceUtils.fetchWithAuth('/categories?include_stats=false');
    if (!res.success) throw new Error(res.error || 'Failed to load categories');
    categories = res.data.filter(c => c.type === 'expense');

    const select = document.getElementById('budgetCategory');
    if (!select) return;
    select.innerHTML = '<option value="">Select Category</option>';
    categories.forEach(c => {
      select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
  } catch (err) {
    console.error('Load categories error:', err);
  }
}

async function loadBudgets() {
  const list = document.getElementById('budgetList');
  list.innerHTML = FinanceUtils.createSkeleton(4);

  try {
    const summaryRes = await FinanceUtils.fetchWithAuth('/budgets/summary');
    const budgetsRes = await FinanceUtils.fetchWithAuth('/budgets');

    if (!summaryRes.success || !budgetsRes.success) throw new Error('Failed to load data');

    budgets = budgetsRes.data;
    const summaryData = summaryRes.data;

    let totalBudget = 0;
    let totalSpent = 0;
    summaryData.forEach(item => {
      totalBudget += item.amount;
      totalSpent += item.spent;
    });

    document.getElementById('totalBudget').textContent = FinanceUtils.formatCurrency(totalBudget);
    document.getElementById('totalSpent').textContent = FinanceUtils.formatCurrency(totalSpent);
    document.getElementById('totalRemaining').textContent = FinanceUtils.formatCurrency(Math.max(0, totalBudget - totalSpent));

    renderBudgets(summaryData);
  } catch (err) {
    console.error('Load budgets error:', err);
    FinanceUtils.showToast('Failed to load budgets', 'error');
    list.innerHTML = FinanceUtils.createStateMarkup({
      title: 'Budgets unavailable',
      message: 'We could not load your budget summary right now.',
      tone: 'error'
    });
  }
}

function renderBudgets(summaryData) {
  const list = document.getElementById('budgetList');

  if (budgets.length === 0) {
    list.className = "block";
    list.innerHTML = FinanceUtils.createStateMarkup({
      title: 'No active budgets',
      message: 'Set a budget for an expense category to start tracking progress.'
    });
    return;
  }

  list.className = "grid grid-cols-1 md:grid-cols-2 gap-8";
  list.innerHTML = budgets.map((budget) => {
    if (editingId === budget.id) return renderEditCard(budget);

    const summary = summaryData.find(s => s.budget_id === budget.id);
    const spent = summary ? summary.spent : 0;
    const remaining = summary ? summary.remaining : budget.amount;
    const percentage = summary ? Math.min(summary.percentage_used, 100) : 0;
    const isOver = summary ? summary.is_over_budget : false;
    const tone = budgetTone(percentage, isOver);

    const category = categories.find(c => c.id === budget.category_id);
    const catName = category ? category.name : 'General';

    return `
      <div class="apple-card p-8 group transition-all duration-300 hover:scale-[1.02]">
        <div class="flex justify-between items-start mb-8">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl" style="background: rgba(0, 122, 255, 0.08); color: var(--apple-blue); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
              ${isOver ? '!' : '📦'}
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-white">${catName}</h3>
              <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">${budget.period}</p>
            </div>
          </div>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="startEdit(${budget.id})" class="action-icon-button" aria-label="Edit budget">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="remove(${budget.id})" class="action-icon-button action-icon-danger" aria-label="Delete budget">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14"/></svg>
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <div class="flex justify-between items-end gap-4">
            <div>
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Spent</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">${FinanceUtils.formatCurrency(spent)} <span class="text-sm text-gray-400 font-medium">/ ${FinanceUtils.formatCurrency(budget.amount)}</span></p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
              <p class="text-sm font-bold" style="color: ${tone.text};">${tone.label}</p>
            </div>
          </div>

          <div class="progress-container h-3">
            <div class="progress-fill" style="width: ${percentage}%; background: ${tone.progress};"></div>
          </div>

          <div class="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>${Math.round(percentage)}% used</span>
            <span>${FinanceUtils.formatCurrency(Math.max(0, remaining))} remaining</span>
          </div>
        </div>

        <div class="mt-8 pt-6 border-t border-gray-50 dark:border-white/5">
          <p class="text-xs text-gray-500 dark:text-gray-400 italic font-medium">"${budget.description || 'No notes for this budget'}"</p>
        </div>
      </div>
    `;
  }).join('');
}

function renderEditCard(budget) {
  return `
    <div class="apple-card p-8 surface-accent-blue animate-in zoom-in-95 duration-200">
      <h3 class="font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <span class="accent-icon">✏️</span>
        Edit Budget
      </h3>
      <div class="space-y-6">
        <div>
          <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Limit Amount</label>
          <input id="editAmount" type="number" value="${budget.amount}" class="apple-input bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 font-bold">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Goal / Note</label>
          <input id="editDesc" value="${budget.description || ''}" class="apple-input bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5">
        </div>
        <div class="flex gap-3 pt-2">
          <button onclick="cancelEdit()" class="btn btn-secondary flex-1">Cancel</button>
          <button onclick="saveEdit(${budget.id})" class="btn btn-primary flex-1 shadow-lg shadow-blue-500/20">Update</button>
        </div>
      </div>
    </div>
  `;
}

function startEdit(id) {
  editingId = id;
  loadBudgets();
}

function cancelEdit() {
  editingId = null;
  loadBudgets();
}

async function saveBudget() {
  const categoryId = document.getElementById('budgetCategory').value;
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  const description = document.getElementById('budgetDescription').value.trim();

  if (!categoryId || Number.isNaN(amount)) {
    FinanceUtils.showToast("Category and amount are required", "warning");
    return;
  }

  try {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const res = await FinanceUtils.fetchWithAuth('/budgets', {
      method: 'POST',
      body: JSON.stringify({
        category_id: parseInt(categoryId, 10),
        amount,
        description: description || null,
        period: 'monthly',
        start_date: startDate,
        end_date: endDate
      })
    });
    if (!res.success) throw new Error(res.error || 'Failed to save');

    FinanceUtils.showToast('Budget created', 'success');
    document.getElementById('budgetAmount').value = '';
    document.getElementById('budgetDescription').value = '';
    await loadBudgets();
  } catch (err) {
    FinanceUtils.showToast(err.message, 'error');
  }
}

async function saveEdit(id) {
  const amount = parseFloat(document.getElementById('editAmount').value);
  const description = document.getElementById('editDesc').value.trim();

  try {
    const res = await FinanceUtils.fetchWithAuth(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ amount, description: description || null })
    });
    if (!res.success) throw new Error(res.error || 'Failed to update');
    FinanceUtils.showToast('Budget updated', 'success');
    editingId = null;
    await loadBudgets();
  } catch (err) {
    FinanceUtils.showToast(err.message, 'error');
  }
}

async function remove(id) {
  if (!confirm('Delete this budget?')) return;
  try {
    const res = await FinanceUtils.fetchWithAuth(`/budgets/${id}`, { method: 'DELETE' });
    if (!res.success) throw new Error(res.error || 'Failed to delete');
    FinanceUtils.showToast('Budget deleted', 'success');
    await loadBudgets();
  } catch (err) {
    FinanceUtils.showToast(err.message, 'error');
  }
}

(async () => {
  await FinancePages.initSharedPageContext({
    badgeId: 'pageContextBadge',
    context: 'personal',
    personalLabel: 'Personal Budgeting'
  });
  await loadCategories();
  await loadBudgets();
})();
