import { apiRequest, clearSession, normalizeDetail, readSession, writeSession } from "./core/api.js";
import { escapeHtml } from "./core/dom.js";
import { formatClock, formatHeaderDate } from "./core/format.js";
import { initTheme, applyTheme } from "./core/theme.js";
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

const CHATBOT_ENABLED = false;
const state = {
  me: null,
  currentSection: null,
  currentData: null,
  currentPage: null,
  loadingToken: 0,
  // chatbot integration has been disabled to revert to built-in/static responses
};

const CHATBOT_ENDPOINT = "/assistant/chat";
const CHATBOT_ENDPOINT_KEY = "finly.chatbot.endpoint";
const CHATBOT_TENANT_KEY = "finly.chatbot.tenantId";
const CHATBOT_TOKEN_KEY = "finly.chatbot.authToken";
const CHATBOT_SESSION_KEY = "finly.chatbot.sessionId";
const CHATBOT_STRICT_KEY = "finly.chatbot.strictGrounding";
const CHATBOT_VERBOSE_KEY = "finly.chatbot.verbose";
const CHATBOT_STREAM_KEY = "finly.chatbot.stream";
const CHATBOT_HISTORY_KEY_PREFIX = "finly.chatbot.history";
const CHATBOT_MAX_MESSAGES = 40;

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
  ${CHATBOT_ENABLED ? `
    <!-- chatbot UI removed; reverting to no built-in chatbot UI -->
  ` : ""}
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

  // Lightweight logo adornment for chatbot header (option 1)
  try {
    const panelTitleEl = root.querySelector(".chatbot-head .panel-title");
    if (panelTitleEl) {
      panelTitleEl.insertAdjacentHTML(
        "afterbegin",
        `<span class=\"cb-logo\" aria-label=\"Finly chatbot logo\"><img src=\"/assets/chatbot-logo.svg\" alt=\"Finly logo\" width=\"20\" height=\"20\" style=\"vertical-align:middle; margin-right:6px;\" onerror=\"this.onerror=null; this.src=\"data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"20\\\" height=\\\"20\\\" viewBox=\\\"0 0 24 24\\\" fill=\\\"none\\\" stroke=\\\"currentColor\\\" stroke-width=\\\"2\\\"><path d=\\\"M4 7h12a4 4 0 0 1 0 8H6l-4 4V7z\\\"/><circle cx=\\\"18\\\" cy=\\\"9\\\" r=\\\"1\\\" fill=\\\"currentColor\\\"/></svg>\"\""/>
        Finly Assistant`
      );
    }
  } catch {
    // ignore if chatbot header isn't present
  }

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

function chatbotElements() {
  return {
    shell: root.querySelector("[data-chatbot-shell]"),
    panel: root.querySelector("[data-chatbot-panel]"),
    toggle: root.querySelector("[data-chatbot-toggle]"),
    close: root.querySelector("[data-chatbot-close]"),
    clear: root.querySelector("[data-chatbot-clear]"),
    status: root.querySelector("[data-chatbot-status]"),
    messages: root.querySelector("[data-chatbot-messages]"),
    form: root.querySelector("[data-chatbot-form]"),
    input: root.querySelector("[data-chatbot-form] input[name='message']"),
    send: root.querySelector("[data-chatbot-send]"),
    prompts: [...root.querySelectorAll("[data-chatbot-prompt]")],
    promptsWrap: root.querySelector("[data-chatbot-prompts]"),
  };
}

function chatbotHistoryKey() {
  const userPart = state.me?.id ?? state.me?.email ?? "guest";
  return `${CHATBOT_HISTORY_KEY_PREFIX}.${workspaceType}.${userPart}`;
}

function loadChatbotHistory() {
  try {
    const raw = localStorage.getItem(chatbotHistoryKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        role: item.role === "user" ? "user" : "assistant",
        text: String(item.text || "").trim(),
        ts: Number(item.ts || Date.now()),
        meta: item.meta && typeof item.meta === "object" ? item.meta : {},
      }))
      .filter((item) => item.text)
      .slice(-CHATBOT_MAX_MESSAGES);
  } catch {
    return [];
  }
}

