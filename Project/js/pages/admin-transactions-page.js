(function () {
  if (document.body?.dataset?.page !== "admin-transactions") return;

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  let transactions = [];
  let categories = [];
  let currentFilterState = { sort_by: "date", sort_order: "desc" };
  let pendingTxnActions = {};
  let txnPagination = {
    limit: 20,
    offset: 0,
    page: 1,
    total_pages: 1,
    has_next: false,
    has_prev: false,
    total: 0
  };
  let selectedTxnIds = new Set();

  function patchTransactionState(id, updates = {}) {
    transactions = transactions.map((item) => item.id === id ? { ...item, ...updates } : item);
  }

  function clearPendingTxnAction(id) {
    delete pendingTxnActions[id];
    renderTable(transactions);
  }

  function syncSelectionWithRows() {
    const visibleIds = new Set(transactions.map((item) => item.id));
    selectedTxnIds.forEach((id) => {
      if (!visibleIds.has(id)) selectedTxnIds.delete(id);
    });
  }

  async function loadCategories() {
    try {
      const response = await FinanceUtils.fetchWithAuth("/categories?include_stats=false");
      if (!response.success) throw new Error(response.error || "Failed to load categories");
      categories = response.data;
      const select = document.getElementById("categoryFilter");
      select.innerHTML = '<option value="">All Categories</option>';
      categories.forEach((category) => {
        select.innerHTML += `<option value="${category.id}">${category.name}</option>`;
      });
    } catch (error) {
      console.error("Load categories error:", error);
    }
  }

  async function loadTransactions(params = {}) {
    const table = document.getElementById("txnTable");
    table.innerHTML = FinanceUtils.createSkeleton(5);
    try {
      const queryParams = new URLSearchParams({
        include_deleted: "true",
        ...params,
        limit: txnPagination.limit,
        offset: txnPagination.offset
      });
      const response = await FinanceUtils.fetchWithAuth(`/transactions?${queryParams.toString()}`);
      if (!response.success) throw new Error(response.error || "Failed to load transactions");

      const enrichedTransactions = response.data.map((transaction) => {
        const category = categories.find((item) => item.id === transaction.category_id);
        return {
          ...transaction,
          category_name: transaction.category_name || (category ? category.name : "Unknown"),
          type: transaction.type || (category ? category.type : "unknown"),
          user_email: transaction.user_email || `User ${transaction.user_id}`,
          user_name: transaction.user_name || "",
          user_id: transaction.user_id
        };
      });
      transactions = enrichedTransactions;
      syncSelectionWithRows();
      renderTable(transactions);
      updateTxnPagination(response.meta || {});
    } catch (error) {
      console.error("Load transactions error:", error);
      FinanceUtils.showToast("Failed to load transactions", "error");
      table.innerHTML = FinanceUtils.createTableMessageRow(7, {
        title: "Transactions unavailable",
        message: "We could not load system transactions right now.",
        tone: "error"
      });
    }
  }

  function updateTxnPagination(meta) {
    txnPagination = {
      ...txnPagination,
      ...meta,
      limit: meta.limit ?? txnPagination.limit,
      offset: meta.offset ?? txnPagination.offset
    };

    const pageInfo = document.getElementById("txnPageInfo");
    if (pageInfo) {
      pageInfo.textContent = `Page ${txnPagination.page || 1} of ${txnPagination.total_pages || 1} • ${txnPagination.total || 0} transactions`;
    }
    const prevBtn = document.getElementById("txnPrevBtn");
    const nextBtn = document.getElementById("txnNextBtn");
    if (prevBtn) {
      prevBtn.disabled = !txnPagination.has_prev;
      prevBtn.setAttribute("aria-disabled", String(!txnPagination.has_prev));
    }
    if (nextBtn) {
      nextBtn.disabled = !txnPagination.has_next;
      nextBtn.setAttribute("aria-disabled", String(!txnPagination.has_next));
    }
  }

  function goToTxnPage(direction) {
    if (direction === "prev" && txnPagination.has_prev) {
      txnPagination.offset = Math.max(0, txnPagination.offset - txnPagination.limit);
      loadTransactions(getServerFilterParamsFromState());
    }
    if (direction === "next" && txnPagination.has_next) {
      txnPagination.offset += txnPagination.limit;
      loadTransactions(getServerFilterParamsFromState());
    }
  }

  function renderTable(data = transactions) {
    const table = document.getElementById("txnTable");
    table.innerHTML = "";
    if (data.length === 0) {
      table.innerHTML = FinanceUtils.createTableMessageRow(7, {
        title: "No transactions found",
        message: "Adjust your audit filters to broaden the results.",
        compact: true
      });
      updateSelectAllControl([]);
      renderBulkActionsBar();
      return;
    }

    data.forEach((transaction) => {
      const isIncome = transaction.amount > 0;
      const pendingState = pendingTxnActions[transaction.id] || "";
      const isSelected = selectedTxnIds.has(transaction.id);
      table.innerHTML += `
        <tr class="list-row group ${pendingState ? "opacity-70" : ""}">
          <td class="p-6 text-center">
            <input type="checkbox" ${isSelected ? "checked" : ""} onchange="toggleTransactionSelection(${transaction.id}, this.checked)" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" aria-label="Select transaction ${transaction.id}">
          </td>
          <td class="p-6 text-[11px] font-bold text-gray-400 uppercase tracking-tight">${transaction.date ? FinanceUtils.formatDate(transaction.date) : ""}</td>
          <td class="p-6">
            <p class="font-bold text-gray-900 dark:text-white">${transaction.user_email || "System"}</p>
            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 truncate max-w-[200px]">${transaction.description || "-"}</p>
          </td>
          <td class="p-6">
            <span class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-full border border-gray-200 dark:border-white/10">${transaction.category_name}</span>
          </td>
          <td class="p-6">
            <span class="badge ${transaction.is_deleted ? "badge-danger" : "badge-success"} text-[10px] uppercase font-black tracking-widest px-3">
              ${transaction.is_deleted ? "Archived" : "Active"}
            </span>
          </td>
          <td class="p-6 text-right font-black text-lg" style="color: ${isIncome ? "var(--apple-green)" : "var(--text-main)"};">
            ${FinanceUtils.formatCurrency(Math.abs(transaction.amount))}
          </td>
          <td class="p-6 text-right">
            <div class="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onclick="viewTxn(${transaction.id})" class="btn btn-secondary px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest" ${pendingState ? "disabled" : ""}>View</button>
              <button onclick="restoreTxn(${transaction.id})" class="btn btn-secondary text-blue-600 px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest" ${(!transaction.is_deleted || pendingState) ? "disabled" : ""}>${pendingState === "restore" ? "Restoring..." : "Restore"}</button>
              <button onclick="softDelete(${transaction.id})" class="btn btn-secondary text-amber-600 px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest" ${(transaction.is_deleted || pendingState) ? "disabled" : ""}>${pendingState === "soft" ? "Archiving..." : "Archive"}</button>
              <button onclick="hardDelete(${transaction.id})" class="btn btn-secondary text-red-500 px-4 py-1.5 text-[10px] uppercase font-bold tracking-widest" ${pendingState ? "disabled" : ""}>${pendingState === "hard" ? "Deleting..." : "Delete"}</button>
            </div>
          </td>
        </tr>
      `;
    });
    updateSelectAllControl(data);
    renderBulkActionsBar();
  }

  function applyFilters() {
    const type = document.getElementById("typeFilter").value;
    const categoryId = document.getElementById("categoryFilter").value;
    const min = document.getElementById("minAmount").value;
    const max = document.getElementById("maxAmount").value;
    const search = document.getElementById("userFilter").value.trim();
    const [sortBy = "date", sortOrder = "desc"] = document.getElementById("sortTransactions").value.split("_");
    currentFilterState = { sort_by: sortBy, sort_order: sortOrder };
    if (type) currentFilterState.type = type;
    if (categoryId) currentFilterState.category_id = categoryId;
    if (min) currentFilterState.min_amount = min;
    if (max) currentFilterState.max_amount = max;
    if (search) currentFilterState.search = search;
    txnPagination.offset = 0;
    FinanceUtils.refreshFilterFieldStates();
    renderActiveFilters();
    loadTransactions(getServerFilterParamsFromState());
  }

  function getServerFilterParamsFromState() {
    const params = {
      sort_by: currentFilterState.sort_by || "date",
      sort_order: currentFilterState.sort_order || "desc"
    };
    if (currentFilterState.search) params.search = currentFilterState.search;
    if (currentFilterState.type) params.type = currentFilterState.type;
    if (currentFilterState.category_id) params.category_id = currentFilterState.category_id;
    if (currentFilterState.min_amount) params.min_amount = currentFilterState.min_amount;
    if (currentFilterState.max_amount) params.max_amount = currentFilterState.max_amount;
    return params;
  }

  function renderActiveFilters() {
    const bar = document.getElementById("activeTxnFilters");
    const chips = [];
    if (currentFilterState.search) chips.push(`Search: ${currentFilterState.search}`);
    if (currentFilterState.type) chips.push(`Type: ${currentFilterState.type}`);
    if (currentFilterState.category_id) {
      const category = categories.find((item) => String(item.id) === String(currentFilterState.category_id));
      chips.push(`Category: ${category ? category.name : "?"}`);
    }
    if (currentFilterState.min_amount) chips.push(`Min: ${FinanceUtils.formatCurrency(Number(currentFilterState.min_amount))}`);
    if (currentFilterState.max_amount) chips.push(`Max: ${FinanceUtils.formatCurrency(Number(currentFilterState.max_amount))}`);
    if ((currentFilterState.sort_by || "date") !== "date" || (currentFilterState.sort_order || "desc") !== "desc") {
      const sortMap = {
        date_asc: "Sort: Oldest first",
        amount_desc: "Sort: Amount high to low",
        amount_asc: "Sort: Amount low to high"
      };
      chips.push(sortMap[`${currentFilterState.sort_by}_${currentFilterState.sort_order}`] || "Sort: Newest first");
    }

    if (chips.length === 0) {
      bar.classList.add("hidden");
      bar.innerHTML = "";
      return;
    }

    bar.classList.remove("hidden");
    bar.innerHTML = chips.map((label) => `<span class="filter-chip filter-chip-admin">${label}</span>`).join("");
  }

  function resetFilters() {
    document.getElementById("userFilter").value = "";
    document.getElementById("typeFilter").value = "";
    document.getElementById("categoryFilter").value = "";
    document.getElementById("minAmount").value = "";
    document.getElementById("maxAmount").value = "";
    document.getElementById("sortTransactions").value = "date_desc";
    currentFilterState = { sort_by: "date", sort_order: "desc" };
    txnPagination.offset = 0;
    clearSelection();
    FinanceUtils.refreshFilterFieldStates();
    renderActiveFilters();
    loadTransactions(getServerFilterParamsFromState());
  }

  async function viewTxn(id) {
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}`);
      if (!response.success) throw new Error(response.error || "Failed to load transaction");
      const transaction = response.data;
      const category = categories.find((item) => item.id === transaction.category_id);
      document.getElementById("txnDetails").innerHTML = `
        <div class="grid grid-cols-2 gap-4">
          <div><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">User</p><p class="font-bold text-gray-900 dark:text-white">${transaction.user_email || `#${transaction.user_id}`}</p></div>
          <div><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p><p class="font-bold text-gray-900 dark:text-white">${FinanceUtils.formatDate(transaction.date, "long")}</p></div>
          <div><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Category</p><p class="font-bold text-gray-900 dark:text-white">${category ? category.name : "Unknown"}</p></div>
          <div><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p><p class="font-bold text-gray-900 dark:text-white">${transaction.is_deleted ? "Archived" : "Active"}</p></div>
          <div class="col-span-2"><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description</p><p class="font-bold text-gray-900 dark:text-white">${transaction.description || "-"}</p></div>
          <div class="col-span-2 pt-4 border-t border-gray-100 dark:border-white/5"><p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Amount</p><p class="text-3xl font-black text-gray-900 dark:text-white">${FinanceUtils.formatCurrency(Math.abs(transaction.amount))}</p></div>
        </div>
      `;
      FinanceUtils.openModal("txnModal");
    } catch (error) {
      console.error("View transaction error:", error);
      FinanceUtils.showToast(error.message, "error");
    }
  }

  function closeTxnModal() {
    FinanceUtils.closeModal("txnModal");
  }

  async function softDelete(id) {
    if (!window.confirm("Archive this transaction?")) return;
    pendingTxnActions[id] = "soft";
    renderTable(transactions);
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}?mode=soft`, { method: "DELETE" });
      if (!response.success) throw new Error(response.error || "Failed to archive");
      patchTransactionState(id, { is_deleted: true });
      FinanceUtils.showToast("Transaction archived successfully", "success");
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      console.error("Soft delete error:", error);
      FinanceUtils.showToast(error.message, "error");
      clearPendingTxnAction(id);
    }
  }

  async function restoreTxn(id) {
    pendingTxnActions[id] = "restore";
    renderTable(transactions);
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}/restore`, { method: "PUT" });
      if (!response.success) throw new Error(response.error || "Failed to restore");
      patchTransactionState(id, { is_deleted: false });
      FinanceUtils.showToast("Transaction restored successfully", "success");
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      console.error("Restore transaction error:", error);
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

  function updateSelectAllControl(rows) {
    const selectAll = document.getElementById("selectAllAdminTransactions");
    if (!selectAll) return;
    if (!rows.length) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
      return;
    }
    const selectedVisible = rows.filter((item) => selectedTxnIds.has(item.id)).length;
    selectAll.checked = selectedVisible > 0 && selectedVisible === rows.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < rows.length;
  }

  function renderBulkActionsBar() {
    const bar = document.getElementById("adminBulkActionsBar");
    const label = document.getElementById("adminBulkSelectionLabel");
    if (!bar || !label) return;
    const count = selectedTxnIds.size;
    label.textContent = `${count} selected`;
    if (!count) {
      bar.classList.add("hidden");
      bar.classList.remove("flex");
      return;
    }
    bar.classList.remove("hidden");
    bar.classList.add("flex");
  }

  function clearSelection() {
    selectedTxnIds.clear();
    renderTable(transactions);
  }

  function toggleSelectAllTransactions(checked) {
    transactions.forEach((item) => {
      if (checked) selectedTxnIds.add(item.id);
      else selectedTxnIds.delete(item.id);
    });
    renderTable(transactions);
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
    renderTable(transactions);

    try {
      const endpoint = action === "restore"
        ? `/transactions/restore-many?ids=${encodeURIComponent(ids.join(","))}`
        : `/transactions?ids=${encodeURIComponent(ids.join(","))}&mode=${action === "hard" ? "hard" : "soft"}`;
      const method = action === "restore" ? "PUT" : "DELETE";
      const response = await FinanceUtils.fetchWithAuth(endpoint, { method });
      if (!response.success) throw new Error(response.error || "Bulk action failed");
      if (action === "restore") {
        transactions = transactions.map((item) => selectedTxnIds.has(item.id) ? { ...item, is_deleted: false } : item);
      } else if (action === "soft") {
        transactions = transactions.map((item) => selectedTxnIds.has(item.id) ? { ...item, is_deleted: true } : item);
      } else {
        transactions = transactions.filter((item) => !selectedTxnIds.has(item.id));
      }
      FinanceUtils.showToast(
        action === "restore" ? "Selected transactions restored" : action === "hard" ? "Selected transactions deleted" : "Selected transactions archived",
        "success"
      );
      clearSelection();
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      FinanceUtils.showToast(error.message, "error");
      ids.forEach((id) => delete pendingTxnActions[id]);
      renderTable(transactions);
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

  async function hardDelete(id) {
    if (!window.confirm("Permanently delete this transaction?")) return;
    pendingTxnActions[id] = "hard";
    renderTable(transactions);
    try {
      const response = await FinanceUtils.fetchWithAuth(`/transactions/${id}?mode=hard`, { method: "DELETE" });
      if (!response.success) throw new Error(response.error || "Failed to delete");
      transactions = transactions.filter((item) => item.id !== id);
      FinanceUtils.showToast("Transaction deleted successfully", "success");
      clearPendingTxnAction(id);
      await loadTransactions(getServerFilterParamsFromState());
    } catch (error) {
      console.error("Hard delete error:", error);
      FinanceUtils.showToast(error.message, "error");
      clearPendingTxnAction(id);
    }
  }

  document.getElementById("txnModal").addEventListener("click", function (event) {
    if (event.target.id === "txnModal") closeTxnModal();
  });

  document.getElementById("userFilter").addEventListener("keydown", function (event) {
    if (event.key === "Enter") applyFilters();
  });

  document.getElementById("txnPageSize").addEventListener("change", function (event) {
    txnPagination.limit = parseInt(event.target.value, 10);
    txnPagination.offset = 0;
    loadTransactions(getServerFilterParamsFromState());
  });

  document.getElementById("selectAllAdminTransactions").addEventListener("change", function (event) {
    toggleSelectAllTransactions(event.target.checked);
  });

  window.goToTxnPage = goToTxnPage;
  window.applyFilters = applyFilters;
  window.resetFilters = resetFilters;
  window.viewTxn = viewTxn;
  window.closeTxnModal = closeTxnModal;
  window.softDelete = softDelete;
  window.restoreTxn = restoreTxn;
  window.toggleTransactionSelection = toggleTransactionSelection;
  window.bulkArchiveSelected = bulkArchiveSelected;
  window.bulkRestoreSelected = bulkRestoreSelected;
  window.bulkDeleteSelected = bulkDeleteSelected;
  window.clearSelection = clearSelection;
  window.hardDelete = hardDelete;

  FinanceUtils.checkAdmin().then(async (isAdmin) => {
    if (!isAdmin) return;
    await loadCategories();
    renderActiveFilters();
    await loadTransactions(getServerFilterParamsFromState());
  });

  window.addEventListener("finly:currencychange", () => {
    loadTransactions(getServerFilterParamsFromState());
  });

  window.addEventListener("finly:localechange", () => {
    loadTransactions(getServerFilterParamsFromState());
  });
})();
