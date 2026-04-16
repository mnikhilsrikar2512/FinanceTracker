import { apiRequest, clearSession, normalizeDetail, readSession, writeSession } from "./core/api.js";
import { escapeHtml } from "./core/dom.js";
import { formatClock, formatHeaderDate } from "./core/format.js";
import { initTheme, toggleTheme, applyTheme } from "./core/theme.js";
import { loadingState } from "./core/ui.js";
import { adminWorkspace } from "./pages/admin.js";
import { userWorkspace } from "./pages/user.js";

const scriptEl = document.querySelector("script[data-workspace]");
const workspaceType = scriptEl?.dataset.workspace === "admin" ? "admin" : "user";
const workspace = workspaceType === "admin" ? adminWorkspace : userWorkspace;
const root = document.getElementById("workspace-root");
const modalRoot = document.getElementById("modal-root");
const toastRoot = document.getElementById("toast-root");
const SIDEBAR_PREF_KEY = "finly.sidebarCollapsed";
const MOBILE_LAYOUT_QUERY = "(max-width: 760px)";

document.body.classList.add(workspaceType === "admin" ? "workspace-admin" : "workspace-user");
document.body.classList.remove("auth-page");

const state = {
  me: null,
  currentSection: null,
  currentData: null,
  currentPage: null,
  loadingToken: 0,
};

function toast(title, message, tone = "neutral") {
  const node = document.createElement("div");
  node.className = "toast";
  node.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
  if (tone === "success") node.style.borderLeftColor = "var(--success)";
  if (tone === "danger") node.style.borderLeftColor = "var(--danger)";
  if (tone === "warning") node.style.borderLeftColor = "var(--warning)";
  toastRoot.appendChild(node);
  window.setTimeout(() => node.remove(), 3800);
}

function readSidebarPreference() {
  return localStorage.getItem(SIDEBAR_PREF_KEY) === "1";
}

function writeSidebarPreference(value) {
  localStorage.setItem(SIDEBAR_PREF_KEY, value ? "1" : "0");
}

