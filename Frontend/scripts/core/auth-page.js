import { escapeHtml } from "./dom.js";
import { applyTheme, initTheme } from "./theme.js";

export function initAuthTheme() {
  applyTheme(initTheme());
}

export function createAuthToast(toastRoot) {
  return function toast(title, message, tone = "neutral") {
    if (!toastRoot) return;
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
    if (tone === "success") node.style.borderLeftColor = "var(--success)";
    if (tone === "danger") node.style.borderLeftColor = "var(--danger)";
    if (tone === "warning") node.style.borderLeftColor = "var(--warning)";
    toastRoot.appendChild(node);
    window.setTimeout(() => node.remove(), 3800);
  };
}
