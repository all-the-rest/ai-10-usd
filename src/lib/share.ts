import type { ComparisonData, ComparisonRow } from "../types";
import { compact, money, percent } from "./format";
import { sortRows } from "./sort";

// Assumption: "TOP information" = the top-ranked matched models by requests
// per normalized $10 (the site's default sort `maxRequests desc`), plus plan
// prices, generation timestamp and site branding — i.e. what a social card
// needs to be verifiable without opening the page.

/** Single metric: total requests per $10 ("max"). Old "advantage"/"difference"
 *  URL values coerce to "max" in parseShareQuery. */
export type ShareMetric = "max";
export type ShareWinnerFilter = "all" | "openCodeGo" | "commandCode";
export type ShareTheme = "light" | "dark";
export type SharePreset = "og" | "twitter" | "portrait" | "story";
export type ShareLang = "de" | "en";

export interface ShareConfig {
  topN: number;
  metric: ShareMetric;
  winner: ShareWinnerFilter;
  theme: ShareTheme;
  preset: SharePreset;
  brand: boolean;
  timestamp: boolean;
  /** Dialog + card language, independent from the site UI language. */
  shareLang: ShareLang;
  /** "Both plans only" — mirrors the main table's matchedOnly. */
  matchedOnly: boolean;
}

/** UI language default: stored `lang` wins, else browser language. */
export function defaultShareLang(): ShareLang {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem("lang");
    if (stored === "de" || stored === "en") return stored;
  }
  if (typeof navigator !== "undefined" && navigator.language.startsWith("de")) return "de";
  return "en";
}

export const DEFAULT_SHARE_CONFIG: ShareConfig = {
  topN: 5,
  metric: "max",
  winner: "all",
  theme: "dark",
  preset: "og",
  brand: true,
  timestamp: true,
  shareLang: "en",
  matchedOnly: true,
};

export interface ShareStrings {
  title: string;
  subtitle: string;
  language: string;
  preset: string;
  topN: string;
  winner: string;
  cardAllowance: string;
  cardFree: string;
  constraintsRules: string;
  constraintsWindows: string;
  constraintsCoverage: string;
  constraintsSource: string;
  theme: string;
  brand: string;
  timestamp: string;
  metricMax: string;
  winnerAll: string;
  winnerGo: string;
  winnerCc: string;
  matchedOnly: string;
  themeLight: string;
  themeDark: string;
  rowsUnit: string;
  empty: string;
  copySvg: string;
  downloadSvg: string;
  downloadPng: string;
  copyLink: string;
  close: string;
  closeDialog: string;
  statusSvgDownloaded: string;
  statusSvgCopied: string;
  statusCopyFailed: string;
  statusPngDownloaded: string;
  statusPngFailed: string;
  statusLinkCopied: string;
  cardKicker: string;
  cardTitle: string;
  legendGo: string;
  legendCc: string;
  legendDraw: string;
  gapDraw: string;
  footerDomain: string;
  footerUpdated: string;
}

export type ShareStatusKey =
  | "statusSvgDownloaded"
  | "statusSvgCopied"
  | "statusCopyFailed"
  | "statusPngDownloaded"
  | "statusPngFailed"
  | "statusLinkCopied";