function saveChatbotHistory() {
  try {
    localStorage.setItem(chatbotHistoryKey(), JSON.stringify(state.chatbot.messages.slice(-CHATBOT_MAX_MESSAGES)));
  } catch {
    // best-effort persistence
  }
}

function resolveChatbotEndpoint() {
  const globalOverride = typeof window !== "undefined" ? window.FINLY_CHATBOT_ENDPOINT : "";
  const localOverride = localStorage.getItem(CHATBOT_ENDPOINT_KEY);
  const selected = String(globalOverride || localOverride || CHATBOT_ENDPOINT).trim();
  return selected || CHATBOT_ENDPOINT;
}

function resolveChatbotTenant() {
  const value = String(localStorage.getItem(CHATBOT_TENANT_KEY) || state.chatbot.tenantId || "tnt_demo").trim();
  return value || "tnt_demo";
}

function resolveChatbotAuthToken() {
  return String(localStorage.getItem(CHATBOT_TOKEN_KEY) || "").trim();
}

function resolveStoredChatbotSessionId() {
  return String(localStorage.getItem(CHATBOT_SESSION_KEY) || "").trim();
}

function resolveChatbotStrictGrounding() {
  const value = localStorage.getItem(CHATBOT_STRICT_KEY);
  if (value == null) return true;
  return value !== "0";
}

function resolveChatbotVerbose() {
  return localStorage.getItem(CHATBOT_VERBOSE_KEY) === "1";
}

function resolveChatbotStream() {
  return localStorage.getItem(CHATBOT_STREAM_KEY) === "1";
}

function storeChatbotConfig({ endpoint, tenantId, authToken, sessionId }) {
  if (endpoint !== undefined) localStorage.setItem(CHATBOT_ENDPOINT_KEY, String(endpoint || CHATBOT_ENDPOINT).trim());
  if (tenantId !== undefined) localStorage.setItem(CHATBOT_TENANT_KEY, String(tenantId || "tnt_demo").trim());
  if (authToken !== undefined) {
    const token = String(authToken || "").trim();
    if (token) localStorage.setItem(CHATBOT_TOKEN_KEY, token);
    else localStorage.removeItem(CHATBOT_TOKEN_KEY);
  }
  if (sessionId !== undefined) {
    const next = String(sessionId || "").trim();
    if (next) localStorage.setItem(CHATBOT_SESSION_KEY, next);
    else localStorage.removeItem(CHATBOT_SESSION_KEY);
  }
}

function normalizeAuthorization(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  if (/^bearer\s+/i.test(raw)) return raw;
  return `Bearer ${raw}`;
}

function defaultDevToken() {
  const tenant = state.chatbot.tenantId || "tnt_demo";
  const userId = String(state.me?.id || "2");
  const role = String(state.me?.role || "user");
  return `Bearer tenant:${tenant}|user:${userId}|role:${role}`;
}

function isExternalV1ChatEndpoint(endpoint) {
  const value = String(endpoint || "").toLowerCase();
  return /^https?:\/\//.test(value) && value.includes("/v1/chat");
}

function chatbotPromptsForWorkspace() {
  if (workspaceType === "admin") {
    return ["Open users", "Show categories", "give me overall platform overview for all users"];
  }
  return ["Open budgets", "How to export report?", "gve my acnt overveiw and hw to do bttr"];
}

function renderChatbotPrompts() {
  const { promptsWrap } = chatbotElements();
  if (!promptsWrap) return;
  const prompts = chatbotPromptsForWorkspace();
  promptsWrap.innerHTML = prompts
    .map((prompt) => `<button type="button" class="button button-ghost" data-chatbot-prompt="${escapeHtml(prompt)}">${escapeHtml(prompt)}</button>`)
    .join("");
}

function updateChatbotStatus() {
  const { status } = chatbotElements();
  if (!status) return;
  const mode = state.chatbot.source === "api" ? "External" : "Local";
  status.textContent = mode;
  status.setAttribute("title", state.chatbot.source === "api" ? `Connected to ${state.chatbot.endpoint}` : "Fallback mode");
}

