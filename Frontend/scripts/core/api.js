const BASE_URL = "/api/v1";
const TOKEN_KEY = "finly.accessToken";
const USER_KEY = "finly.user";
const THEME_KEY = "finly.theme";

function safeJson(response) {
  return response
    .json()
    .catch(() => null);
}

function normalizePath(path) {
  if (!path) return BASE_URL;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/v1/")) return path;
  if (path.startsWith("/api/")) return `/api/v1${path.slice(4)}`;
  if (path.startsWith("/")) return `${BASE_URL}${path}`;
  return `${BASE_URL}/${path}`;
}

export function readToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function writeSession({ accessToken, user, remember = true }) {
  const storage = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
  if (accessToken) storage.setItem(TOKEN_KEY, accessToken);
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
}

export function readSession() {
  const localToken = localStorage.getItem(TOKEN_KEY);
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  const accessToken = localToken || sessionToken;
  const storage = localToken ? "local" : sessionToken ? "session" : null;
  const userRaw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }
  return { accessToken, user, storage };
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(USER_KEY);
}

function buildHeaders(token, headers = {}) {
  const next = {
    Accept: "application/json",
    ...headers,
  };
  if (token) {
    next.Authorization = `Bearer ${token}`;
  }
  if (!(headers instanceof FormData)) {
    next["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  return next;
}

export async function apiRequest(path, options = {}) {
  const { token = readToken(), method = "GET", body, headers, query } = options;
  const url = new URL(normalizePath(path), window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(","));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const response = await fetch(url, {
    method,
    headers: buildHeaders(token, headers || {}),
    body:
      body instanceof FormData
        ? body
        : body === undefined || body === null
          ? undefined
          : JSON.stringify(body),
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.detail ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function unwrapData(payload, fallback = null) {
  if (payload == null) return fallback;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.data !== undefined) return payload.data;
  if (payload.result !== undefined) return payload.result;
  return fallback ?? payload;
}

export function normalizeList(payload) {
  const data = unwrapData(payload, []);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function normalizeDetail(payload) {
  const data = unwrapData(payload, null);
  return data && typeof data === "object" ? data : payload;
}

export function storageGet(key, fallback = null) {
  const value = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  return value ?? fallback;
}

export function storageSet(key, value, { persist = true } = {}) {
  const target = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  other.removeItem(key);
  target.setItem(key, value);
}

export function readThemePreference() {
  return storageGet(THEME_KEY, window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function writeThemePreference(theme) {
  storageSet(THEME_KEY, theme, { persist: true });
}

export function isDemoMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" || localStorage.getItem("finly.demoMode") === "1";
}

export { BASE_URL, THEME_KEY, TOKEN_KEY, USER_KEY };