/** Dialog + card strings, keyed by the independent `shareLang` (not the UI lang). */
export const SHARE_I18N: Record<ShareLang, ShareStrings> = {
  en: {
    title: "Share top models card",
    subtitle:
      "Configure the social card. Preview updates live — export as SVG or PNG, or copy a link that reopens this exact card.",
    language: "Card language",
    preset: "Size preset",
    topN: "Top-N rows",
    winner: "Winner filter",
    theme: "Card theme",
    brand: "Branding footer",
    timestamp: "Timestamp + prices",
    metricMax: "Max requests / $10",
    cardAllowance: "allowance",
    cardFree: "free included",
    winnerAll: "All winners",
    winnerGo: "OpenCode Go wins",
    winnerCc: "Command Code wins",
    matchedOnly: "Both plans only",
    themeLight: "Light",
    themeDark: "Dark",
    rowsUnit: "rows",
    empty: "No matched models for this filter",
    copySvg: "Copy SVG",
    downloadSvg: "Download SVG",
    downloadPng: "Download PNG",
    copyLink: "Copy link",
    close: "Close",
    closeDialog: "Close share dialog",
    statusSvgDownloaded: "SVG downloaded.",
    statusSvgCopied: "SVG markup copied.",
    statusCopyFailed: "Copy failed — use Download SVG instead.",
    statusPngDownloaded: "PNG downloaded ({w}×{h}).",
    statusPngFailed: "PNG export failed in this browser — use Download SVG.",
    statusLinkCopied: "Share link copied — reopens this card.",
    cardKicker: "AI PLANS AT $10",
    cardTitle: "Top {n} models per $10 — OpenCode Go vs Command Code GOAT",
    legendGo: "OpenCode Go wins",
    legendCc: "Command Code wins",
    legendDraw: "Draw (<10%)",
    gapDraw: "∞ free included",
    footerDomain: "ai-10-usd.all-the.rest",
    footerUpdated: "Updated {datetime}",
    constraintsRules: "Peak / Off-Peak variants are compared as separate rows.",
    constraintsWindows: "Off-peak (UTC): {windows}",
    constraintsCoverage: "Weekdays per source",
    constraintsSource: "As of {date} · ai-10-usd.all-the.rest",
  },
  de: {
    title: "Top-Modelle-Karte teilen",
    subtitle:
      "Konfiguriere die Social Card. Die Vorschau aktualisiert sich live — als SVG oder PNG exportieren oder einen Link kopieren, der genau diese Karte wieder öffnet.",
    language: "Kartensprache",
    preset: "Größe",
    topN: "Top-N Zeilen",
    winner: "Sieger-Filter",
    theme: "Karten-Theme",
    brand: "Branding-Fußzeile",
    timestamp: "Zeitstempel + Preise",
    metricMax: "Max. Anfragen / $10",
    cardAllowance: "Guthaben",
    cardFree: "gratis inbegriffen",
    winnerAll: "Alle Sieger",
    winnerGo: "OpenCode Go gewinnt",
    winnerCc: "Command Code gewinnt",
    matchedOnly: "Nur beide Pläne",
    themeLight: "Hell",
    themeDark: "Dunkel",
    rowsUnit: "Zeilen",
    empty: "Keine gematchten Modelle für diesen Filter",
    copySvg: "SVG kopieren",
    downloadSvg: "SVG herunterladen",
    downloadPng: "PNG herunterladen",
    copyLink: "Link kopieren",
    close: "Schließen",
    closeDialog: "Teilen-Dialog schließen",
    statusSvgDownloaded: "SVG heruntergeladen.",
    statusSvgCopied: "SVG-Code kopiert.",
    statusCopyFailed: "Kopieren fehlgeschlagen — stattdessen SVG herunterladen.",
    statusPngDownloaded: "PNG heruntergeladen ({w}×{h}).",
    statusPngFailed: "PNG-Export in diesem Browser fehlgeschlagen — stattdessen SVG herunterladen.",
    statusLinkCopied: "Share-Link kopiert — öffnet genau diese Karte erneut.",
    cardKicker: "KI-PLÄNE FÜR $10",
    cardTitle: "Top-{n}-Modelle pro $10 — OpenCode Go vs Command Code GOAT",
    legendGo: "OpenCode Go gewinnt",
    legendCc: "Command Code gewinnt",
    legendDraw: "Unentschieden (<10%)",
    gapDraw: "∞ gratis inbegriffen",
    footerDomain: "ai-10-usd.all-the.rest",
    footerUpdated: "Stand {datetime}",
    constraintsRules: "Peak-/Off-Peak-Varianten werden als eigene Zeilen verglichen.",
    constraintsWindows: "Off-peak (UTC): {windows}",
    constraintsCoverage: "Wochentage lt. Quelle",
    constraintsSource: "Stand {date} · ai-10-usd.all-the.rest",
  },
};