function pushChatbotMessage(role, text, meta = {}) {
  const value = String(text || "").trim();
  if (!value) return;
  state.chatbot.messages.push({
    role: role === "user" ? "user" : "assistant",
    text: value,
    ts: Date.now(),
    meta: meta && typeof meta === "object" ? meta : {},
  });
  state.chatbot.messages = state.chatbot.messages.slice(-CHATBOT_MAX_MESSAGES);
  saveChatbotHistory();
}

function formatChatbotMeta(meta = {}) {
  const badges = [];
  if (Number.isFinite(Number(meta.confidence))) {
    badges.push(`Confidence ${Math.round(Number(meta.confidence) * 100)}%`);
  }
  if (meta.model) badges.push(`Model ${meta.model}`);
  if (Number.isFinite(Number(meta.citations)) && Number(meta.citations) > 0) {
    badges.push(`${meta.citations} citation${Number(meta.citations) === 1 ? "" : "s"}`);
  }
  if (Number.isFinite(Number(meta.warnings)) && Number(meta.warnings) > 0) {
    badges.push(`${meta.warnings} warning${Number(meta.warnings) === 1 ? "" : "s"}`);
  }
  if (meta.needsClarification) {
    badges.push("Needs clarification");
  }
  if (Array.isArray(meta.missingData) && meta.missingData.length) {
    badges.push(`Missing ${meta.missingData.length} field${meta.missingData.length === 1 ? "" : "s"}`);
  }
  if (meta.traceId) badges.push(`Trace ${meta.traceId}`);
  return badges;
}

function renderChatbotMessages() {
  const { messages } = chatbotElements();
  if (!messages) return;
  const rows = state.chatbot.messages
    .slice(-28)
    .map((item) => {
      const tone = item.role === "user" ? "chatbot-user" : "chatbot-assistant";
      const label = item.role === "user" ? "You" : "Assistant";
      const badges = item.role === "assistant" ? formatChatbotMeta(item.meta) : [];
      return `<article class="chatbot-message ${tone}"><span class="section-label">${escapeHtml(label)}</span><p>${escapeHtml(item.text)}</p>${badges.length ? `<div class="chatbot-meta">${badges.map((badge) => `<span class="chatbot-meta-pill">${escapeHtml(badge)}</span>`).join("")}</div>` : ""}</article>`;
    });
  if (state.chatbot.typing) {
    rows.push('<article class="chatbot-message chatbot-assistant chatbot-message-typing"><span class="section-label">Assistant</span><p><span class="chatbot-dot"></span><span class="chatbot-dot"></span><span class="chatbot-dot"></span></p></article>');
  }
  messages.innerHTML = rows.join("");
  messages.scrollTop = messages.scrollHeight;
}

function setChatbotPending(value) {
  state.chatbot.pending = Boolean(value);
  state.chatbot.typing = state.chatbot.pending;
  const { send, input, prompts, clear } = chatbotElements();
  if (send) send.disabled = state.chatbot.pending;
  if (input) input.disabled = state.chatbot.pending;
  prompts.forEach((button) => {
    button.disabled = state.chatbot.pending;
  });
  if (clear) clear.disabled = state.chatbot.pending;
  renderChatbotMessages();
}

function setChatbotOpen(next) {
  state.chatbot.open = Boolean(next);
  const { shell, panel, toggle, input } = chatbotElements();
  shell?.classList.toggle("chatbot-open", state.chatbot.open);
  if (panel) panel.hidden = !state.chatbot.open;
  if (toggle) toggle.setAttribute("aria-expanded", state.chatbot.open ? "true" : "false");
  if (state.chatbot.open) {
    input?.focus();
    renderChatbotMessages();
  }
}

