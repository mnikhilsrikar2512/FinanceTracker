import { readThemePreference, writeThemePreference } from "./api.js";

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  writeThemePreference(next);
  return next;
}

export function initTheme() {
  return applyTheme(readThemePreference());
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  return applyTheme(current === "dark" ? "light" : "dark");
}