export const SHARE_PRESETS: Record<SharePreset, { width: number; height: number; label: string }> = {
  og: { width: 1200, height: 630, label: "OG 1200×630" },
  twitter: { width: 1200, height: 675, label: "Twitter 1200×675" },
  portrait: { width: 1080, height: 1350, label: "IG portrait 1080×1350" },
  story: { width: 1080, height: 1920, label: "Story 1080×1920" },
};

export const SHARE_TOPN_OPTIONS = [3, 5, 7, 10];

function maxOf(row: ComparisonRow): number {
  const go = row.openCodeGo?.unlimited ? Infinity : (row.openCodeGo?.normalizedRequestsPer10 ?? null);
  const cc = row.commandCode?.unlimited ? Infinity : (row.commandCode?.normalizedRequestsPer10 ?? null);
  if (go === null && cc === null) return Number.NEGATIVE_INFINITY;
  return Math.max(go ?? Number.NEGATIVE_INFINITY, cc ?? Number.NEGATIVE_INFINITY);
}

/** Portrait cards (IG 4:5, Story 9:16) fill height with constraints, not filler
 *  models: modest TopN (5–8). Landscape (OG/Twitter): Top 5, no constraints. */
export function effectiveTopN(config: ShareConfig): number {
  const cap = config.preset === "og" || config.preset === "twitter" ? 5 : 8;
  return Math.max(1, Math.min(cap, config.topN));
}

export type ShareVariant = "peak" | "offpeak" | null;

/** Peak-/Off-Peak badge from the variant suffix in the display name
 *  (`"Model (Peak)"` / `"Model (Off-Peak)"` from the generator's variantTitle). */
export function rowVariant(displayName: string): ShareVariant {
  const m = displayName.match(/\((Peak|Off-Peak)\)\s*$/);
  if (!m) return null;
  return m[1] === "Peak" ? "peak" : "offpeak";
}