function fallbackChatbotReply(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("open budget") || text.includes("budget")) {
    return { reply: "Opened Budgets. You can create or review plans from this section.", navigateTo: "budgets" };
  }
  if (text.includes("open profile") || text.includes("profile")) {
    return { reply: "Opened Profile. You can update your account details here.", navigateTo: "profile" };
  }
  if (text.includes("export") && text.includes("report")) {
    return { reply: "Opened Reports. Use the export actions there for CSV or PDF downloads.", navigateTo: "reports" };
  }
  if (text.includes("transaction")) {
    return { reply: "Opened Transactions. You can add, filter, and review entries in this table.", navigateTo: "transactions" };
  }
  if (text.includes("admin") && workspaceType !== "admin") {
    return { reply: "You are in user workspace. Sign in with an admin account to access admin pages.", navigateTo: null };
  }
  const pageTitle = state.currentPage?.title || "this section";
  return {
    reply: `I can help with navigation and quick tips. Try: Open budgets, Open profile, or Export report. You are currently on ${pageTitle}.`,
    navigateTo: null,
  };
}

function navigateFromChatbot(target) {
  const section = String(target || "").trim();
  if (!section || !workspace.pages[section]) return;
  window.location.hash = `#${section}`;
}

function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idmp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseSseChunks(raw) {
  const text = String(raw || "");
  const blocks = text.split("\n\n").map((item) => item.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      const eventLine = lines.find((line) => line.startsWith("event:"));
      const dataLine = lines.find((line) => line.startsWith("data:"));
      const event = eventLine ? eventLine.slice(6).trim() : "message";
      const dataRaw = dataLine ? dataLine.slice(5).trim() : "{}";
      let data = {};
      try {
        data = JSON.parse(dataRaw);
      } catch {
        data = {};
      }
      return { event, data };
    })
    .filter((item) => item && item.event);
}

