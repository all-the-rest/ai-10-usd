import test from "node:test";
import assert from "node:assert/strict";
import { sortRows } from "../src/lib/sort.ts";

// Echte UI-Sortierung (`src/lib/sort.ts`): ∞-Unlimited-Seiten müssen bei allen
// Requests/Difference-Sortierungen vor endlichen Werten ranken; null-Tertia
// (fehlende Daten) ans Ende; ∞-Ties brechen per displayName. Node importiert die
// .ts-Datei via Type-Stripping (`--experimental-strip-types`, CI Node 22).
//
// JSON kann kein Infinity: unlimited serialisiert normalizedRequestsPer10 als
// null; das `unlimited`-Flag steht für ∞. Die Fixtures spiegeln exakt, was in
// `public/data/latest.json` steht.

const finite = {
  displayName: "Finite",
  openCodeGo: { unlimited: false, normalizedRequestsPer10: 5000 },
  commandCode: { unlimited: false, normalizedRequestsPer10: 3000 },
  comparison: { normalizedDifference: 100, advantagePercent: 50 },
};
const unlimited = {
  displayName: "Unlimited",
  openCodeGo: { unlimited: false, normalizedRequestsPer10: 16000 },
  commandCode: { unlimited: true, normalizedRequestsPer10: null },
  comparison: { normalizedDifference: null, advantagePercent: null },
};
const bothAll = {
  displayName: "Alpha (both)",
  openCodeGo: { unlimited: true, normalizedRequestsPer10: null },
  commandCode: { unlimited: true, normalizedRequestsPer10: null },
  comparison: { normalizedDifference: null, advantagePercent: null },
};

const nameOrder = (rows) => rows.map((r) => r.displayName);
const ROWS = [finite, unlimited, bothAll];

test("sortRows: maxRequests — endliche Werte sortieren, ∞ bleibt immer oben", () => {
  assert.deepEqual(nameOrder(sortRows(ROWS, "maxRequests", "desc")), [
    "Alpha (both)",
    "Unlimited",
    "Finite",
  ]);
  // asc: endliche aufsteigend, ∞-Zeilen (alle nicht-endlich) folgen nach Name.
  assert.deepEqual(nameOrder(sortRows(ROWS, "maxRequests", "asc")), [
    "Finite",
    "Alpha (both)",
    "Unlimited",
  ]);
});

test("sortRows: openCodeRequests / commandCodeRequests ranken Unlimited-first", () => {
  assert.deepEqual(nameOrder(sortRows(ROWS, "openCodeRequests", "desc")), [
    "Alpha (both)", // ∞
    "Unlimited", // 16000
    "Finite", // 5000
  ]);
  assert.deepEqual(nameOrder(sortRows(ROWS, "commandCodeRequests", "desc")), [
    "Alpha (both)", // ∞ (Tie mit Unlimited, Name gewinnt)
    "Unlimited", // ∞
    "Finite", // 3000
  ]);
});

test("sortRows: normalizedDifference / advantage ranken Unlimited-first (∞-Lücke)", () => {
  assert.deepEqual(nameOrder(sortRows(ROWS, "normalizedDifference", "desc")), [
    "Alpha (both)",
    "Unlimited",
    "Finite",
  ]);
  assert.deepEqual(nameOrder(sortRows(ROWS, "advantage", "desc")), [
    "Alpha (both)",
    "Unlimited",
    "Finite",
  ]);
});

test("sortRows: model sortiert numerisch nach displayName", () => {
  assert.deepEqual(nameOrder(sortRows(ROWS, "model", "asc")), [
    "Alpha (both)",
    "Finite",
    "Unlimited",
  ]);
  assert.deepEqual(nameOrder(sortRows(ROWS, "model", "desc")), [
    "Unlimited",
    "Finite",
    "Alpha (both)",
  ]);
});

test("sortRows: fehlende Werte (null) sortieren ans Ende", () => {
  const missing = {
    displayName: "Missing",
    openCodeGo: null,
    commandCode: null,
    comparison: { normalizedDifference: null, advantagePercent: null },
  };
  assert.deepEqual(nameOrder(sortRows([unlimited, missing, finite], "maxRequests", "desc")), [
    "Unlimited",
    "Finite",
    "Missing",
  ]);
});