/** Tracker key for the off-peak window lookup (variant suffix stripped). */
export function peakKey(displayName: string): string {
  return displayName
    .replace(/\s*\((Peak|Off-Peak)\)\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Off-peak UTC hour ranges for a row, or null when the source names none
 *  (never guessed — callers mark coverage as source-state instead). */
export function peakWindowsOf(data: ComparisonData, displayName: string): Array<[number, number]> | null {
  const wins = data.peakWindows?.[peakKey(displayName)];
  return Array.isArray(wins) && wins.length > 0 ? wins : null;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** "01:00–04:00 + 06:00–10:00" — always paired with an explicit UTC label. */
export function fmtWindows(wins: Array<[number, number]>): string {
  return wins.map(([a, b]) => `${fmtHour(a)}–${fmtHour(b)}`).join(" + ");
}

/** "01:00–04:00 + 06:00–10:00 (DeepSeek V4 Pro, …)" per distinct window set on
 *  the card, or a source-state note when no windows apply. */
export function peakWindowsSummary(data: ComparisonData, rows: ComparisonRow[], lang: ShareLang): string {
  const seen = new Map<string, { wins: Array<[number, number]>; models: string[] }>();
  for (const row of rows) {
    if (rowVariant(row.displayName) !== "offpeak") continue;
    const wins = peakWindowsOf(data, row.displayName);
    if (!wins) continue;
    const key = JSON.stringify(wins);
    const entry = seen.get(key) ?? { wins, models: [] as string[] };
    const family = row.displayName.replace(/\s*\((Peak|Off-Peak)\)\s*$/i, "").trim();
    if (!entry.models.includes(family)) entry.models.push(family);
    seen.set(key, entry);
  }
  if (seen.size === 0) {
    return lang === "de" ? "keine auf dieser Karte – siehe Quelle" : "none on this card — see source";
  }
  return [...seen.values()].map((e) => `${fmtWindows(e.wins)} (${e.models.join(", ")})`).join("; ");
}

export function metricLabel(lang: ShareLang = "en"): string {
  return SHARE_I18N[lang].metricMax;
}

export function selectTopRows(data: ComparisonData, config: ShareConfig): ComparisonRow[] {
  const pool = data.rows.filter((row) => {
    if (config.matchedOnly && row.status !== "matched") return false;
    if (config.winner !== "all" && row.comparison?.winner !== config.winner) return false;
    // Unlimited sides rank as ∞ (must be included, not dropped as non-finite);
    // only rows with no usable value at all are excluded.
    return maxOf(row) > Number.NEGATIVE_INFINITY;
  });
  // Same order as the main table default: maxRequests desc, unlimited first.
  return sortRows(pool, "maxRequests", "desc").slice(0, effectiveTopN(config));
}

export function shareQuery(config: ShareConfig): string {
  const params = new URLSearchParams();
  params.set("share", "1");
  params.set("topN", String(config.topN));
  params.set("metric", config.metric);
  params.set("winner", config.winner);
  params.set("stheme", config.theme);
  params.set("preset", config.preset);
  params.set("slang", config.shareLang);
  params.set("matched", config.matchedOnly ? "1" : "0");
  if (!config.brand) params.set("brand", "0");
  if (!config.timestamp) params.set("ts", "0");
  return params.toString();
}

export function parseShareQuery(search: string): ShareConfig | null {
  const params = new URLSearchParams(search);
  if (params.get("share") !== "1") return null;
  const topN = Number(params.get("topN") ?? "5");
  const winner = params.get("winner");
  const stheme = params.get("stheme");
  const preset = params.get("preset");
  const slang = params.get("slang");
  return {
    topN: SHARE_TOPN_OPTIONS.includes(topN) ? topN : 5,
    // Single "max" metric: old advantage/difference links coerce to max.
    metric: "max",
    winner: winner === "openCodeGo" || winner === "commandCode" ? winner : "all",
    theme: stheme === "light" ? "light" : "dark",
    // Old "square" links coerce to "og".
    preset: preset === "twitter" || preset === "portrait" || preset === "story" ? preset : "og",
    brand: params.get("brand") !== "0",
    timestamp: params.get("ts") !== "0",
    shareLang: slang === "de" || slang === "en" ? slang : defaultShareLang(),
    // Absent param = page default (applied by the caller); explicit 0/1 wins.
    matchedOnly: params.get("matched") !== "0",
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtVal(v: number | null | undefined, unlimited: boolean | undefined): string {
  if (unlimited) return "∞";
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return compact(v);
}

// Self-contained SVG: explicit hex colors (must stay identical across themes
// for shared images — allowed Tailwind-hex exception), system font stack, no
// external assets so canvas PNG export works without tainting.
export function buildShareSvg(data: ComparisonData, config: ShareConfig): string {
  const { width, height } = SHARE_PRESETS[config.preset];
  const rows = selectTopRows(data, config);
  const s = SHARE_I18N[config.shareLang];
  const locale = config.shareLang === "de" ? "de-DE" : "en-US";
  const dark = config.theme === "dark";
  const bg = dark ? "#1d232a" : "#f8fafc";
  const card = dark ? "#2a323c" : "#ffffff";
  const fg = dark ? "#f2f4f7" : "#1f2937";
  const muted = dark ? "#9aa5b1" : "#6b7280";
  const line = dark ? "#3b4550" : "#e5e7eb";
  const go = "#16a34a";
  const cc = "#0284c7";
  const draw = "#6b7280";

  const pad = 48;
  const isPortrait = config.preset === "portrait" || config.preset === "story";
  const headerH = isPortrait ? 200 : 150;
  const footerH = 64;
  const listTop = headerH + 16;
  // Portrait cards reserve room for the compact constraints block below the list.
  const constraintsH = isPortrait ? 112 : 0;
  const listH = height - listTop - footerH - pad - constraintsH;
  // Fill the available list area: rows share the space evenly (capped so
  // sparse cards don't get giant rows), and the block is vertically centered.
  const rowH = rows.length > 0 ? Math.min(110, listH / rows.length) : 0;
  const startY = listTop + Math.max(0, (listH - rowH * rows.length) / 2);
  // Compact single-line rows when many rows share a short card (e.g. Top 10 on OG 630).
  const comfortable = rowH >= 64;
  const maxForBars = Math.max(
    1,
    ...rows.map((r) => {
      const g = r.openCodeGo?.unlimited ? 0 : (r.openCodeGo?.normalizedRequestsPer10 ?? 0);
      const c = r.commandCode?.unlimited ? 0 : (r.commandCode?.normalizedRequestsPer10 ?? 0);
      return Math.max(g, c);
    }),
  );

  const title = s.cardTitle.replace("{n}", String(rows.length));
  const date = new Date(data.generatedAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  // Footer RIGHT: last update with time (intraday generator runs exist),
  // localized — generatedAt is the data snapshot timestamp.
  const dateTime = new Date(data.generatedAt).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rowSvg = rows
    .map((row, i) => {
      const y = startY + i * rowH;
      const gVal = row.openCodeGo?.normalizedRequestsPer10 ?? null;
      const cVal = row.commandCode?.normalizedRequestsPer10 ?? null;
      const gUn = row.openCodeGo?.unlimited === true;
      const cUn = row.commandCode?.unlimited === true;
      const winner = row.comparison.winner;
      const dot = winner === "openCodeGo" ? go : winner === "commandCode" ? cc : draw;
      const gap =
        row.comparison.normalizedDifference !== null
          ? `+${Math.round(row.comparison.normalizedDifference).toLocaleString(locale)} (${percent(row.comparison.advantagePercent)})`
          : s.gapDraw;
      const price = (side: ComparisonRow["openCodeGo"]): string =>
        side?.unlimited ? s.cardFree : `${money(side?.averageAllowance)} ${s.cardAllowance}`;
      const detail = `Go ${fmtVal(gVal, gUn)} (${price(row.openCodeGo)}) · CC ${fmtVal(cVal, cUn)} (${price(row.commandCode)}) · ${gap}`;
      if (!comfortable) {
        const name = row.displayName.length > 34 ? `${row.displayName.slice(0, 33)}…` : row.displayName;
        const fs = rowH < 40 ? 13 : 15;
        return `<g>
        <rect x="${pad}" y="${y.toFixed(1)}" width="${width - pad * 2}" height="${(rowH - 6).toFixed(1)}" rx="9" fill="${card}" stroke="${line}"/>
        <circle cx="${pad + 24}" cy="${(y + rowH / 2 - 3).toFixed(1)}" r="8" fill="${dot}"/>
        <text x="${pad + 24}" y="${(y + rowH / 2 + 1).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" fill="#ffffff" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${i + 1}</text>
        <text x="${pad + 42}" y="${(y + rowH / 2 + fs / 2 - 2).toFixed(1)}" font-size="${fs}" fill="${fg}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif"><tspan font-weight="700">${esc(name)}</tspan><tspan fill="${muted}"> — ${esc(detail)}</tspan></text>
      </g>`;
      }
      // Bars sit BESIDE the detail text, never behind it: line 2 pairs a
      // fixed-width bar block (left) with the detail text (right). All Y
      // positions derive from the row middle so short rows (OG Top 5 ≈ 70px)
      // keep clear spacing between name, detail and bars.
      const barsW = Math.round(width * 0.28);
      const detailX = pad + 52 + barsW + 16;
      const midY = y + rowH / 2;
      const nameY = midY - 12;
      const barTop = midY + 2;
      const detailY = barTop + 12;
      const gW = gUn ? 0 : ((gVal ?? 0) / maxForBars) * barsW;
      const cW = cUn ? 0 : ((cVal ?? 0) / maxForBars) * barsW;
      // Portrait only: at most one constraint line per row — a Peak-/Off-Peak
      // pill for variant rows, right-aligned on the name line. Off-peak pills
      // always carry the UTC window (never a bare label); peak is the default
      // rate and has no window. Without source windows, no times are invented.
      const variant = isPortrait ? rowVariant(row.displayName) : null;
      const wins = variant === "offpeak" ? peakWindowsOf(data, row.displayName) : null;
      const badgeText =
        variant === "peak" ? "PEAK" : wins ? `OFF-PEAK ${fmtWindows(wins)} UTC` : "OFF-PEAK";
      const badgeW = 28 + badgeText.length * 8.5;
      const badgeX = width - pad - 14 - badgeW;
      const pillTop = nameY - 19;
      const badge =
        variant === null
          ? ""
          : `<rect x="${badgeX.toFixed(1)}" y="${pillTop.toFixed(1)}" width="${badgeW.toFixed(1)}" height="22" rx="11" fill="none" stroke="${line}" stroke-width="1.5"/><text x="${(badgeX + badgeW / 2).toFixed(1)}" y="${(nameY - 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="1" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(badgeText)}</text>`;
      return `<g>
        <rect x="${pad}" y="${y.toFixed(1)}" width="${width - pad * 2}" height="${(rowH - 8).toFixed(1)}" rx="12" fill="${card}" stroke="${line}"/>
        <circle cx="${pad + 30}" cy="${(midY - 4).toFixed(1)}" r="10" fill="${dot}"/>
        <text x="${pad + 30}" y="${midY.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${i + 1}</text>
        <text x="${pad + 52}" y="${nameY.toFixed(1)}" font-size="20" font-weight="700" fill="${fg}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(row.displayName)}</text>${badge}
        <rect x="${pad + 52}" y="${barTop.toFixed(1)}" width="${gW.toFixed(1)}" height="6" rx="3" fill="${go}"/>
        <rect x="${pad + 52}" y="${(barTop + 9).toFixed(1)}" width="${cW.toFixed(1)}" height="6" rx="3" fill="${cc}"/>
        <text x="${detailX.toFixed(1)}" y="${detailY.toFixed(1)}" font-size="13" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(detail)}</text>
      </g>`;
    })
    .join("");

  const emptySvg =
    rows.length === 0
      ? `<text x="${width / 2}" y="${listTop + 60}" text-anchor="middle" font-size="22" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.empty)}</text>`
      : "";

  // Portrait only: compact constraints block (peak/off-peak rules + UTC
  // windows + weekday-coverage source-state + as-of + domain source) anchored
  // below the last row — this fills height instead of filler models.
  const rowsEnd = startY + rowH * rows.length;
  const constraintsSvg = isPortrait
    ? `<text x="${pad}" y="${(rowsEnd + 32).toFixed(1)}" font-size="14" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.constraintsRules)}</text>
  <text x="${pad}" y="${(rowsEnd + 58).toFixed(1)}" font-size="14" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.constraintsWindows.replace("{windows}", peakWindowsSummary(data, rows, config.shareLang)))}</text>
  <text x="${pad}" y="${(rowsEnd + 84).toFixed(1)}" font-size="14" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.constraintsCoverage)} · ${esc(s.constraintsSource.replace("{date}", date))}</text>`
    : "";

  // Footer: LEFT = website domain, RIGHT = last update (date + time),
  // bottom-anchored on every preset (absolute y from card height).
  const footerLeft = config.brand
    ? `<text x="${pad}" y="${height - 26}" font-size="16" font-weight="700" fill="${fg}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.footerDomain)}</text>`
    : "";
  const footerRight = config.timestamp
    ? `<text x="${width - pad}" y="${height - 26}" text-anchor="end" font-size="14" fill="${muted}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.footerUpdated.replace("{datetime}", dateTime))}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <text x="${pad}" y="64" font-size="17" font-weight="700" letter-spacing="3" fill="${go}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(s.cardKicker)} · ${esc(metricLabel(config.shareLang).toUpperCase())}</text>
  <text x="${pad}" y="108" font-size="30" font-weight="800" fill="${fg}" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">${esc(title)}</text>
  <g font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="14" fill="${muted}">
    <circle cx="${pad + 6}" cy="132" r="6" fill="${go}"/><text x="${pad + 20}" y="137">${esc(s.legendGo)}</text>
    <circle cx="${pad + 196}" cy="132" r="6" fill="${cc}"/><text x="${pad + 210}" y="137">${esc(s.legendCc)}</text>
    <circle cx="${pad + 410}" cy="132" r="6" fill="${draw}"/><text x="${pad + 424}" y="137">${esc(s.legendDraw)}</text>
  </g>
  ${rowSvg}${emptySvg}
  ${constraintsSvg}
  ${footerLeft}${footerRight}
</svg>`;
}
