// Static OG share-card snapshot → public/share/og.png (copied to dist/ by Vite).
// Layout mirror of src/lib/share.ts for the OG landscape card
// (top 5 matched rows by max requests per $10, dark, OG 1200×630).
// Regenerate: `node scripts/build-share.mjs` (also runs as `prebuild`).
// Plain node (no TS step); only dependency is @resvg/resvg-js (devDependency).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INPUT = join(ROOT, "public", "data", "latest.json");
const OUTPUT = join(ROOT, "public", "share", "og.png");

const W = 1200;
const H = 630;
const SITE = "ai-10-usd.all-the.rest";

if (!existsSync(INPUT)) {
  console.error(
    `build-share: ${INPUT} not found — run \`pnpm generate\` first (needs network access to the ocgo/cc trackers).`
  );
  process.exit(1);
}

const data = JSON.parse(readFileSync(INPUT, "utf8"));
if (!Array.isArray(data.rows)) {
  console.error(`build-share: ${INPUT} contains no rows array — run \`pnpm generate\` first.`);
  process.exit(1);
}

// Same ranking as the page default and the share dialog default
// (src/lib/share.ts selectTopRows with matchedOnly: true, winner: all):
// maxRequests desc, unlimited sides rank as ∞, ties by displayName.
function maxOf(row) {
  const go = row.openCodeGo?.unlimited ? Infinity : (row.openCodeGo?.normalizedRequestsPer10 ?? null);
  const cc = row.commandCode?.unlimited ? Infinity : (row.commandCode?.normalizedRequestsPer10 ?? null);
  if (go === null && cc === null) return Number.NEGATIVE_INFINITY;
  return Math.max(go ?? Number.NEGATIVE_INFINITY, cc ?? Number.NEGATIVE_INFINITY);
}

const rows = data.rows
  .filter((row) => row.status === "matched" && maxOf(row) > Number.NEGATIVE_INFINITY)
  .sort((a, b) => {
    const diff = maxOf(b) - maxOf(a);
    if (diff !== 0 && Number.isFinite(diff)) return diff;
    if (maxOf(b) !== maxOf(a)) return maxOf(b) === Infinity ? 1 : -1;
    return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" });
  })
  .slice(0, 5);

if (rows.length === 0) {
  console.error(`build-share: no matched rows in ${INPUT} — nothing to render.`);
  process.exit(1);
}