async function streamExternalChat(endpoint, authHeader, payloadBody) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Authorization: authHeader,
      "Idempotency-Key": generateIdempotencyKey(),
    },
    body: JSON.stringify(payloadBody),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    const message = err?.error?.message || err?.detail || err?.message || `Chat request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!response.body) {
    return { data: { reply: "No streaming response body received." } };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let combined = "";
  let completedEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    parts.forEach((part) => {
      parseSseChunks(part).forEach(({ event, data }) => {
        if (event === "response.delta") {
          combined += String(data?.delta || "");
        }
        if (event === "response.completed") {
          completedEvent = data;
        }
      });
    });
  }

  if (buffer.trim()) {
    parseSseChunks(buffer).forEach(({ event, data }) => {
      if (event === "response.delta") combined += String(data?.delta || "");
      if (event === "response.completed") completedEvent = data;
    });
  }

  return {
    data: {
      reply: completedEvent?.message?.content || combined || "No response generated.",
      trace_id: completedEvent?.trace_id || null,
      request_id: completedEvent?.request_id || null,
      confidence_score: Number(completedEvent?.confidence_score ?? 0),
      warnings_count: Array.isArray(completedEvent?.warnings) ? completedEvent.warnings.length : 0,
      citations_count: Array.isArray(completedEvent?.message?.citations) ? completedEvent.message.citations.length : 0,
      model: completedEvent?.usage?.model || "",
      needs_clarification: Boolean(completedEvent?.needs_clarification),
      missing_data_fields: Array.isArray(completedEvent?.missing_data_fields) ? completedEvent.missing_data_fields : [],
    },
  };
}

async function requestChatbot(endpoint, payload) {
  const isAbsolute = /^https?:\/\//i.test(endpoint);
  if (!isAbsolute) {
    return await api(endpoint, { method: "POST", body: payload });
  }

  if (isExternalV1ChatEndpoint(endpoint)) {
    const baseUrl = endpoint.replace(/\/v1\/chat\/?$/i, "");
    const auth = normalizeAuthorization(state.chatbot.authToken) || defaultDevToken();
    let sessionId = state.chatbot.sessionId;

    if (!sessionId) {
      const sessionResponse = await fetch(`${baseUrl}/v1/sessions`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: auth,
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({
          tenant_id: state.chatbot.tenantId,
          user_id: String(state.me?.id || "2"),
          channel: "web",
        }),
      });
      const sessionPayload = await sessionResponse.json().catch(() => null);
      if (!sessionResponse.ok) {
        const msg = sessionPayload?.detail || sessionPayload?.message || "Unable to create chatbot session";
        throw new Error(msg);
      }
      sessionId = String(sessionPayload?.session_id || "");
      state.chatbot.sessionId = sessionId;
      storeChatbotConfig({ sessionId });
    }

    const requestBody = {
      tenant_id: state.chatbot.tenantId,
      user_id: String(state.me?.id || "2"),
      session_id: sessionId,
      message: {
        role: "user",
        content: payload.message,
      },
      channel: "web",
      stream: state.chatbot.stream === true,
      strict_grounding: payload.strict_grounding !== false,
      verbose: payload.verbose === true,
      context: payload.context || {},
    };

    if (state.chatbot.stream === true) {
      return await streamExternalChat(endpoint, auth, requestBody);
    }

    const chatResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: auth,
        "Idempotency-Key": generateIdempotencyKey(),
      },
      body: JSON.stringify(requestBody),
    });
    const chatPayload = await chatResponse.json().catch(() => null);
    if (!chatResponse.ok) {
      const message =
        chatPayload?.error?.message
        || chatPayload?.detail
        || chatPayload?.error
        || chatPayload?.message
        || `Chat request failed (${chatResponse.status})`;
      const error = new Error(message);
      error.status = chatResponse.status;
      throw error;
    }
    return {
      data: {
        reply: chatPayload?.message?.content || chatPayload?.reply || "",
        trace_id: chatPayload?.trace_id || null,
        request_id: chatPayload?.request_id || null,
        confidence_score: Number(chatPayload?.confidence_score ?? 0),
        warnings_count: Array.isArray(chatPayload?.warnings) ? chatPayload.warnings.length : 0,
        citations_count: Array.isArray(chatPayload?.message?.citations) ? chatPayload.message.citations.length : 0,
        model: chatPayload?.usage?.model || "",
        needs_clarification: Boolean(chatPayload?.needs_clarification),
        missing_data_fields: Array.isArray(chatPayload?.missing_data_fields) ? chatPayload.missing_data_fields : [],
      },
      raw: chatPayload,
    };
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message || data?.error || data?.detail || data?.message || `Chat request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function parseChatbotResponse(response) {
  const data = response?.data ?? response ?? {};
  const confidenceRaw = data?.confidence_score ?? data?.confidenceScore;
  const confidence = confidenceRaw === undefined || confidenceRaw === null || confidenceRaw === ""
    ? null
    : Number(confidenceRaw);
  const reply = String(
    data?.reply
      ?? data?.message
      ?? data?.content
      ?? data?.text
      ?? response?.message?.content
      ?? response?.reply
      ?? response?.message
      ?? ""
  ).trim();
  const navigateTo = String(data?.navigate_to || data?.navigateTo || "").trim() || null;
  const source = String(data?.source || response?.source || "").trim().toLowerCase() || "fallback";
  return {
    reply,
    navigateTo,
    source,
    meta: {
      confidence,
      warnings: Number(data?.warnings_count ?? 0),
      citations: Number(data?.citations_count ?? 0),
      model: String(data?.model || "").trim(),
      traceId: String(data?.trace_id || data?.traceId || "").trim(),
      requestId: String(data?.request_id || data?.requestId || "").trim(),
      needsClarification: Boolean(data?.needs_clarification ?? data?.needsClarification),
      missingData: Array.isArray(data?.missing_data_fields) ? data.missing_data_fields : [],
    },
  };
}

async function getChatbotReply(message) {
  try {
    const payload = {
      message,
      section: state.currentSection,
      workspace: workspaceType,
      strict_grounding: state.chatbot.strictGrounding,
      verbose: state.chatbot.verbose,
      context: {
        locale: navigator.language || "en-IN",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
      },
    };
    const response = await requestChatbot(state.chatbot.endpoint, payload);
    const parsed = parseChatbotResponse(response);
    if (parsed.reply) {
      const externalMode = parsed.source === "external" || isExternalV1ChatEndpoint(state.chatbot.endpoint);
      state.chatbot.source = externalMode ? "api" : "fallback";
      updateChatbotStatus();
      return parsed;
    }
  } catch {
    state.chatbot.source = "fallback";
    updateChatbotStatus();
    return fallbackChatbotReply(message);
  }
  return fallbackChatbotReply(message);
}

