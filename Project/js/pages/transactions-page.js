(function () {
  if (document.body?.dataset?.page !== "transactions") return;

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  let transactions = [];
  let categories = [];
  const DEFAULT_TXN_SORT = "date_desc";
  let currentFilterState = { sort_by: "date", sort_order: "desc" };
  let quickType = "expense";
  let editingId = null;
  let selectedTxnIds = new Set();
  let pendingTxnActions = {};
  let transactionPagination = {
    limit: 10,
    offset: 0,
    page: 1,
    total_pages: 1,
    has_next: false,
    has_prev: false,
    total: 0
  };
  const urlSearchParams = new URLSearchParams(window.location.search);

  function patchTransactionState(id, updates = {}) {
    transactions = transactions.map((item) => item.id === id ? { ...item, ...updates } : item);
  }

  function clearPendingTxnAction(id) {
    delete pendingTxnActions[id];
    renderTable();
  }

  async function loadCategories() {
    try {
      const response = await FinanceUtils.fetchWithAuth("/categories?include_stats=false");
      if (!response.success) throw new Error(response.error || "Failed to load categories");
      categories = response.data;
      syncFilterCategoryDropdown();
      updateQuickCategoryDropdown();
    } catch (error) {
      console.error("Load categories error:", error);
    }
  }

  function syncFilterCategoryDropdown(selectedCategoryId = null) {
    const filterSelect = document.getElementById("filterCategory");
    const typeSelect = document.getElementById("filterType");
    if (!filterSelect) return;

    const activeType = typeSelect?.value || "";
    const existingValue = selectedCategoryId ?? filterSelect.value ?? currentFilterState.category_id ?? "";
    const filteredCategories = activeType
      ? categories.filter((category) => category.type === activeType)
      : categories;

    filterSelect.innerHTML = '<option value="">All Categories</option>';
    filteredCategories.forEach((category) => {
      filterSelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
    });

    const canKeepSelection = filteredCategories.some((category) => String(category.id) === String(existingValue));
    filterSelect.value = canKeepSelection ? String(existingValue) : "";
    if (!canKeepSelection && currentFilterState.category_id) {
      delete currentFilterState.category_id;
    }
  }

  function updateQuickCategoryDropdown() {
    const select = document.getElementById("quickCategory");
    if (!select) return;
    select.innerHTML = '<option value="">Select Category</option>';
    categories
      .filter((category) => category.type === quickType)
      .forEach((category) => {
        select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
      });
  }

  function setQuickType(type) {
    quickType = type;
    const incomeButton = document.getElementById("quickTypeIncome");
    const expenseButton = document.getElementById("quickTypeExpense");

    if (type === "income") {
      incomeButton.className = "segment-button segment-button-active-blue";
      expenseButton.className = "segment-button";
    } else {
      expenseButton.className = "segment-button segment-button-active-blue";
      incomeButton.className = "segment-button";
    }
    updateQuickCategoryDropdown();
  }

  async function loadTransactions(params = {}) {
    const body = document.getElementById("tableBody");
    body.innerHTML = FinanceUtils.createSkeleton(5);
    try {
      const query = new URLSearchParams({
        ...params,
        limit: transactionPagination.limit,
        offset: transactionPagination.offset
      }).toString();
      const response = await FinanceUtils.fetchWithAuth(`/transactions?${query}`);
      if (!response.success) throw new Error(response.error || "Failed to load transactions");
      if ((response.meta?.total || 0) > 0 && (response.data?.length || 0) === 0 && transactionPagination.offset > 0) {
        transactionPagination.offset = Math.max(0, transactionPagination.offset - transactionPagination.limit);
        return loadTransactions(params);
      }

      transactions = response.data.map((transaction) => ({
        id: transaction.id,
        rawDate: transaction.date || "",
        dateLabel: transaction.date ? FinanceUtils.formatDate(transaction.date) : "",
        category: categories.find((category) => category.id === transaction.category_id)?.name || "Unknown",
        category_id: transaction.category_id,
        desc: transaction.description || "",
        type: categories.find((category) => category.id === transaction.category_id)?.type || "unknown",
        amount: Math.abs(transaction.amount),
        is_deleted: transaction.is_deleted
      }));
      renderTable();
      updateTxnPagination(response.meta || {});
      syncSelectionWithVisibleRows();
    } catch (error) {
      console.error("Load transactions error:", error);
      FinanceUtils.showToast("Failed to load transactions", "error");
      body.innerHTML = FinanceUtils.createStateMarkup({
        title: "Transactions unavailable",
        message: "We could not load your entries right now. Please retry in a moment.",
        tone: "error"
      });
    }
  }

  function updateTxnPagination(meta) {
    transactionPagination = {
      ...transactionPagination,
      ...meta,
      limit: meta.limit ?? transactionPagination.limit,
      offset: meta.offset ?? transactionPagination.offset
    };

    const pageInfo = document.getElementById("txnPageInfo");
    if (pageInfo) {
      pageInfo.textContent = `Page ${transactionPagination.page || 1} of ${transactionPagination.total_pages || 1} • ${transactionPagination.total || 0} transactions`;
    }

    const prevBtn = document.getElementById("txnPrevBtn");
    const nextBtn = document.getElementById("txnNextBtn");
    if (prevBtn) {
      prevBtn.disabled = !transactionPagination.has_prev;
      prevBtn.setAttribute("aria-disabled", String(!transactionPagination.has_prev));
    }
    if (nextBtn) {
      nextBtn.disabled = !transactionPagination.has_next;
      nextBtn.setAttribute("aria-disabled", String(!transactionPagination.has_next));
    }
  }

  function goToTxnPage(direction) {
    if (direction === "prev" && transactionPagination.has_prev) {
      transactionPagination.offset = Math.max(0, transactionPagination.offset - transactionPagination.limit);
      loadTransactions(getServerFilterParamsFromState());
    }
    if (direction === "next" && transactionPagination.has_next) {
      transactionPagination.offset += transactionPagination.limit;
      loadTransactions(getServerFilterParamsFromState());
    }
  }

  function renderTable() {
    const body = document.getElementById("tableBody");
    const visible = transactions;

    if (visible.length === 0) {
      body.innerHTML = FinanceUtils.createStateMarkup({
        title: "No transactions found",
        message: "Try clearing your filters or add a new transaction to get started."
      });
      updateSelectAllControl([]);
      renderBulkActionsBar();
      return;
    }

    body.innerHTML = visible.map((transaction) => {
      if (editingId === transaction.id) {
        return renderEditRow(transaction);
      }

      const isIncome = transaction.type === "income";
      const pendingState = pendingTxnActions[transaction.id] || "";
      const isSelected = selectedTxnIds.has(transaction.id);

      return `
        <div class="list-row flex flex-col gap-4 px-5 py-6 md:flex-row md:items-center md:px-8 group ${pendingState ? "opacity-70" : ""}">
          <div class="w-full md:w-12 flex justify-start md:justify-center pt-1">
            <input type="checkbox" ${isSelected ? "checked" : ""} onchange="toggleTransactionSelection(${transaction.id}, this.checked)" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" aria-label="Select transaction ${transaction.id}">
          </div>
          <div class="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
            <div class="w-14 h-14 rounded-2xl ${isIncome ? "status-dot-positive" : "status-dot-neutral"} flex items-center justify-center text-xl shadow-sm">
              ${isIncome ? "💰" : "💸"}
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <p class="font-bold text-gray-900 dark:text-white text-lg truncate">${transaction.category}</p>
                <span class="badge ${isIncome ? "badge-success" : "bg-gray-100 dark:bg-white/5 text-gray-500"} text-[10px] uppercase font-black tracking-widest px-2 py-0.5">${transaction.type}</span>
                ${transaction.is_deleted ? '<span class="badge badge-danger text-[10px] uppercase font-black tracking-widest px-2 py-0.5">Archived</span>' : ""}
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">${transaction.desc || "-"}</p>
            </div>
          </div>
          <div class="w-full md:w-48 text-left md:text-right">
            <p class="font-bold text-xl" style="color: ${isIncome ? "var(--apple-green)" : "var(--text-main)"};">${FinanceUtils.formatCurrency(transaction.amount)}</p>
            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">${transaction.dateLabel}</p>
          </div>
          <div class="w-full md:w-48 flex justify-start md:justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity md:pl-8">
            <button onclick="startEdit(${transaction.id})" class="action-icon-button" ${(pendingState || transaction.is_deleted) ? "disabled" : ""}>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            ${transaction.is_deleted
              ? `<button onclick="restore(${transaction.id})" class="btn btn-secondary px-4 py-2 text-[10px] uppercase font-bold tracking-widest" ${pendingState ? "disabled" : ""}>${pendingState === "restore" ? "Restoring..." : "Restore"}</button>`
              : `<button onclick="archive(${transaction.id})" class="action-icon-button action-icon-danger" ${pendingState ? "disabled" : ""}>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h14"/></svg>
            </button>`}
            <button onclick="removeForever(${transaction.id})" class="btn btn-secondary px-4 py-2 text-[10px] uppercase font-bold tracking-widest text-red-500" ${pendingState ? "disabled" : ""}>${pendingState === "hard" ? "Deleting..." : "Delete"}</button>
            ${pendingState ? '<span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Working...</span>' : ""}
          </div>
        </div>
      `;
    }).join("");
    updateSelectAllControl(visible);
    renderBulkActionsBar();
  }

  function renderEditRow(transaction) {
    return `
      <div class="surface-accent-blue p-8 animate-in fade-in duration-300 rounded-[22px]">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-10 h-10 rounded-xl accent-icon accent-icon-blue flex items-center justify-center text-sm">
            ✏️
          </div>
          <h3 class="font-bold text-gray-900 dark:text-white">Editing Entry</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          <div>
            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Category</label>
            <select id="editCategory" class="apple-input bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 font-bold text-sm">
              ${categories.filter((category) => category.type === transaction.type).map((category) => `<option value="${category.id}" ${category.id === transaction.category_id ? "selected" : ""}>${category.name}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Amount</label>
            <input id="editAmount" type="number" value="${transaction.amount}" class="apple-input bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 font-bold text-sm">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Description</label>
            <input id="editDesc" value="${transaction.desc}" class="apple-input bg-white dark:bg-gray-800 border border-gray-100 dark:border-white/5 text-sm">
          </div>
          <div class="flex gap-2">
            <button onclick="cancelEdit()" class="btn btn-secondary flex-1 py-3">Cancel</button>
            <button onclick="saveEdit(${transaction.id})" class="btn btn-primary flex-1 py-3">Update</button>
          </div>
        </div>
      </div>
    `;
  }

  function startEdit(id) {
    editingId = id;
    renderTable();
  }

  function cancelEdit() {
    editingId = null;
    renderTable();
  }

  async function saveEdit(id) {
    const categoryId = document.getElementById("editCategory").value;
    const amount = parseFloat(document.getElementById("editAmount").value);
    const description = document.getElementById("editDesc").value;

    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({ category_id: parseInt(categoryId, 10), amount, description })
      });
      if (!response.success) throw new Error(response.error || "Failed to update");
      FinanceUtils.showToast("Updated successfully", "success");
      editingId = null;
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
    }
  }

  async function saveQuickTransaction() {
    const categoryId = document.getElementById("quickCategory").value;
    const amount = parseFloat(document.getElementById("quickAmount").value);
    const description = document.getElementById("quickDesc").value;

    if (!categoryId || Number.isNaN(amount)) {
      FinanceUtils.showToast("Please fill in category and amount", "warning");
      return;
    }

    try {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const response = await FinanceUtils.fetchWithAuth("/transactions", {
        method: "POST",
        body: JSON.stringify({ category_id: parseInt(categoryId, 10), amount, description, date: localDate })
      });
      if (!response.success) throw new Error(response.error || "Failed to save");

      FinanceUtils.showToast("Transaction added", "success");
      document.getElementById("quickAmount").value = "";
      document.getElementById("quickDesc").value = "";
      transactionPagination.offset = 0;
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
    }
  }

  async function archive(id) {
    if (!window.confirm("Archive this transaction? You can restore it later.")) return;
    pendingTxnActions[id] = "soft";
    renderTable();
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}?mode=soft`, { method: "DELETE" });
      if (!response.success) throw new Error(response.error || "Failed to archive");
      patchTransactionState(id, { is_deleted: true });
      FinanceUtils.showToast("Transaction archived", "success");
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
      clearPendingTxnAction(id);
    }
  }

  async function restore(id) {
    pendingTxnActions[id] = "restore";
    renderTable();
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}/restore`, { method: "PUT" });
      if (!response.success) throw new Error(response.error || "Failed to restore");
      patchTransactionState(id, { is_deleted: false });
      FinanceUtils.showToast("Transaction restored", "success");
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
      clearPendingTxnAction(id);
    }
  }

  async function removeForever(id) {
    if (!window.confirm("Permanently delete this transaction? This cannot be undone.")) return;
    pendingTxnActions[id] = "hard";
    renderTable();
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}?mode=hard`, { method: "DELETE" });
      if (!response.success) throw new Error(response.error || "Failed to delete");
      FinanceUtils.showToast("Transaction deleted permanently", "success");
      selectedTxnIds.delete(id);
      transactions = transactions.filter((item) => item.id !== id);
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
      clearPendingTxnAction(id);
    }
  }

  function toggleTransactionSelection(id, checked) {
    if (checked) selectedTxnIds.add(id);
    else selectedTxnIds.delete(id);
    renderBulkActionsBar();
    updateSelectAllControl(transactions);
  }

  function updateSelectAllControl(visibleRows) {
    const selectAll = document.getElementById("selectAllTransactions");
    if (!selectAll) return;
    if (!visibleRows.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const selectedVisible = visibleRows.filter((item) => selectedTxnIds.has(item.id)).length;
    selectAll.checked = selectedVisible > 0 && selectedVisible === visibleRows.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleRows.length;
  }

  function syncSelectionWithVisibleRows() {
    const visibleIds = new Set(transactions.map((item) => item.id));
    selectedTxnIds.forEach((id) => {
      if (!visibleIds.has(id)) selectedTxnIds.delete(id);
    });
    renderBulkActionsBar();
  }

  function toggleSelectAllTransactions(checked) {
    transactions.forEach((item) => {
      if (checked) selectedTxnIds.add(item.id);
      else selectedTxnIds.delete(item.id);
    });
    renderTable();
  }

  function renderBulkActionsBar() {
    const bar = document.getElementById("bulkActionsBar");
    const label = document.getElementById("bulkSelectionLabel");
    if (!bar || !label) return;
    const count = selectedTxnIds.size;
    label.textContent = `${count} selected`;
    if (count === 0) {
      bar.classList.add("hidden");
      bar.classList.remove("flex");
      return;
    }
    bar.classList.remove("hidden");
    bar.classList.add("flex");
  }

  function clearSelection() {
    selectedTxnIds.clear();
    renderTable();
  }

  async function runBulkAction(action) {
    const ids = Array.from(selectedTxnIds);
    if (!ids.length) {
      FinanceUtils.showToast("Select at least one transaction", "warning");
      return;
    }

    const confirmMessage = action === "restore"
      ? "Restore the selected archived transactions?"
      : action === "hard"
        ? "Permanently delete the selected transactions? This cannot be undone."
        : "Archive the selected transactions?";
    if (!window.confirm(confirmMessage)) return;

    ids.forEach((id) => {
      pendingTxnActions[id] = action;
    });
    renderTable();

    try {
      const endpoint = action === "restore"
        ? `/transactions/restore-many?ids=${encodeURIComponent(ids.join(","))}`
        : `/transactions?ids=${encodeURIComponent(ids.join(","))}&mode=${action === "hard" ? "hard" : "soft"}`;
      const method = action === "restore" ? "PUT" : "DELETE";
      const response = await FinanceUtils.fetchWithAuth(endpoint, { method });
      if (!response.success) throw new Error(response.error || "Bulk action failed");
      FinanceUtils.showToast(
        action === "restore" ? "Selected transactions restored" : action === "hard" ? "Selected transactions deleted" : "Selected transactions archived",
        "success"
      );
      if (action === "restore") {
        transactions = transactions.map((item) => selectedTxnIds.has(item.id) ? { ...item, is_deleted: false } : item);
      } else if (action === "soft") {
        transactions = transactions.map((item) => selectedTxnIds.has(item.id) ? { ...item, is_deleted: true } : item);
      } else {
        transactions = transactions.filter((item) => !selectedTxnIds.has(item.id));
      }
      clearSelection();
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
      ids.forEach((id) => delete pendingTxnActions[id]);
      renderTable();
    }
  }

  function bulkArchiveSelected() {
    runBulkAction("soft");
  }

  function bulkRestoreSelected() {
    runBulkAction("restore");
  }

  function bulkDeleteSelected() {
    runBulkAction("hard");
  }

  async function exportTransactions() {
    const params = getServerFilterParamsFromState();
    let endpoint = "/transactions/export?format=csv";
    if (params.type) endpoint += `&type=${encodeURIComponent(params.type)}`;
    if (params.category_id) endpoint += `&category_id=${encodeURIComponent(params.category_id)}`;
    if (params.start_date) endpoint += `&start_date=${encodeURIComponent(params.start_date)}`;
    if (params.end_date) endpoint += `&end_date=${encodeURIComponent(params.end_date)}`;
    await FinanceUtils.downloadFile(endpoint, `transactions_${FinanceUtils.getLocalDateInputValue(new Date())}.csv`);
  }

  function parseSortSelection(value) {
    const [sortBy = "date", sortOrder = "desc"] = String(value || DEFAULT_TXN_SORT).split("_");
    return { sort_by: sortBy, sort_order: sortOrder };
  }

  function getServerFilterParamsFromState() {
    const params = {};
    if (currentFilterState.type) params.type = currentFilterState.type;
    if (currentFilterState.category_id) params.category_id = currentFilterState.category_id;
    if (currentFilterState.search) params.search = currentFilterState.search;
    if (currentFilterState.start_date) params.start_date = currentFilterState.start_date;
    if (currentFilterState.end_date) params.end_date = currentFilterState.end_date;
    params.sort_by = currentFilterState.sort_by || "date";
    params.sort_order = currentFilterState.sort_order || "desc";
    params.archive_filter = currentFilterState.archive_filter || "active";
    return params;
  }

  function applyFilters() {
    const type = document.getElementById("filterType").value;
    const categoryId = document.getElementById("filterCategory").value;
    const search = document.getElementById("search").value.trim();
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;
    const archiveFilter = document.getElementById("archiveFilter").value;
    const sort = parseSortSelection(document.getElementById("sortTransactions").value);
    currentFilterState = { ...sort };
    if (type) currentFilterState.type = type;
    if (categoryId) currentFilterState.category_id = categoryId;
    if (search) currentFilterState.search = search;
    if (startDate) currentFilterState.start_date = FinanceUtils.formatDateForApi(startDate);
    if (endDate) currentFilterState.end_date = FinanceUtils.formatDateForApi(endDate, true);
    currentFilterState.archive_filter = archiveFilter || "active";
    transactionPagination.offset = 0;
    clearSelection();
    FinanceUtils.refreshFilterFieldStates();
    renderActiveFilters();
    loadTransactions(getServerFilterParamsFromState());
  }

  function resetFilters() {
    document.getElementById("filterType").value = "";
    document.getElementById("filterCategory").value = "";
    document.getElementById("search").value = "";
    document.getElementById("filterStartDate").value = "";
    document.getElementById("filterEndDate").value = "";
    document.getElementById("sortTransactions").value = DEFAULT_TXN_SORT;
    document.getElementById("archiveFilter").value = "active";
    currentFilterState = { sort_by: "date", sort_order: "desc", archive_filter: "active" };
    transactionPagination.offset = 0;
    clearSelection();
    FinanceUtils.refreshFilterFieldStates();
    renderActiveFilters();
    loadTransactions(getServerFilterParamsFromState());
  }

  function renderActiveFilters() {
    const bar = document.getElementById("activeFilters");
    const chips = [];
    if (currentFilterState.type) chips.push({ label: `Type: ${currentFilterState.type}` });
    if (currentFilterState.category_id) {
      const category = categories.find((item) => String(item.id) === String(currentFilterState.category_id));
      chips.push({ label: `Category: ${category ? category.name : "?"}` });
    }
    if (currentFilterState.search) chips.push({ label: `Search: ${currentFilterState.search}` });
    if (currentFilterState.start_date) chips.push({ label: `From: ${FinanceUtils.formatDate(currentFilterState.start_date)}` });
    if (currentFilterState.end_date) chips.push({ label: `To: ${FinanceUtils.formatDate(currentFilterState.end_date)}` });
    if (currentFilterState.archive_filter === "archived") chips.push({ label: "Archived only" });
    if (currentFilterState.archive_filter === "all") chips.push({ label: "Active + archived" });
    if ((currentFilterState.sort_by || "date") !== "date" || (currentFilterState.sort_order || "desc") !== "desc") {
      const sortMap = {
        date_asc: "Sort: Oldest first",
        amount_desc: "Sort: Amount high to low",
        amount_asc: "Sort: Amount low to high"
      };
      chips.push({ label: sortMap[`${currentFilterState.sort_by}_${currentFilterState.sort_order}`] || "Sort: Newest first" });
    }

    if (chips.length === 0) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }
    bar.classList.remove("hidden");
    bar.innerHTML = chips.map((chip) => `<span class="filter-chip filter-chip-user">${chip.label}</span>`).join("");
  }

  function initTransactionFiltersFromUrl() {
    const search = urlSearchParams.get("search");
    const startDate = urlSearchParams.get("start_date");
    const endDate = urlSearchParams.get("end_date");
    const sortBy = urlSearchParams.get("sort_by");
    const sortOrder = urlSearchParams.get("sort_order");
    const type = urlSearchParams.get("type");
    const categoryId = urlSearchParams.get("category_id");
    const params = { sort_by: "date", sort_order: "desc" };

    if (type) {
      const typeSelect = document.getElementById("filterType");
      if (typeSelect) typeSelect.value = type;
      params.type = type;
    }

    syncFilterCategoryDropdown(categoryId);
    if (categoryId) {
      const categorySelect = document.getElementById("filterCategory");
      if (categorySelect && categorySelect.value) {
        params.category_id = categorySelect.value;
      }
    }

    if (search) {
      const searchInput = document.getElementById("search");
      if (searchInput) searchInput.value = search;
      params.search = search;
    }

    if (startDate) {
      const startInput = document.getElementById("filterStartDate");
      if (startInput) startInput.value = startDate.slice(0, 10);
      params.start_date = FinanceUtils.formatDateForApi(startDate.slice(0, 10));
    }

    if (endDate) {
      const endInput = document.getElementById("filterEndDate");
      if (endInput) endInput.value = endDate.slice(0, 10);
      params.end_date = FinanceUtils.formatDateForApi(endDate.slice(0, 10), true);
    }

    if (sortBy || sortOrder) {
      params.sort_by = sortBy || "date";
      params.sort_order = sortOrder || "desc";
    }

    const sortSelect = document.getElementById("sortTransactions");
    if (sortSelect) {
      sortSelect.value = `${params.sort_by}_${params.sort_order}`;
    }

    FinanceUtils.refreshFilterFieldStates();
    const archiveFilter = urlSearchParams.get("archive_filter");
    const includeArchived = urlSearchParams.get("include_deleted");
    if (archiveFilter && ["active", "archived", "all"].includes(archiveFilter)) {
      params.archive_filter = archiveFilter;
    } else if (includeArchived === "true") {
      params.archive_filter = "all";
    }
    const archiveFilterSelect = document.getElementById("archiveFilter");
    if (archiveFilterSelect) archiveFilterSelect.value = params.archive_filter || "active";

    currentFilterState = params;
    renderActiveFilters();
  }

  document.getElementById("txnPageSize").addEventListener("change", function (event) {
    transactionPagination.limit = parseInt(event.target.value, 10);
    transactionPagination.offset = 0;
    loadTransactions(getServerFilterParamsFromState());
  });

  document.getElementById("filterType").addEventListener("change", function () {
    syncFilterCategoryDropdown();
    FinanceUtils.refreshFilterFieldStates();
  });

  document.getElementById("selectAllTransactions").addEventListener("change", function (event) {
    toggleSelectAllTransactions(event.target.checked);
  });

  window.setQuickType = setQuickType;
  window.goToTxnPage = goToTxnPage;
  window.startEdit = startEdit;
  window.cancelEdit = cancelEdit;
  window.saveEdit = saveEdit;
  window.saveQuickTransaction = saveQuickTransaction;
  window.archive = archive;
  window.restore = restore;
  window.removeForever = removeForever;
  window.toggleTransactionSelection = toggleTransactionSelection;
  window.bulkArchiveSelected = bulkArchiveSelected;
  window.bulkRestoreSelected = bulkRestoreSelected;
  window.bulkDeleteSelected = bulkDeleteSelected;
  window.clearSelection = clearSelection;
  window.exportTransactions = exportTransactions;
  window.applyFilters = applyFilters;
  window.resetFilters = resetFilters;

  loadCategories().then(() => {
    initTransactionFiltersFromUrl();
    return loadTransactions(getServerFilterParamsFromState());
  });

  window.addEventListener("finly:currencychange", () => {
    loadTransactions(getServerFilterParamsFromState());
  });

  window.addEventListener("finly:localechange", () => {
    loadTransactions(getServerFilterParamsFromState());
  });
})();
