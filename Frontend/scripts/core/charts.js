import { clamp, escapeHtml } from "./dom.js";

const INTL_SHORT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

function shortNumber(value) {
  const number = Number(value) || 0;
  const abs = Math.abs(number);
  const sign = number < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${INTL_SHORT.format(abs / 10000000)}Cr`;
  if (abs >= 100000) return `${sign}₹${INTL_SHORT.format(abs / 100000)}L`;
  if (abs >= 1000) return `${sign}₹${INTL_SHORT.format(abs / 1000)}K`;
  return `${sign}₹${INTL_SHORT.format(abs)}`;
}

function toLinePoints(series = []) {
  const normalized = Array.isArray(series)
    ? series.map((entry, index) => {
      if (entry && typeof entry === "object") {
        return {
          label: String(entry.label ?? `P${index + 1}`),
          value: Number(entry.value ?? 0) || 0,
        };
      }
      return {
        label: `P${index + 1}`,
        value: Number(entry) || 0,
      };
    })
    : [];

  if (!normalized.length) {
    return [
      { label: "Start", value: 0 },
      { label: "Now", value: 0 },
    ];
  }

  if (normalized.length === 1) {
    return [
      normalized[0],
      { label: normalized[0].label, value: normalized[0].value },
    ];
  }

  return normalized;
}

export function lineChartSVG(series, { width = 700, height = 260, stroke = "#7dd3fc" } = {}) {
  const source = toLinePoints(series);
  const values = source.map((point) => point.value);
  const maxRaw = Math.max(...values, 0);
  const minRaw = Math.min(...values, 0);
  const range = Math.max(maxRaw - minRaw, 1);
  const max = maxRaw + range * 0.08;
  const min = minRaw - range * 0.08;

  const padLeft = 52;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const zeroY = padTop + innerHeight - ((0 - min) / Math.max(max - min, 1)) * innerHeight;

  const points = source.map((point, index) => {
    const x = padLeft + (innerWidth * index) / Math.max(source.length - 1, 1);
    const normalized = (point.value - min) / Math.max(max - min, 1);
    const y = padTop + innerHeight - normalized * innerHeight;
    return { ...point, x, y };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const fillPath = `${path} L ${padLeft + innerWidth},${padTop + innerHeight} L ${padLeft},${padTop + innerHeight} Z`;

  const yTicks = [0, 1, 2, 3, 4].map((step) => {
    const ratio = step / 4;
    const y = padTop + innerHeight * ratio;
    const value = max - (max - min) * ratio;
    return { ratio, y, value };
  });

  const gridLines = yTicks
    .map((tick) => {
      const isZero = Math.abs(tick.value) < Math.max(range * 0.03, 1);
      const className = isZero ? "chart-grid-line chart-grid-line-major" : "chart-grid-line";
      return `
        <line x1="${padLeft}" y1="${tick.y.toFixed(2)}" x2="${(padLeft + innerWidth).toFixed(2)}" y2="${tick.y.toFixed(2)}" class="${className}"></line>
        <text x="${padLeft - 10}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end" class="chart-axis-label">${escapeHtml(shortNumber(tick.value))}</text>
      `;
    })
    .join("");

  const xTickCount = Math.min(points.length, 6);
  const xIndexes = [...new Set(Array.from({ length: xTickCount }, (_, index) => Math.round((index * (points.length - 1)) / Math.max(xTickCount - 1, 1))))];
  const xLabels = xIndexes
    .map((index) => {
      const point = points[index];
      return `<text x="${point.x.toFixed(2)}" y="${(height - 10).toFixed(2)}" text-anchor="middle" class="chart-axis-label">${escapeHtml(point.label)}</text>`;
    })
    .join("");

  const verticalGuides = xIndexes
    .filter((index) => index > 0 && index < points.length - 1)
    .map((index) => {
      const x = points[index].x;
      return `<line x1="${x.toFixed(2)}" y1="${padTop}" x2="${x.toFixed(2)}" y2="${(padTop + innerHeight).toFixed(2)}" class="chart-line-guide"></line>`;
    })
    .join("");

  const showMarkers = points.length <= 18;
  const gradientId = `line-fill-${String(stroke).replace(/[^a-z0-9]/gi, "")}-${points.length}-${Math.round(max)}-${Math.round(min)}`;
  const lastPoint = points[points.length - 1];
  const lastValue = shortNumber(lastPoint.value);
  const pillWidth = Math.max(52, Math.min(96, lastValue.length * 6 + 18));
  const pillX = clamp(lastPoint.x - pillWidth / 2, padLeft + 2, padLeft + innerWidth - pillWidth - 2);
  const pillY = clamp(lastPoint.y - 30, padTop + 2, padTop + innerHeight - 20);

  return `
    <svg class="chart-line" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend chart">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="0.34" />
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0.03" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${verticalGuides}
      ${min <= 0 && max >= 0 ? `<line x1="${padLeft}" y1="${zeroY.toFixed(2)}" x2="${(padLeft + innerWidth).toFixed(2)}" y2="${zeroY.toFixed(2)}" class="chart-zero-line"></line>` : ""}
      <path d="${fillPath}" fill="url(#${gradientId})"></path>
      <path class="chart-line-path" d="${path}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${showMarkers
        ? points
            .map(
              (point) => `<circle class="chart-line-marker" cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.6" fill="${stroke}"><title>${escapeHtml(`${point.label}: ${shortNumber(point.value)}`)}</title></circle>`,
            )
            .join("")
        : ""}
      <rect class="chart-last-pill" x="${pillX.toFixed(2)}" y="${pillY.toFixed(2)}" width="${pillWidth.toFixed(2)}" height="20" rx="10"></rect>
      <text class="chart-last-text" x="${(pillX + pillWidth / 2).toFixed(2)}" y="${(pillY + 13.5).toFixed(2)}" text-anchor="middle">${escapeHtml(lastValue)}</text>
      ${xLabels}
    </svg>
  `;
}

export function donutChartSVG(
  segments,
  {
    size = 240,
    strokeWidth = 28,
    centerLabel: customCenterLabel,
    centerValue: customCenterValue,
    valueFormatter,
    showLegend = true,
    legendLimit = 6,
  } = {},
) {
  const safe = Array.isArray(segments)
    ? segments.filter((segment) => Number(segment.value) > 0)
    : [];
  safe.sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
  const totalRaw = safe.reduce((sum, segment) => sum + Number(segment.value || 0), 0);
  const total = totalRaw || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = Math.min(6, circumference * 0.012);
  let offset = 0;

  const circles = safe
    .map((segment) => {
      const rawDash = clamp((Number(segment.value || 0) / total) * circumference, 0, circumference);
      const dash = Math.max(rawDash - gap, 0);
      const currentOffset = offset;
      offset += rawDash;
      const color = segment.color || "#7dd3fc";
      const pct = total ? Math.round((Number(segment.value || 0) / total) * 100) : 0;
      return `
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          fill="none"
          stroke="${color}"
          stroke-width="${strokeWidth}"
          stroke-dasharray="${dash} ${circumference - dash}"
          stroke-dashoffset="${-currentOffset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
          stroke-linecap="round"
        ><title>${escapeHtml(`${segment.label ?? "Category"}: ${pct}%`)}</title></circle>
      `;
    })
    .join("");

  const centerLabelRaw = customCenterLabel ?? safe[0]?.label ?? "Total";
  const centerLabel = String(centerLabelRaw).slice(0, 22);
  const centerValueRaw = customCenterValue === "" ? "" : (customCenterValue ?? totalRaw);
  const centerValue = centerValueRaw === ""
    ? ""
    : (typeof valueFormatter === "function"
      ? valueFormatter(centerValueRaw)
      : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(centerValueRaw) || 0));
  const labelSize = centerLabel.length > 16 ? 22 : 28;
  const hideCenter = customCenterLabel === "" || customCenterValue === "";

  const legend = showLegend
    ? `
      <ul class="donut-legend">
        ${safe
          .slice(0, legendLimit)
          .map((segment) => {
            const value = Number(segment.value || 0);
            const pct = total ? Math.round((value / total) * 100) : 0;
            const formatted = typeof valueFormatter === "function"
              ? valueFormatter(value)
              : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
            return `
              <li>
                <span class="donut-legend-dot" style="background:${segment.color || "#7dd3fc"}"></span>
                <span class="donut-legend-label">${escapeHtml(segment.label ?? "Category")}</span>
                <span class="donut-legend-value">${escapeHtml(formatted)} (${pct}%)</span>
              </li>
            `;
          })
          .join("")}
      </ul>
    `
    : "";

  return `
    <div class="donut-wrap">
      <svg class="donut-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Donut chart">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="rgba(148,163,184,0.16)" stroke-width="${strokeWidth}" />
        ${circles}
        ${hideCenter ? "" : `
          <text x="50%" y="46%" text-anchor="middle" class="donut-center-label" font-size="${labelSize}" font-weight="700">
            ${centerLabel}
          </text>
          <text x="50%" y="58%" text-anchor="middle" class="donut-center-value" font-size="15">
            ${escapeHtml(centerValue)}
          </text>
        `}
      </svg>
      ${legend}
    </div>
  `;
}

export function miniBars(values, { width = 160, height = 54, color = "#7dd3fc" } = {}) {
  const safe = Array.isArray(values) && values.length ? values.map((value) => Number(value) || 0) : [0];
  const max = Math.max(...safe, 1);
  const barWidth = width / safe.length - 4;
  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true">
      ${safe
        .map((value, index) => {
          const barHeight = (value / max) * (height - 8);
          const x = index * (barWidth + 4);
          const y = height - barHeight;
          return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="6" fill="${color}" fill-opacity="0.78"></rect>`;
        })
        .join("")}
    </svg>
  `;
}
