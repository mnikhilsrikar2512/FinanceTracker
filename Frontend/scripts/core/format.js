const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_PRECISE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function formatINR(value, { precise = false } = {}) {
  const number = Number(value) || 0;
  return (precise ? INR_PRECISE : INR).format(number);
}

export function formatPercent(value, fractionDigits = 0) {
  return `${Number(value || 0).toFixed(fractionDigits)}%`;
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const text = String(value).trim();
  if (!text) return null;

  const naiveIso = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?$/);
  if (naiveIso) {
    const base = naiveIso[1];
    const fraction = naiveIso[2] ? `.${naiveIso[2].slice(1, 4).padEnd(3, "0")}` : "";
    return new Date(`${base}${fraction}Z`);
  }

  const tzIso = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?([+-]\d{2}:\d{2}|Z)$/);
  if (tzIso) {
    const base = tzIso[1];
    const fraction = tzIso[2] ? `.${tzIso[2].slice(1, 4).padEnd(3, "0")}` : "";
    const zone = tzIso[3] || "Z";
    return new Date(`${base}${fraction}${zone}`);
  }

  return new Date(text);
}

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function formatDate(value, options = {}) {
  const parsed = parseDateValue(value);
  if (!isValidDate(parsed)) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(parsed);
}

export function formatDateTime(value, { withSeconds = false, compact = false } = {}) {
  const parsed = parseDateValue(value);
  if (!isValidDate(parsed)) return "—";
  const text = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  }).format(parsed);
  return compact ? text.replace(",", " ·") : text;
}

export function formatDateTimeInput(value = new Date()) {
  const parsed = parseDateValue(value) || new Date();
  const date = isValidDate(parsed) ? parsed : new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatClock(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatLongDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function formatHeaderDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function timeAgo(value) {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
