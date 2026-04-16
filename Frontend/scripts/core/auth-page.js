import { escapeHtml } from "./dom.js";
import { applyTheme, initTheme, toggleTheme } from "./theme.js";

export function initAuthTheme() {
  const initial = applyTheme(initTheme());

  const syncThemeButtons = (theme) => {
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
      const nextMode = theme === "dark" ? "Light" : "Dark";
      button.textContent = `${nextMode} mode`;
      button.setAttribute("aria-label", `Switch to ${nextMode.toLowerCase()} mode`);
    });
  };

  syncThemeButtons(initial);

  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    button.addEventListener("click", () => {
      const next = toggleTheme();
      syncThemeButtons(next);
    });
  });
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