function ensureChatbotWelcome() {
  if (state.chatbot.messages.length) return;
  pushChatbotMessage("assistant", "Hi, I am Finly Assistant. Ask me to open sections or explain common actions.");
}

async function submitChatbotPrompt(message) {
  const text = String(message || "").trim();
  if (!text || state.chatbot.pending) return;
  pushChatbotMessage("user", text);
  renderChatbotMessages();
  setChatbotPending(true);
  const result = await getChatbotReply(text);
  if (result?.reply) {
    pushChatbotMessage("assistant", result.reply, result.meta || {});
  }
  if (result?.navigateTo) {
    navigateFromChatbot(result.navigateTo);
  }
  setChatbotPending(false);
  renderChatbotMessages();
}

function bindChatbot() {
  state.chatbot.endpoint = resolveChatbotEndpoint();
  state.chatbot.tenantId = resolveChatbotTenant();
  state.chatbot.authToken = resolveChatbotAuthToken();
  state.chatbot.sessionId = resolveStoredChatbotSessionId();
  state.chatbot.strictGrounding = resolveChatbotStrictGrounding();
  state.chatbot.verbose = resolveChatbotVerbose();
  state.chatbot.stream = resolveChatbotStream();
  state.chatbot.messages = loadChatbotHistory();
  renderChatbotPrompts();
  updateChatbotStatus();
  ensureChatbotWelcome();
  renderChatbotMessages();
  const { toggle, close, clear, form, input } = chatbotElements();

  toggle?.addEventListener("click", () => {
    setChatbotOpen(!state.chatbot.open);
  });

  close?.addEventListener("click", () => {
    setChatbotOpen(false);
  });

  clear?.addEventListener("click", () => {
    state.chatbot.messages = [];
    saveChatbotHistory();
    ensureChatbotWelcome();
    renderChatbotMessages();
  });

  root.querySelector("[data-chatbot-prompts]")?.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-chatbot-prompt]") : null;
    if (!button) return;
    const prompt = button.getAttribute("data-chatbot-prompt") || "";
    submitChatbotPrompt(prompt);
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = String(input?.value || "").trim();
    if (!text) return;
    if (input) input.value = "";
    await submitChatbotPrompt(text);
    input?.focus();
  });
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
      return;
    }
    if (event.key === "Escape" && state.chatbot.open) {
      setChatbotOpen(false);
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
  // chatbot integration disabled
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

// Robust logo fallback: ensure the chatbot logo renders even if asset path fails
(function ensureChatbotLogo() {
  const loadLogo = () => {
    const logoImg = root?.querySelector?.(".cb-logo img");
    if (!logoImg) return;
    fetch(logoImg.src, { method: "HEAD" })
      .then(res => {
        if (!res.ok) {
          const span = document.createElement("span");
          span.innerHTML = '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h12a4 4 0 0 1 0 8H6l-4 4V7z"/><circle cx="18" cy="9" r="1" fill="currentColor"/></svg>';
          logoImg.replaceWith(span);
        }
      })
      .catch(() => {});
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadLogo);
  } else {
    loadLogo();
  }
})();

export { closeModal };
// Additional robust fallback for logo if image fails to load (runtime safety)
(function(){
  document.addEventListener("DOMContentLoaded", function(){
    const logo = document.querySelector(".cb-logo img");
    if (logo) {
      logo.addEventListener("error", function(){
        const span = document.createElement("span");
        span.innerHTML = '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h12a4 4 0 0 1 0 8H6l-4 4V7z"/><circle cx="18" cy="9" r="1" fill="currentColor"/></svg>';
        logo.parentNode.replaceChild(span, logo);
      });
    }
  });
})();