function fmtReq(v, unlimited) {
  if (unlimited) return "∞";
  if (v === null || v === undefined || !Number.isFinite(v)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dark runtime-card palette (src/lib/share.ts buildShareSvg, theme dark).
const p = {
  bg: "#1d232a",
  card: "#2a323c",
  fg: "#f2f4f7",
  muted: "#9aa5b1",
  line: "#3b4550",
  go: "#16a34a",
  cc: "#0284c7",
  draw: "#6b7280",
};
const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
const pad = 48;
const headerH = 150;
const footerH = 64;
const listTop = headerH + 16;
const listH = H - listTop - footerH - pad;
const rowH = Math.min(110, listH / rows.length);
const startY = listTop + Math.max(0, (listH - rowH * rows.length) / 2);
const maxForBars = Math.max(
  1,
  ...rows.map((r) => {
    const g = r.openCodeGo?.unlimited ? 0 : (r.openCodeGo?.normalizedRequestsPer10 ?? 0);
    const c = r.commandCode?.unlimited ? 0 : (r.commandCode?.normalizedRequestsPer10 ?? 0);
    return Math.max(g, c);
  })
);
const barsW = Math.round(W * 0.28);
const detailX = pad + 52 + barsW + 16;
const generated = new Date(data.generatedAt);
const stamp = Number.isNaN(generated.getTime())
  ? String(data.generatedAt ?? "")
  : `${generated.toISOString().slice(0, 10)} ${generated.toISOString().slice(11, 16)} UTC`;

const rowSvg = rows
  .map((row, i) => {
    const y = startY + i * rowH;
    const midY = y + rowH / 2;
    const nameY = midY - 12;
    const barTop = midY + 2;
    const detailY = barTop + 12;
    const gVal = row.openCodeGo?.normalizedRequestsPer10 ?? null;
    const cVal = row.commandCode?.normalizedRequestsPer10 ?? null;
    const gUn = row.openCodeGo?.unlimited === true;
    const cUn = row.commandCode?.unlimited === true;
    const winner = row.comparison?.winner;
    const dot = winner === "openCodeGo" ? p.go : winner === "commandCode" ? p.cc : p.draw;
    const gW = gUn ? 0 : ((gVal ?? 0) / maxForBars) * barsW;
    const cW = cUn ? 0 : ((cVal ?? 0) / maxForBars) * barsW;
    const detail = `Go ${fmtReq(gVal, gUn)} · CC ${fmtReq(cVal, cUn)} / $10`;
    return (
      `<g><rect x="${pad}" y="${y.toFixed(1)}" width="${W - pad * 2}" height="${(rowH - 8).toFixed(1)}" rx="12" fill="${p.card}" stroke="${p.line}"/>` +
      `<circle cx="${pad + 30}" cy="${(midY - 4).toFixed(1)}" r="10" fill="${dot}"/>` +
      `<text x="${pad + 30}" y="${midY.toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff" font-family="${FONT}">${i + 1}</text>` +
      `<text x="${pad + 52}" y="${nameY.toFixed(1)}" font-size="20" font-weight="700" fill="${p.fg}" font-family="${FONT}">${esc(row.displayName)}</text>` +
      `<rect x="${pad + 52}" y="${barTop.toFixed(1)}" width="${gW.toFixed(1)}" height="6" rx="3" fill="${p.go}"/>` +
      `<rect x="${pad + 52}" y="${(barTop + 9).toFixed(1)}" width="${cW.toFixed(1)}" height="6" rx="3" fill="${p.cc}"/>` +
      `<text x="${detailX.toFixed(1)}" y="${detailY.toFixed(1)}" font-size="13" fill="${p.muted}" font-family="${FONT}">${esc(detail)}</text></g>`
    );
  })
  .join("");

const title = `Top ${rows.length} models per $10 — OpenCode Go vs Command Code GOAT`;
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">` +
  `<rect width="${W}" height="${H}" fill="${p.bg}"/>` +
  `<text x="${pad}" y="64" font-size="17" font-weight="700" letter-spacing="3" fill="${p.go}" font-family="${FONT}">AI PLANS AT $10 · MAX REQUESTS / $10</text>` +
  `<text x="${pad}" y="108" font-size="30" font-weight="800" fill="${p.fg}" font-family="${FONT}">${esc(title)}</text>` +
  `<g font-family="${FONT}" font-size="14" fill="${p.muted}">` +
  `<circle cx="${pad + 6}" cy="132" r="6" fill="${p.go}"/><text x="${pad + 20}" y="137">OpenCode Go wins</text>` +
  `<circle cx="${pad + 196}" cy="132" r="6" fill="${p.cc}"/><text x="${pad + 210}" y="137">Command Code wins</text>` +
  `<circle cx="${pad + 410}" cy="132" r="6" fill="${p.draw}"/><text x="${pad + 424}" y="137">Draw (&lt;10%)</text></g>` +
  rowSvg +
  `<text x="${pad}" y="${H - 26}" font-size="16" font-weight="700" fill="${p.fg}" font-family="${FONT}">${esc(SITE)}</text>` +
  `<text x="${W - pad}" y="${H - 26}" text-anchor="end" font-size="14" fill="${p.muted}" font-family="${FONT}">Updated ${esc(stamp)}</text></svg>`;

const resvg = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: "sans-serif" } });
const png = resvg.render().asPng();
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, png);
console.log(`public/share/og.png written (${rows.length} rows, ${png.length} bytes)`);
