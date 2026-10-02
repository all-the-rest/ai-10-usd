import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SHARE_CONFIG,
  buildShareSvg,
  fmtWindows,
  peakKey,
  peakWindowsOf,
  peakWindowsSummary,
  rowVariant,
} from "../src/lib/share.ts";

// Real `src/lib/share.ts` (no mirror implementation), run through Node's
// type-stripping.
//
// SCOPE: the share card shows the **legacy UTC window line** and nothing else.
// The weekday badges/scope/holiday rendering on the card was deliberately
// dropped (Nutzerentscheid 2026-10-02: für diese $10-Vergleichsseite nicht
// relevant). The weekday scope lives in the table (`src/PeakCell.svelte`) and is
// tested in `tests/peak.test.mjs`. What is covered here is the contract that
// remains: `peakWindows` is **provider-dimensioned**, and the card aggregates over
// both providers without ever guessing weekday information.

const WINDOWS = [[1, 4], [6, 10]];

function data(peakWindows) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-02T00:00:00.000Z",
    targetMonthlyPrice: 10,
    peakWindows: { openCodeGo: peakWindows ?? null, commandCode: null },
    peakRules: { openCodeGo: null, commandCode: null },
    holidayCalendars: { openCodeGo: null, commandCode: null },
    sources: {},
    methodology: {},
    rows: [],
    statistics: {},
    warnings: [],
  };
}

const row = (displayName) => ({ displayName });

test("rowVariant erkennt Peak/Off-Peak aus dem displayName", () => {
  assert.equal(rowVariant("DeepSeek V4.1 Flash (Off-Peak)"), "offpeak");
  assert.equal(rowVariant("DeepSeek V4.1 Flash (Peak)"), "peak");
  // Ohne Variant-Suffix gibt es keine Badge — `null`, kein erfundener Zustand.
  assert.equal(rowVariant("DeepSeek V4 Pro"), null);
});

test("peakKey normalisiert Punkte/Leerzeichen (V4.1-Bug)", () => {
  assert.equal(peakKey("DeepSeek V4.1 Flash (Off-Peak)"), "deepseekv41flash");
  assert.equal(peakKey("DeepSeek V4 Pro (Peak)"), "deepseekv4pro");
});

test("peakWindowsOf liest provider-dimensioniert und findet Legacy-Fenster", () => {
  assert.deepEqual(peakWindowsOf(data({ "deepseekv41flash": WINDOWS }), "DeepSeek V4.1 Flash (Off-Peak)"), WINDOWS);
  // kein Treffer → null, **nie** geraten
  assert.equal(peakWindowsOf(data({ alpha: WINDOWS }), "DeepSeek V4.1 Flash (Off-Peak)"), null);
  assert.equal(peakWindowsOf(data(null), "DeepSeek V4.1 Flash (Off-Peak)"), null);
});

test("peakWindowsOf aggregiert über beide Provider", () => {
  const d = data({ "deepseekv4pro": WINDOWS });
  // Command Code liefert die Daten, Go nicht → die Karte darf nichts verlieren.
  d.peakWindows.commandCode = { "deepseekv4pro": WINDOWS };
  assert.deepEqual(peakWindowsOf(d, "DeepSeek V4 Pro (Off-Peak)"), WINDOWS);
});

test("peakWindowsOf fällt auf peakRules[].peak.windowsUtc zurück (neue Form)", () => {
  const rule = (windowsUtc) => ({
    timezone: "Asia/Shanghai",
    peak: { days: [1, 2, 3, 4, 5], windowsUtc },
    offPeak: { days: [6, 7], allDay: true },
  });
  const d = data(null); // Legacy-Fenster fehlen (neue Quelle)
  d.peakRules = { openCodeGo: null, commandCode: { deepseekv41flash: rule(WINDOWS) } };
  assert.deepEqual(peakWindowsOf(d, "DeepSeek V4.1 Flash (Off-Peak)"), WINDOWS);

  // Legacy hat Vorrang, wenn vorhanden (Dual-Toleranz).
  d.peakWindows = { openCodeGo: { deepseekv41flash: [[9, 10]] }, commandCode: null };
  assert.deepEqual(peakWindowsOf(d, "DeepSeek V4.1 Flash (Off-Peak)"), [[9, 10]]);

  // Keine Fenster in der Regel → null, nie geraten.
  d.peakWindows = { openCodeGo: null, commandCode: null };
  d.peakRules.commandCode.deepseekv41flash = rule([]);
  assert.equal(peakWindowsOf(d, "DeepSeek V4.1 Flash (Off-Peak)"), null);
});

test("fmtWindows formatiert UTC-Fenster", () => {
  assert.equal(fmtWindows(WINDOWS), "01:00–04:00 + 06:00–10:00");
});

test("peakWindowsSummary: Fenster-Zeile bzw. ehrlicher Source-State", () => {
  const d = data({ "deepseekv41flash": WINDOWS });
  const rows = [row("DeepSeek V4.1 Flash (Off-Peak)")];

  const en = peakWindowsSummary(d, rows, "en");
  assert.match(en, /01:00–04:00 \+ 06:00–10:00/);
  assert.match(en, /DeepSeek V4\.1 Flash/);

  const de = peakWindowsSummary(d, rows, "de");
  assert.match(de, /01:00–04:00 \+ 06:00–10:00/);

  // Keine Fenster in der Quelle → Source-State statt erfundener Angabe.
  assert.equal(peakWindowsSummary(data(null), rows, "en"), "none on this card — see source");
  assert.equal(peakWindowsSummary(data(null), rows, "de"), "keine auf dieser Karte – siehe Quelle");
});

test("buildShareSvg rendert ohne erfundenen Wochentags-Scope (Revert gehalten)", () => {
  const d = data({ "deepseekv41flash": WINDOWS });
  d.rows = [
    {
      displayName: "DeepSeek V4.1 Flash (Off-Peak)",
      canonicalModel: "deepseek-v4.1-flash",
      status: "matched",
      comparison: { winner: "openCodeGo", winnerMarginPct: 10, normalizedDifference: 1, advantagePercent: 10, openCodeGoShare: 0.6 },
      openCodeGo: { sourceName: "DeepSeek V4.1 Flash", normalizedRequestsPer10: 130000, averageRequestsPerMonth: 130000, averageAllowance: 60, paidNormalizedRequestsPer10: 130000, unlimited: false },
      commandCode: null,
    },
  ];

  // Portrait: trägt den Constraints-Block mit der UTC-Fensterzeile (Header-
  // Verhalten). Die Zeile ist da — aber **kein** Wochentags-Scope/Badge.
  const svg = buildShareSvg(d, { ...DEFAULT_SHARE_CONFIG, topN: 5, preset: "portrait" });
  assert.match(svg, /<svg/);
  assert.match(svg, /DeepSeek V4\.1 Flash/);
  assert.match(svg, /01:00/); // UTC-Fenster (Badge + Constraints)
  assert.doesNotMatch(svg, /Mon–Fri/);
  assert.doesNotMatch(svg, /Sat–Sun/);
  assert.doesNotMatch(svg, /OFF-PEAK (Mon|Sat)/);

  // Landscape (OG): der Constraints-Block ist bewusst Portrait-only — hier bleibt
  // die Zeile weg, statt sie zu erfinden.
  const og = buildShareSvg(d, { ...DEFAULT_SHARE_CONFIG, topN: 5, preset: "og" });
  assert.match(og, /DeepSeek V4\.1 Flash/);
  assert.doesNotMatch(og, /01:00/);
});