function syncNavState(section = activeSectionFromHash()) {
  document.querySelectorAll("[data-nav]").forEach((link) => {
    const isActive = link.getAttribute("data-nav") === section;
    link.classList.toggle("active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

function updateShellControls() {
  const isCollapsed = document.body.classList.contains("sidebar-collapsed");
  const isDark = document.documentElement.dataset.theme === "dark";

  document.querySelectorAll("[data-action='collapse-sidebar']").forEach((button) => {
    const icon = button.querySelector("[data-sidebar-icon]");
    const label = button.querySelector("[data-sidebar-label]");
    const actionText = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
    if (icon) icon.textContent = isCollapsed ? "▣" : "◧";
    if (label) label.textContent = isCollapsed ? "Expand" : "Collapse";
    button.setAttribute("aria-label", actionText);
    button.setAttribute("title", actionText);
    button.setAttribute("data-tooltip", actionText);
  });

  document.querySelectorAll("[data-action='toggle-theme']").forEach((button) => {
    const icon = button.querySelector("[data-theme-icon]");
    const label = button.querySelector("[data-theme-label]");
    const current = isDark ? "Dark" : "Light";
    const actionText = isDark ? "Switch to light theme" : "Switch to dark theme";
    if (icon) icon.textContent = isDark ? "☾" : "☀";
    if (label) label.textContent = current;
    button.setAttribute("aria-label", actionText);
    button.setAttribute("title", actionText);
    button.setAttribute("data-tooltip", actionText);
  });

  document.querySelectorAll("[data-action='toggle-sidebar']").forEach((button) => {
    button.setAttribute("aria-label", "Open navigation");
    button.setAttribute("title", "Open navigation");
    button.setAttribute("data-tooltip", "Open navigation");
  });

  document.querySelectorAll("[data-action='close-sidebar']").forEach((button) => {
    button.setAttribute("aria-label", "Close navigation");
    button.setAttribute("title", "Close navigation");
    button.setAttribute("data-tooltip", "Close navigation");
  });
}

function syncSidebarState() {
  const collapsed = readSidebarPreference();
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  updateShellControls();
}

function downloadText(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(
      headers
        .map((header) => {
          const value = row[header] ?? "";
          return `"${String(value).replaceAll('"', '""')}"`;
        })
        .join(","),
    );
  });
  return lines.join("\n");
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function inferPopupVariant(content) {
  const body = String(content ?? "");
  if (body.includes("<form") || body.includes("data-form=")) return "form";
  if (body.includes("button-danger") || body.includes("Delete") || body.includes("Remove")) return "confirm";
  return "view";
}

function openModal({ title, content, note = "" }) {
  const variant = inferPopupVariant(content);
  const icon = variant === "form" ? "✎" : variant === "confirm" ? "!" : "i";
  const label = variant === "form" ? "Form" : variant === "confirm" ? "Confirmation" : "Details";
  const describedBy = note ? 'aria-describedby="dialog-note"' : "";

  modalRoot.innerHTML = `
    <section class="popup-window panel" data-popup-variant="${escapeHtml(variant)}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ${describedBy} tabindex="-1">
      <div class="panel-header popup-header">
        <div class="popup-head">
          <span class="popup-icon" aria-hidden="true">${escapeHtml(icon)}</span>
          <div>
            <span class="panel-title">${escapeHtml(label)}</span>
            <h3 id="dialog-title">${escapeHtml(title)}</h3>
            ${note ? `<p class="popup-note" id="dialog-note">${escapeHtml(note)}</p>` : ""}
          </div>
        </div>
        <button type="button" class="button button-secondary button-icon" data-action="close-modal" aria-label="Close dialog">×</button>
      </div>
      <div class="modal-body popup-content">${content}</div>
    </section>
  `;

  modalRoot
    .querySelector(".popup-window")
    ?.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")
    ?.focus?.();

  modalRoot.querySelector("[data-action='close-modal']")?.addEventListener("click", closeModal);
}

function logout(redirect = true) {
  clearSession();
  if (redirect) window.location.href = "./index.html";
}

function activeSectionFromHash() {
  const hash = window.location.hash.replace("#", "").trim();
  return workspace.pages[hash] ? hash : workspace.nav[0].id;
}

function currentPage() {
  const section = activeSectionFromHash();
  return workspace.pages[section];
}

function renderShell() {
  const initialPage = currentPage();
  const initialHelp = initialPage?.help ?? initialPage?.subtitle ?? "Overview and actions for this section.";
  const navItems = workspace.nav
    .map(
      (item) => `
        <a class="nav-link" href="#${escapeHtml(item.id)}" data-nav="${escapeHtml(item.id)}">
          <span class="nav-glyph" aria-hidden="true">${escapeHtml(item.label.slice(0, 1))}</span>
          <span class="nav-label">${escapeHtml(item.label)}</span>
        </a>
      `,
    )
    .join("");

  root.innerHTML = `
    <div class="shell">
      <div class="sidebar-backdrop" data-action="close-sidebar" aria-hidden="true"></div>
      <aside class="sidebar glass-panel">
        <div>
          <div class="sidebar-head-actions">
            <button type="button" class="button button-ghost button-icon mobile-only" data-action="close-sidebar" aria-label="Close navigation">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div class="auth-brand sidebar-brand">
            <span class="brand-mark">${workspace.brand[0]}</span>
            <div class="sidebar-brand-copy">
              <p class="eyebrow">${escapeHtml(workspaceType === "admin" ? "Admin workspace" : "Personal workspace")}</p>
              <h1 class="shell-title">${escapeHtml(workspace.brand)}</h1>
            </div>
          </div>
          <div class="sidebar-nav">
            <div class="sidebar-group">
              ${navItems}
            </div>
          </div>
        </div>
        <div class="sidebar-footer">
          <div class="panel">
            <span class="panel-title">Session</span>
            <strong>${escapeHtml(workspace.contextLabel)}</strong>
            <p class="muted">Currency: INR</p>
          </div>
          <button type="button" class="button button-secondary button-block" data-action="logout">Sign out</button>
        </div>
      </aside>
      <main class="shell-main">
        <header class="topbar glass-panel">
          <div class="topbar-left">
            <button type="button" class="button button-secondary topbar-action button-icon mobile-only" data-action="toggle-sidebar" aria-label="Open navigation">
              <span aria-hidden="true">☰</span>
            </button>
            <button type="button" class="button button-secondary topbar-action desktop-only" data-action="collapse-sidebar" aria-label="Collapse sidebar">
              <span class="topbar-action-icon" data-sidebar-icon aria-hidden="true">◧</span>
              <span class="topbar-action-label" data-sidebar-label>Collapse</span>
            </button>
            <div class="topbar-heading">
              <p class="eyebrow">Workspace</p>
              <div class="workspace-title-row">
                <strong class="workspace-status header-page-title">${escapeHtml(initialPage?.title ?? workspace.contextLabel)}</strong>
                <span class="page-help">
                  <button type="button" class="button button-ghost page-help-button" data-page-help-button aria-label="Page help">i</button>
                  <span class="page-help-popover" data-page-help-text>${escapeHtml(initialHelp)}</span>
                </span>
              </div>
              <span class="workspace-context">${escapeHtml(workspace.contextLabel)}</span>
            </div>
          </div>
          <div class="topbar-right">
            <span class="pill">
              <span>Date</span>
              <strong class="header-date">${escapeHtml(formatHeaderDate(new Date()))}</strong>
            </span>
            <span class="pill">
              <span>Time</span>
              <strong class="header-clock">${escapeHtml(formatClock(new Date()))}</strong>
            </span>
            <button type="button" class="button button-secondary topbar-action topbar-theme-toggle" data-action="toggle-theme" aria-label="Toggle theme">
              <span class="topbar-action-icon" data-theme-icon aria-hidden="true">☾</span>
              <span class="topbar-action-label" data-theme-label>Dark</span>
            </button>
            <div class="pill pill-accent">
              <span>${escapeHtml(state.me?.name ?? "Signed in")}</span>
            </div>
          </div>
        </header>
        <section id="content" class="content-grid">
          ${loadingState("Loading workspace")}
        </section>
      </main>
    </div>
  `;

  document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
        closeSidebarDrawer();
      }
    });
  });

  syncNavState();
  syncSidebarState();
  updateShellControls();
}

