import { escapeHtml, joinClasses, toInitials } from "./dom.js";
import { formatINR, formatDate, formatDateTime } from "./format.js";

export function metricCard({ label, value, trend, hint, icon }) {
  const trendClass = trend?.kind === "down" ? "down" : "up";
  let trendLabel = "";
  if (trend?.label) {
    trendLabel = String(trend.label);
  } else if (trend?.value !== undefined) {
    trendLabel = `${trend.value}%`;
  }

  const valueText = String(value ?? "");
  const compactValue = valueText.length > 20;
  return `
    <article class="metric-card">
      <div class="metric-meta">
        <span class="metric-label">${escapeHtml(label)}</span>
        ${icon ? `<span class="pill">${escapeHtml(icon)}</span>` : ""}
      </div>
      <strong class="metric-value${compactValue ? " metric-value-compact" : ""}">${escapeHtml(valueText)}</strong>
      <div class="metric-meta">
        <span class="trend ${trendClass}">${trendLabel}</span>
        <span class="muted">${escapeHtml(hint ?? "")}</span>
      </div>
    </article>
  `;
}

export function panel(title, subtitle, content, actions = "") {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <span class="panel-title">${escapeHtml(title)}</span>
          <h3>${escapeHtml(subtitle ?? title)}</h3>
        </div>
        ${actions ? `<div class="toolbar">${actions}</div>` : ""}
      </div>
      <div class="panel-body">${content}</div>
    </section>
  `;
}

export function hero(title, subtitle, actions = "") {
  return `
    <section class="hero-card">
      <div class="hero-frame hero-frame-simple">
        <div class="hero-copy">
          <p class="eyebrow">Finly workspace</p>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle ?? "")}</p>
        </div>
        ${actions ? `<div class="hero-toolbar toolbar">${actions}</div>` : ""}
      </div>
    </section>
  `;
}

export function badge(label, kind = "neutral") {
  const classes = {
    neutral: "badge-neutral",
    accent: "badge-soft",
    green: "badge-green",
    yellow: "badge-yellow",
    red: "badge-red",
  };
  return `<span class="${joinClasses("badge", classes[kind] || classes.neutral)}">${escapeHtml(label)}</span>`;
}

export function statusBadge(status) {
  const key = String(status ?? "").toLowerCase();
  if (["active", "success", "enabled", "income", "open", "approved"].includes(key)) return badge(status, "green");
  if (["pending", "warning", "draft"].includes(key)) return badge(status, "yellow");
  if (["blocked", "inactive", "failed", "deleted", "closed", "expense"].includes(key)) return badge(status, "red");
  return badge(status, "neutral");
}

export function button(label, { variant = "secondary", type = "button", attrs = "" } = {}) {
  return `<button type="${type}" class="button button-${variant}" ${attrs}>${escapeHtml(label)}</button>`;
}

export function iconButton(label, { variant = "ghost", attrs = "" } = {}) {
  return `<button type="button" aria-label="${escapeHtml(label)}" class="button button-${variant} button-icon" ${attrs}>${escapeHtml(label)}</button>`;
}

export function inputField({ label, name, type = "text", value = "", placeholder = "", required = false }) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input class="input" name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""} />
    </label>
  `;
}

export function selectField({ label, name, options = [], value = "", required = false }) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select class="select" name="${escapeHtml(name)}" ${required ? "required" : ""}>
        ${options
          .map(
            (option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

export function textareaField({ label, name, value = "", placeholder = "", rows = 5 }) {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <textarea class="textarea" name="${escapeHtml(name)}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

export function cardList(items, emptyLabel = "Nothing to show yet.", emptyAction = "", emptyIcon = "◎") {
  if (!items?.length) {
    return `
      <div class="empty-state">
        <span class="empty-state-icon" aria-hidden="true">${escapeHtml(emptyIcon)}</span>
        <div class="empty-state-copy">
          <h4>Nothing here yet</h4>
          <p>${escapeHtml(emptyLabel)}</p>
        </div>
        ${emptyAction ? `<div class="empty-state-actions">${emptyAction}</div>` : ""}
      </div>
    `;
  }
  return `<div class="list">${items.join("")}</div>`;
}

export function emptyState(title, description, action = "", icon = "◎") {
  return `
    <div class="empty-state">
      <span class="empty-state-icon" aria-hidden="true">${escapeHtml(icon)}</span>
      <div class="empty-state-copy">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(description)}</p>
      </div>
      ${action ? `<div class="empty-state-actions">${action}</div>` : ""}
    </div>
  `;
}

export function loadingState(label = "Loading") {
  return `
    <div class="loading-state">
      <div class="loading-skeleton loading-skeleton-title"></div>
      <div class="loading-skeleton loading-skeleton-line"></div>
      <div class="loading-skeleton loading-skeleton-line short"></div>
      <div class="loading-skeleton loading-skeleton-line"></div>
      <h4>${escapeHtml(label)}...</h4>
      <p>We are connecting to the API and preparing the latest data.</p>
    </div>
  `;
}

export function table({ columns, rows, emptyLabel = "No records available.", emptyAction = "" }) {
  if (!rows?.length) {
    return emptyState("No rows yet", emptyLabel, emptyAction);
  }
  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.join("")}
        </tbody>
      </table>
    </div>
  `;
}

export function progressRow({ label, value, max = 100, note = "" }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / Number(max)) * 100 || 0));
  return `
    <div class="section-stack">
      <div class="metric-meta">
        <strong>${escapeHtml(label)}</strong>
        <span class="muted">${escapeHtml(note)}</span>
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
    </div>
  `;
}

export function timelineItem({ title, note, time, tone = "neutral" }) {
  return `
    <article class="list-item">
      <div>
        ${statusBadge(tone)}
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(note)}</p>
      </div>
      <span class="muted">${escapeHtml(time)}</span>
    </article>
  `;
}

export function userAvatar(name) {
  return `<span class="avatar">${escapeHtml(toInitials(name))}</span>`;
}

export function rowAction(label, attrs = "") {
  return `<button type="button" class="button button-ghost" ${attrs}>${escapeHtml(label)}</button>`;
}

export function infoRow(label, value) {
  return `
    <div class="list-item">
      <div>
        <span class="section-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    </div>
  `;
}

export function formatTableAmount(value) {
  const amount = Number(value) || 0;
  return amount < 0 ? `<span class="trend down">${formatINR(amount)}</span>` : `<span class="trend up">${formatINR(amount)}</span>`;
}

export function formatTableDate(value) {
  return `<span class="mono">${escapeHtml(formatDateTime(value))}</span>`;
}
