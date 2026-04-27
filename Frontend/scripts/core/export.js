function downloadBlob(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function escapeCsvValue(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(columns = [], rows = []) {
  const header = columns.map(escapeCsvValue).join(",");
  const body = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  return `\uFEFF${[header, body].filter(Boolean).join("\n")}`;
}

export function downloadCsv(filename, columns, rows) {
  downloadBlob(filename, "text/csv;charset=utf-8", buildCsv(columns, rows));
}

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfText(value) {
  return sanitizePdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapPdfLine(line, maxChars = 84) {
  const words = sanitizePdfText(line).split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function rgb(hex = "#1f2937") {
  const text = String(hex).replace("#", "");
  const full = text.length === 3 ? text.split("").map((ch) => `${ch}${ch}`).join("") : text;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  return [
    Number.isFinite(r) ? r : 0.12,
    Number.isFinite(g) ? g : 0.16,
    Number.isFinite(b) ? b : 0.22,
  ];
}

function textCmd(text, x, y, size = 11) {
  return `0.102 0.141 0.208 rg BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`;
}

function lineCmd(x1, y1, x2, y2, width = 1, color = [0.85, 0.88, 0.92]) {
  return `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function rectCmd(x, y, w, h, stroke = [0.84, 0.87, 0.92], fill = null) {
  if (fill) {
    return `${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg ${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG ${x} ${y} ${w} ${h} re B`;
  }
  return `${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG ${x} ${y} ${w} ${h} re S`;
}

function polylineCmd(points = [], width = 2, color = [0.24, 0.53, 0.97]) {
  if (!points.length) return "";
  const first = points[0];
  const path = points.slice(1).map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`).join(" ");
  return `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} RG ${width} w ${first.x.toFixed(2)} ${first.y.toFixed(2)} m ${path} S`;
}

function fillPolygonCmd(points = [], color = [0.8, 0.86, 0.96]) {
  if (!points.length) return "";
  const first = points[0];
  const path = points.slice(1).map((point) => `${point.x.toFixed(2)} ${point.y.toFixed(2)} l`).join(" ");
  return `${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg ${first.x.toFixed(2)} ${first.y.toFixed(2)} m ${path} h f`;
}

function areaUnderLineCmd(points = [], baselineY = 0, color = [0.88, 0.93, 0.99]) {
  if (!points.length) return "";
  const poly = [
    { x: points[0].x, y: baselineY },
    ...points,
    { x: points[points.length - 1].x, y: baselineY },
  ];
  return fillPolygonCmd(poly, color);
}

function donutSegmentCmd(cx, cy, outerR, innerR, startAngle, endAngle, color = [0.24, 0.53, 0.97]) {
  const span = Math.max(0.01, endAngle - startAngle);
  const steps = Math.max(8, Math.ceil(span / 0.16));
  const outer = [];
  const inner = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = startAngle + (span * i) / steps;
    outer.push({ x: cx + Math.cos(t) * outerR, y: cy + Math.sin(t) * outerR });
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = startAngle + (span * i) / steps;
    inner.push({ x: cx + Math.cos(t) * innerR, y: cy + Math.sin(t) * innerR });
  }
  return fillPolygonCmd([...outer, ...inner], color);
}

function buildPdfDocument(pageStreams = []) {
  const objects = [];
  const pushObj = (body) => {
    objects.push(body);
    return objects.length;
  };

  const fontId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentIds = pageStreams.map((stream) => pushObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  const pageObjIndexes = contentIds.map((contentId) =>
    pushObj(`<< /Type /Page /Parent __PAGES__ /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`),
  );
  const pagesId = pushObj(`<< /Type /Pages /Kids [${pageObjIndexes.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjIndexes.length} >>`);
  const catalogId = pushObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  pageObjIndexes.forEach((id) => {
    objects[id - 1] = objects[id - 1].replace("__PAGES__", `${pagesId} 0 R`);
  });

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets[index + 1] = output.length;
    output += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = output.length;
  output += `xref\n0 ${objects.length + 1}\n`;
  output += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    output += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  output += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return output;
}

function footer(pageNumber, totalPages) {
  return textCmd(`Finly Report - Page ${pageNumber} of ${totalPages}`, 44, 24, 9);
}

function kpiBlock(x, y, label, value) {
  const lines = [
    rectCmd(x, y - 8, 124, 56, [0.86, 0.88, 0.92], [0.98, 0.985, 0.995]),
    textCmd(label.toUpperCase(), x + 8, y + 31, 8),
    textCmd(value, x + 8, y + 12, 12),
  ];
  return lines.join("\n");
}

function sectionTitle(title, y) {
  return [textCmd(title, 44, y, 14), lineCmd(44, y - 6, 568, y - 6, 0.8, [0.86, 0.88, 0.92])].join("\n");
}

function wrappedTextCmds(text, { x = 44, y = 700, size = 10, lineHeight = 14, maxChars = 84, maxLines = 12 } = {}) {
  const lines = wrapPdfLine(text, maxChars).slice(0, maxLines);
  return lines.map((line, index) => textCmd(line, x, y - index * lineHeight, size));
}

function bulletListCmds(items = [], { x = 44, y = 700, size = 10, lineHeight = 14, maxChars = 90, maxRows = 14 } = {}) {
  const output = [];
  let row = 0;
  items.forEach((item) => {
    if (row >= maxRows) return;
    const lines = wrapPdfLine(`- ${item}`, maxChars);
    lines.forEach((line) => {
      if (row >= maxRows) return;
      output.push(textCmd(line, x, y - row * lineHeight, size));
      row += 1;
    });
  });
  return output;
}

function truncatePdfText(value, max = 30) {
  const text = sanitizePdfText(value);
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}...`;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return Number(count) === 1 ? singular : plural;
}

function verbForCount(count, singularVerb, pluralVerb) {
  return Number(count) === 1 ? singularVerb : pluralVerb;
}

function dedupeTextRows(rows = []) {
  const seen = new Set();
  const output = [];
  rows.forEach((row) => {
    const text = String(row || "").trim();
    if (!text) return;
    const key = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(text);
  });
  return output;
}

function buildTrendChart(monthlyRows = []) {
  const chartX = 60;
  const chartY = 210;
  const chartW = 500;
  const chartH = 430;
  const rows = monthlyRows.slice(-8);

  const incomeValues = rows.map((row) => Number(row.incomeRaw ?? row.income ?? 0));
  const expenseValues = rows.map((row) => Number(row.expenseRaw ?? row.expense ?? 0));
  const max = Math.max(1, ...incomeValues, ...expenseValues);

  const grid = [
    rectCmd(chartX, chartY, chartW, chartH, [0.86, 0.88, 0.92]),
    ...[0, 1, 2, 3, 4].map((idx) => {
      const y = chartY + (chartH * idx) / 4;
      return lineCmd(chartX, y, chartX + chartW, y, 0.6, [0.9, 0.92, 0.95]);
    }),
  ];

  const toPoint = (value, idx, total) => {
    const x = chartX + (chartW * idx) / Math.max(total - 1, 1);
    const y = chartY + ((max - value) / max) * chartH;
    return { x, y };
  };

  const incomePoints = incomeValues.map((value, idx) => toPoint(value, idx, incomeValues.length));
  const expensePoints = expenseValues.map((value, idx) => toPoint(value, idx, expenseValues.length));

  const labels = rows.map((row, idx) => textCmd(String(row.label || `P${idx + 1}`), chartX + (chartW * idx) / Math.max(rows.length - 1, 1) - 10, chartY - 22, 8));

  const yLabels = [0, 1, 2, 3, 4].map((idx) => {
    const value = max - (max * idx) / 4;
    const y = chartY + (chartH * idx) / 4 - 3;
    const text = `INR ${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
    return textCmd(text, 18, y, 8);
  });

  const incomeArea = areaUnderLineCmd(incomePoints, chartY, [0.88, 0.93, 0.99]);
  const expenseArea = areaUnderLineCmd(expensePoints, chartY, [0.92, 0.95, 0.98]);

  return [
    textCmd("Growth Trend", 44, 740, 19),
    ...grid,
    incomeArea,
    expenseArea,
    polylineCmd(incomePoints, 2.1, rgb("#3b82f6")),
    polylineCmd(expensePoints, 2.1, rgb("#64748b")),
    textCmd("Income", 460, 690, 9),
    lineCmd(430, 693, 455, 693, 2, rgb("#3b82f6")),
    textCmd("Expense", 460, 672, 9),
    lineCmd(430, 675, 455, 675, 2, rgb("#64748b")),
    ...yLabels,
    ...labels,
  ].join("\n");
}

function buildSpendingMixPage(categories = []) {
  const rows = categories.slice(0, 6);
  const total = rows.reduce((sum, row) => sum + Number(row.rawValue ?? row.value ?? 0), 0) || 1;
  const lines = [textCmd("Spending Mix", 44, 740, 19), lineCmd(44, 730, 568, 730, 0.8, [0.86, 0.88, 0.92])];
  const palette = ["#2563eb", "#f97316", "#0f172a", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0", "#dbeafe"];
  const cx = 306;
  const cy = 492;
  const outerR = 146;
  const innerR = 92;
  let angle = -Math.PI / 2;

  lines.push(rectCmd(110, 208, 392, 492, [0.9, 0.92, 0.95], [0.985, 0.99, 0.997]));

  rows.forEach((row, index) => {
    const share = Number(row.rawValue ?? row.value ?? 0) / total;
    const span = Math.max(0.06, share * Math.PI * 2);
    const next = angle + span;
    lines.push(donutSegmentCmd(cx, cy, outerR, innerR, angle, next, rgb(palette[index % palette.length])));
    angle = next;
  });

  const totalFormatted = rows.reduce((sum, row) => sum + Number(row.rawValue ?? 0), 0);
  lines.push(textCmd(`INR ${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(totalFormatted)}`, 260, 488, 18));
  lines.push(textCmd("Total spend", 274, 466, 10));

  rows.forEach((row, index) => {
    const legendY = 278 - index * 18;
    const pct = Math.round((Number(row.rawValue ?? row.value ?? 0) / total) * 100);
    lines.push(rectCmd(120, legendY - 6, 8, 8, rgb(palette[index % palette.length]), rgb(palette[index % palette.length])));
    lines.push(textCmd(truncatePdfText(String(row.label || "Category"), 28), 136, legendY, 10));
    lines.push(textCmd(`${row.value} (${pct}%)`, 400, legendY, 10));
  });
  return lines.join("\n");
}

function normalizeReportJson(payload = {}) {
  const model = {
    meta: {
      title: payload.title || "Finly Report",
      subtitle: payload.subtitle || "Finance Report",
      rangeLabel: payload.rangeLabel || "All time",
      generatedLabel: payload.generatedLabel || new Date().toLocaleString("en-IN"),
    },
    metrics: Array.isArray(payload.metrics) ? payload.metrics.slice(0, 4).map((item) => ({
      label: String(item?.label || "Metric"),
      value: String(item?.value || "—"),
    })) : [],
    summary: {
      executive: String(payload.executiveSummary || "Summary is not available."),
      takeaways: Array.isArray(payload.takeaways) ? payload.takeaways.slice(0, 6).map((item) => String(item || "")).filter(Boolean) : [],
      insights: Array.isArray(payload.insights) ? payload.insights.slice(0, 6).map((item) => ({
        label: String(item?.label || "Insight"),
        value: String(item?.value || "—"),
      })) : [],
    },
    detail: {
      topCategories: Array.isArray(payload.topCategories) ? payload.topCategories.slice(0, 8).map((row) => ({
        label: String(row?.label || "Category"),
        value: String(row?.value || "—"),
        share: Math.max(0, Number(row?.share || 0)),
        rawValue: Math.max(0, Number(row?.rawValue || 0)),
      })) : [],
      monthlyRows: Array.isArray(payload.monthlyRows) ? payload.monthlyRows.slice(-8).map((row) => ({
        label: String(row?.label || "—"),
        income: String(row?.income || "—"),
        expense: String(row?.expense || "—"),
        net: String(row?.net || "—"),
        incomeRaw: Number(row?.incomeRaw || 0),
        expenseRaw: Number(row?.expenseRaw || 0),
        netRaw: Number(row?.netRaw || 0),
      })) : [],
    },
  };

  return model;
}

export function downloadFinancialReportPdf(filename, payload = {}) {
  const report = normalizeReportJson(payload);
  const { title, subtitle, generatedLabel, rangeLabel } = report.meta;
  const metrics = report.metrics;
  const executiveSummary = report.summary.executive;
  const takeaways = report.summary.takeaways;
  const insights = report.summary.insights;
  const topCategories = report.detail.topCategories;
  const monthlyRows = report.detail.monthlyRows;
  const categoryRowsForTable = topCategories.slice(0, 6);
  const monthlyRowsForTable = monthlyRows.slice(-6);

  const metricByLabel = (key) => metrics.find((item) => String(item.label || "").toLowerCase().includes(String(key).toLowerCase()));
  const netMetric = metricByLabel("net")?.value || "-";
  const inflowMetric = metricByLabel("inflow")?.value || "-";
  const outflowMetric = metricByLabel("outflow")?.value || "-";
  const ratioMetric = metricByLabel("ratio")?.value || "-";

  const latestRow = monthlyRows[monthlyRows.length - 1] ?? null;
  const prevRow = monthlyRows[monthlyRows.length - 2] ?? null;
  const latestNetRaw = Number(latestRow?.netRaw ?? 0);
  const prevNetRaw = Number(prevRow?.netRaw ?? 0);
  const netDeltaRaw = latestRow && prevRow ? latestNetRaw - prevNetRaw : null;
  const totalSpendRaw = topCategories.reduce((sum, row) => sum + Number(row.rawValue || 0), 0);
  const topCategory = topCategories[0] ?? null;

  const liveSummaryLines = [
    `Net position in this range: ${netMetric}. Average inflow ${inflowMetric} and outflow ${outflowMetric}.`,
    topCategory
      ? `Top spending category is ${topCategory.label} at ${topCategory.value} (${Math.max(0, Number(topCategory.share || 0))}% share).`
      : "Top spending category is not available for this range.",
    latestRow
      ? `Latest period (${latestRow.label}) closes at ${latestRow.net}.`
      : "Latest period summary is not available.",
    netDeltaRaw == null
      ? "Month-over-month net movement is not available."
      : `Net movement versus previous period: ${netDeltaRaw >= 0 ? "up" : "down"} by INR ${new Intl.NumberFormat("en-IN").format(Math.abs(netDeltaRaw))}.`,
  ];

  const signalRows = dedupeTextRows([
    topCategory ? `Top category: ${topCategory.label} at ${topCategory.value}.` : "Top category is unavailable for this range.",
    latestRow ? `Latest period (${latestRow.label}) net result: ${latestRow.net}.` : "Latest period net result is unavailable.",
    netDeltaRaw == null
      ? "Period-over-period net movement is unavailable."
      : `Period-over-period net moved ${netDeltaRaw >= 0 ? "up" : "down"} by INR ${new Intl.NumberFormat("en-IN").format(Math.abs(netDeltaRaw))}.`,
    `Spend ratio for this range: ${ratioMetric}.`,
    `Category coverage in report: ${topCategories.length} ${pluralize(topCategories.length, "category", "categories")}.`,
    `Monthly points included: ${monthlyRows.length}.`,
  ]).slice(0, 5);

  const page1 = [];
  page1.push(textCmd(title, 44, 746, 24));
  page1.push(textCmd(subtitle, 44, 724, 12));
  page1.push(rectCmd(44, 664, 524, 48, [0.88, 0.9, 0.94], [0.985, 0.99, 0.997]));
  page1.push(textCmd(`Range: ${rangeLabel}`, 56, 698, 9));
  page1.push(textCmd(`Generated: ${generatedLabel}`, 56, 684, 9));
  page1.push(textCmd(`Periods: ${monthlyRows.length} | Categories: ${topCategories.length}`, 56, 670, 9));
  page1.push(lineCmd(44, 654, 568, 654, 0.9, [0.86, 0.88, 0.92]));

  const metricY = 582;
  metrics.forEach((metric, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = 44 + col * 262;
    const y = metricY - row * 74;
    page1.push(kpiBlock(x, y, String(metric.label || "Metric"), String(metric.value || "-")));
  });

  let cursorY = 446;
  page1.push(sectionTitle("Executive Snapshot", cursorY));
  const executiveLines = wrappedTextCmds(executiveSummary, { x: 44, y: cursorY - 24, size: 10, lineHeight: 14, maxChars: 92, maxLines: 4 });
  page1.push(...executiveLines);

  cursorY -= 24 + executiveLines.length * 14 + 14;
  page1.push(sectionTitle("Live Report Summary", cursorY));
  const liveLines = bulletListCmds(liveSummaryLines, { x: 44, y: cursorY - 24, size: 10, lineHeight: 14, maxChars: 90, maxRows: 8 });
  page1.push(...liveLines);

  cursorY -= 24 + liveLines.length * 14 + 12;
  page1.push(sectionTitle("Key Signals", cursorY));
  const signalLines = bulletListCmds(signalRows, { x: 44, y: cursorY - 24, size: 10, lineHeight: 14, maxChars: 90, maxRows: 8 });
  page1.push(...signalLines);

  const page2 = [];
  page2.push(textCmd("Operational Detail", 44, 740, 19));
  page2.push(sectionTitle("Top Spending Categories (Live Mix)", 704));
  page2.push(textCmd("#", 44, 680, 9));
  page2.push(textCmd("Category", 72, 680, 9));
  page2.push(textCmd("Share", 356, 680, 9));
  page2.push(textCmd("Amount", 446, 680, 9));
  page2.push(lineCmd(44, 672, 568, 672, 0.7, [0.88, 0.9, 0.94]));
  categoryRowsForTable.forEach((row, index) => {
    const y = 654 - index * 18;
    page2.push(textCmd(String(index + 1), 44, y, 10));
    page2.push(textCmd(truncatePdfText(String(row.label || "Category"), 34), 72, y, 10));
    page2.push(textCmd(`${Math.max(0, Number(row.share || 0))}%`, 356, y, 10));
    page2.push(textCmd(String(row.value || "-"), 446, y, 10));
    page2.push(lineCmd(44, y - 8, 568, y - 8, 0.5, [0.92, 0.94, 0.97]));
  });

  page2.push(sectionTitle("Monthly Snapshot (Live Trend)", 484));
  page2.push(textCmd("Period", 44, 460, 9));
  page2.push(textCmd("Inflow", 188, 460, 9));
  page2.push(textCmd("Outflow", 312, 460, 9));
  page2.push(textCmd("Net", 438, 460, 9));
  page2.push(lineCmd(44, 452, 568, 452, 0.7, [0.88, 0.9, 0.94]));
  monthlyRowsForTable.forEach((row, index) => {
    const y = 434 - index * 18;
    page2.push(
      textCmd(String(row.label || "-"), 44, y, 10),
      textCmd(String(row.income || "-"), 188, y, 10),
      textCmd(String(row.expense || "-"), 312, y, 10),
      textCmd(String(row.net || "-"), 438, y, 10),
    );
    page2.push(lineCmd(44, y - 8, 568, y - 8, 0.5, [0.92, 0.94, 0.97]));
  });

  page2.push(sectionTitle("Summary", 244));
  page2.push(...wrappedTextCmds(
    `Total tracked spend is INR ${new Intl.NumberFormat("en-IN").format(totalSpendRaw)} and current spend ratio is ${ratioMetric}. Showing top ${categoryRowsForTable.length} ${pluralize(categoryRowsForTable.length, "category", "categories")} and latest ${monthlyRowsForTable.length} ${pluralize(monthlyRowsForTable.length, "period")}.${latestRow ? ` Latest month (${latestRow.label}) closes at ${latestRow.net}.` : ""}`,
    { x: 44, y: 220, size: 10, lineHeight: 14, maxChars: 92, maxLines: 3 },
  ));

  const page3 = [buildTrendChart(monthlyRows)];
  page3.push(sectionTitle("Trend Notes", 110));
  page3.push(...bulletListCmds([
    latestRow ? `Latest period ${latestRow.label}: net ${latestRow.net}.` : "Latest period data unavailable.",
    netDeltaRaw == null
      ? "Unable to compare with previous period."
      : `Period-over-period net change: ${netDeltaRaw >= 0 ? "up" : "down"} by INR ${new Intl.NumberFormat("en-IN").format(Math.abs(netDeltaRaw))}.`,
    `Average inflow is ${inflowMetric}; average outflow is ${outflowMetric}.`,
    monthlyRows.length < 3 ? "Trend is based on limited monthly points; add more periods for deeper slope quality." : "",
  ], { x: 44, y: 86, size: 10, lineHeight: 12, maxChars: 90, maxRows: 6 }));

  const page4 = [buildSpendingMixPage(categoryRowsForTable)];
  page4.push(sectionTitle("Actionable Summary", 108));
  const topCoverageCount = Math.min(3, topCategories.length);
  page4.push(...bulletListCmds([
    topCategory ? `${topCategory.label} remains the largest cost center at ${topCategory.value}.` : "No dominant category identified.",
    `Top ${topCoverageCount} ${pluralize(topCoverageCount, "category", "categories")} ${verbForCount(topCoverageCount, "accounts", "account")} for a majority of spend in this range.`,
    "Use this mix with monthly trend to rebalance budgets and spending controls.",
  ], { x: 44, y: 84, size: 10, lineHeight: 12, maxChars: 90, maxRows: 6 }));

  const pages = [page1.join("\n"), page2.join("\n"), page3.join("\n"), page4.join("\n")];
  const totalPages = pages.length;
  const pagesWithFooter = pages.map((stream, index) => `${stream}\n${footer(index + 1, totalPages)}`);

  const pdf = buildPdfDocument(pagesWithFooter);
  downloadBlob(filename, "application/pdf", pdf);
}

export function downloadSimplePdf(filename, title, lines = []) {
  const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  const contentLines = lines.flatMap((line) => wrapPdfLine(line));
  const streamLines = [
    textCmd(String(title || "Report").toUpperCase(), 50, 770, 13),
    textCmd(`Generated: ${generatedAt} UTC`, 50, 754, 9),
    lineCmd(50, 748, 560, 748, 0.8, [0.86, 0.88, 0.92]),
    ...contentLines.slice(0, 40).map((line, index) => textCmd(line, 50, 730 - index * 16, 11)),
  ];
  const pdf = buildPdfDocument([streamLines.join("\n")]);
  downloadBlob(filename, "application/pdf", pdf);
}