async function api(path, options = {}) {
  try {
    return await apiRequest(path, { ...options, token: session.accessToken });
  } catch (error) {
    if (error.status === 401) {
      toast("Session expired", "Please sign in again.", "warning");
      logout(true);
    }
    throw error;
  }
}

let session = readSession();

function makeContext() {
  return {
    me: state.me,
    api,
    toast,
    openModal,
    closeModal,
    logout,
    reload: loadActiveSection,
  };
}

async function bootstrapAuth() {
  initTheme();
  applyTheme(document.documentElement.dataset.theme || "dark");

  if (!session.accessToken) {
    logout(true);
    return false;
  }

  try {
    const meResponse = await api("/users/me", { method: "GET" });
    const me = normalizeDetail(meResponse?.data ?? meResponse ?? {});
    state.me = me;
    writeSession({ accessToken: session.accessToken, user: me, remember: session.storage !== "session" });
    if ((workspaceType === "admin" && String(me.role) !== "admin") || (workspaceType === "user" && String(me.role) === "admin")) {
      window.location.href = String(me.role) === "admin" ? "./admin.html#dashboard" : "./app.html#dashboard";
      return false;
    }
    return true;
  } catch {
    logout(true);
    return false;
  }
}

function toggleSidebarCollapse() {
  const next = !document.body.classList.contains("sidebar-collapsed");
  document.body.classList.toggle("sidebar-collapsed", next);
  writeSidebarPreference(next);
  updateShellControls();
}

function openSidebarDrawer() {
  document.body.classList.add("sidebar-open");
}

function closeSidebarDrawer() {
  document.body.classList.remove("sidebar-open");
}

function toggleSidebarDrawer() {
  if (document.body.classList.contains("sidebar-open")) {
    closeSidebarDrawer();
    return;
  }
  openSidebarDrawer();
}

function pageLoadErrorMessage(error) {
  const status = Number(error?.status || 0);
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 403) return "You do not have permission to view this section.";
  if (status >= 500) return "The server is currently unavailable. Please retry in a moment.";
  if (status > 0) return "We could not load this section right now. Please retry.";
  return "We could not connect to the server. Check your connection and retry.";
}

