import { initTheme, toggleTheme } from "./core/theme.js";

function syncThemeButtons(theme) {
  document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
    const nextMode = theme === "dark" ? "Light" : "Dark";
    button.textContent = `${nextMode} mode`;
    button.setAttribute("aria-label", `Switch to ${nextMode.toLowerCase()} mode`);
  });
}

const initial = initTheme();
syncThemeButtons(initial);

document.querySelectorAll('[data-action="toggle-theme"]').forEach((button) => {
  button.addEventListener("click", () => {
    const next = toggleTheme();
    syncThemeButtons(next);
  });
});