async function loadActiveSection() {
  const page = currentPage();
  if (!page) return;
  const section = activeSectionFromHash();
  const token = ++state.loadingToken;
  state.currentSection = section;
  state.currentPage = page;
  root.querySelector(".header-page-title")?.replaceChildren(document.createTextNode(page.title || workspace.contextLabel));
  const pageHelpText = page.help ?? page.subtitle ?? "Overview and actions for this section.";
  const helpNode = root.querySelector("[data-page-help-text]");
  if (helpNode) helpNode.textContent = pageHelpText;
  const helpButton = root.querySelector("[data-page-help-button]");
  if (helpButton) helpButton.setAttribute("aria-label", `Page help: ${page.title || "Section"}`);
  const content = document.getElementById("content");
  content.classList.add("content-loading");
  content.innerHTML = loadingState(page.title);
  syncNavState(section);

  const context = makeContext();
  try {
    const data = await page.load(context);
    if (token !== state.loadingToken) return;
    state.currentData = data;
    content.innerHTML = page.render(data, context);
    page.bind?.(content, data, context);
    if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) closeSidebarDrawer();
    requestAnimationFrame(() => content.classList.remove("content-loading"));
    root.querySelector(".header-date").textContent = formatHeaderDate(new Date());
    root.querySelector(".header-clock").textContent = formatClock(new Date());
    bindSharedActions();
  } catch (error) {
    if (token !== state.loadingToken) return;
    content.classList.remove("content-loading");
    content.innerHTML = `
      <section class="panel">
        <div class="empty-state">
          <h4>Could not load ${escapeHtml(page.title)}</h4>
          <p>${escapeHtml(pageLoadErrorMessage(error))}</p>
          <button type="button" class="button button-primary" data-action="retry">Retry</button>
        </div>
      </section>
    `;
    content.querySelector("[data-action='retry']")?.addEventListener("click", loadActiveSection);
  }
}

function bindSharedActions() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-go");
      if (target) window.location.hash = `#${target}`;
    });
  });

  document.querySelectorAll("[data-action='toggle-theme']").forEach((button) => {
    button.onclick = () => {
      const next = toggleTheme();
      updateShellControls();
      toast("Theme updated", `${next === "dark" ? "Dark" : "Light"} mode is now active.`, "success");
    };
  });

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.onclick = () => logout(true);
  });

  document.querySelectorAll("[data-action='collapse-sidebar']").forEach((button) => {
    button.onclick = () => toggleSidebarCollapse();
  });

  document.querySelectorAll("[data-action='toggle-sidebar']").forEach((button) => {
    button.onclick = () => toggleSidebarDrawer();
  });

  document.querySelectorAll("[data-action='close-sidebar']").forEach((button) => {
    button.onclick = () => closeSidebarDrawer();
  });

  document.querySelectorAll("[data-action='refresh']").forEach((button) => {
    button.onclick = () => loadActiveSection();
  });

  document.querySelectorAll("[data-action='export-report']").forEach((button) => {
    button.onclick = () => {
      const payload = state.currentData ?? {};
      if (state.currentSection === "reports") {
        downloadText(`finly-report-${Date.now()}.json`, JSON.stringify(payload, null, 2), "application/json");
        toast("Report exported", "A JSON snapshot downloaded to your device.", "success");
        return;
      }
      toast("Export not available", "This section does not currently expose a downloadable snapshot.", "warning");
    };
  });

  document.querySelectorAll("[data-action='export-transactions']").forEach((button) => {
    button.onclick = () => {
      const rows = state.currentData?.transactions ?? [];
      if (!rows.length) {
        toast("Nothing to export", "Load some transactions first.", "warning");
        return;
      }
      const csv = toCsv(
        rows.map((row) => ({
          id: row.id ?? "",
          description: row.description ?? "",
          category: row.category_name ?? row.category ?? "",
          amount: row.amount ?? "",
          status: row.status ?? "",
          date: row.date ?? "",
        })),
      );
      downloadText(`finly-transactions-${Date.now()}.csv`, csv, "text/csv");
      toast("Transactions exported", "A CSV file has been downloaded.", "success");
    };
  });

}

function bindGlobalEvents() {
  modalRoot.addEventListener("click", (event) => {
    const closeTrigger = event.target instanceof Element ? event.target.closest("[data-action='close-modal']") : null;
    if (closeTrigger) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.target === modalRoot) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalRoot.innerHTML.trim()) {
      closeModal();
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      closeSidebarDrawer();
    }
  });
}

function startClock() {
  const tick = () => {
    const clock = document.querySelector(".header-clock");
    const date = document.querySelector(".header-date");
    if (clock) clock.textContent = formatClock(new Date());
    if (date) date.textContent = formatHeaderDate(new Date());
  };
  tick();
  window.setInterval(tick, 1000);
}

async function main() {
  const ok = await bootstrapAuth();
  if (!ok) return;
  syncSidebarState();
  renderShell();
  bindGlobalEvents();
  bindSharedActions();
  startClock();
  if (!window.location.hash) {
    window.location.hash = `#${activeSectionFromHash()}`;
  }
  requestAnimationFrame(() => {
    root.querySelector("#content")?.classList.add("content-loading");
  });
  await loadActiveSection();
  window.addEventListener("hashchange", loadActiveSection);
}

main();

export { closeModal };
