import test from "node:test";
import assert from "node:assert/strict";
import { loadModelMap, normalizeName, canonicalName, displayNameOf } from "../scripts/model-map.mjs";
import {
  TARGET_PRICE,
  COMMAND_CODE_PAID_PRICE,
  AVERAGE_MESSAGE_PATTERN,
  DRAW_THRESHOLD_PERCENT,
  finite,
  isFree,
  prettyName,
  requestCost,
  average,
  percentile,
  distribution,
  commandCodeAllowance,
  computeFinite,
  providerValue,
  variantKind,
  variantTitle,
  compareGroup,
  findOutliers,
  buildComparison,
} from "../scripts/comparison-core.mjs";

// Leeres Modell-Map für Tests ohne Alias-Logik.
const EMPTY_MAP = { aliases: {}, sourceAliases: {}, prettyNames: {}, ignoredNames: [] };

// ---------------------------------------------------------------------------
// Kartesisches-Kern-Module: diese Tests kommen aus dem echten Modul
// (comparison-core.mjs), nicht aus nachgebauten Mirror-Properties.
// ---------------------------------------------------------------------------

test("requestCost: 5% Input + 95% Cached-Write, Cached-Write-Fallback = Input", () => {
  const pattern = { input: 1000, cachedRead: 10000, output: 200 };
  // cachedWrite vorhanden: inputPrice = 0.05*1 + 0.95*0.4 = 0.43
  assert.equal(
    requestCost({ input: 1, output: 2, cachedRead: 0.5, cachedWrite: 0.4 }, pattern),
    (0.43 * 1000 + 0.5 * 10000 + 2 * 200) / 1_000_000
  );
  // cachedWrite null → Input-Preis als Fallback → 0.05*1 + 0.95*1 = 1
  assert.equal(
    requestCost({ input: 1, output: 2, cachedRead: 0.5, cachedWrite: null }, pattern),
    (1 * 1000 + 0.5 * 10000 + 2 * 200) / 1_000_000
  );
  // Fehlende Werte/Pattern → null (nicht NaN)
  assert.equal(requestCost({ input: null, output: 2, cachedRead: 0.5, cachedWrite: null }, pattern), null);
  assert.equal(requestCost({ input: 1, output: null, cachedRead: 0.5, cachedWrite: null }, pattern), null);
  assert.equal(requestCost({ input: 1, output: 2, cachedRead: null, cachedWrite: null }, pattern), null);
  assert.equal(requestCost({ input: 1, output: 2, cachedRead: 0.5, cachedWrite: null }, null), null);
});

test("percentile/average/distribution: aktiv nur über endliche Werte (∞ ausgeklammert)", () => {
  assert.equal(percentile([100, 200, Infinity], 0.5), 150);
  assert.equal(percentile([], 0.5), null);
  assert.equal(percentile([1, 2, 4, 8], 0.25), 1.75);
  assert.equal(average([100, 200, Infinity]), 150);
  assert.equal(average([]), null);
  assert.deepEqual(distribution([100, 200, Infinity]), {
    count: 2,
    min: 100,
    max: 200,
    mean: 150,
    median: 150,
    p25: 125,
    p75: 175,
  });
  assert.deepEqual(distribution([]), { count: 0, min: 0, max: 0, mean: 0, median: 0, p25: 0, p75: 0 });
});

test("isFree/finite/prettyName: Command Code deal.free, OpenCode Go usage=null", () => {
  assert.equal(isFree({ deal: { free: true } }, "commandCode"), true);
  assert.equal(isFree({ deal: { free: false } }, "commandCode"), false);
  assert.equal(isFree({ usage: null }, "openCodeGo"), true);
  assert.equal(isFree({ usage: 60 }, "openCodeGo"), false);
  assert.equal(finite(3), 3);
  assert.equal(finite(Infinity), null);
  assert.equal(finite(null), null);
  assert.equal(prettyName("Grok 4.6 (latest)"), "Grok 4.6");
  assert.equal(prettyName("  A   B  "), "A B");
});

test("commandCodeAllowance: allowances.goat → plan.defaultAllowance → plan.creditsMonthly", () => {
  const plan = { defaultAllowance: 20, creditsMonthly: 70 };
  assert.equal(commandCodeAllowance({ allowances: { goat: 60 } }, plan), 60);
  assert.equal(commandCodeAllowance({ allowances: { goat: null } }, plan), 20);
  assert.equal(commandCodeAllowance({ allowances: {} }, { defaultAllowance: null, creditsMonthly: 70 }), 70);
});

test("computeFinite: normalisiert auf $10 und hält effective = cost*paid/allowance", () => {
  const go = { usage: 60, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null };
  const pattern = { input: 1000, cachedRead: 50000, output: 200 };
  const cost = requestCost(go, pattern); // 0.00264
  const v = computeFinite([go], "openCodeGo", 10, null, pattern);
  assert.equal(v.variantCount, 1);
  assert.equal(v.unlimited, false);
  assert.equal(v.averageAllowance, 60);
  assert.ok(Math.abs(v.averageRequestCost - cost) < 1e-12);
  assert.ok(Math.abs(v.normalizedRequestsPer10 - (60 / cost) * (TARGET_PRICE / 10)) < 1e-9);
  assert.ok(Math.abs(v.effectiveRequestCostAtPaidPrice - (cost * 10) / 60) < 1e-12);
  assert.equal(computeFinite([], "openCodeGo", 10, null, pattern), null);
  // Nutzung 0 → kein finiter Wert
  assert.equal(computeFinite([{ ...go, usage: 0 }], "openCodeGo", 10, null, pattern), null);
});

test("providerValue: paid-only endlich, free-only unendlich, paid+free unendlich mit paid-Subwerten", () => {
  const go = (usage) => ({ usage, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null });
  const pattern = { input: 1000, cachedRead: 50000, output: 200 };

  const paid = providerValue([go(60)], "openCodeGo", 10, null, pattern);
  assert.equal(paid.unlimited, false);
  assert.ok(Number.isFinite(paid.normalizedRequestsPer10));

  const freeOnly = providerValue([go(null)], "openCodeGo", 10, null, pattern);
  assert.equal(freeOnly.unlimited, true);
  assert.equal(freeOnly.normalizedRequestsPer10, Infinity);
  assert.equal(freeOnly.averageRequestCost, 0);

  const mixed = providerValue([go(60), go(null)], "openCodeGo", 10, null, pattern);
  assert.equal(mixed.unlimited, true);
  assert.equal(mixed.normalizedRequestsPer10, Infinity);
  assert.equal(mixed.averageRequestsPerMonth, Infinity);
  assert.ok(Number.isFinite(mixed.paidNormalizedRequestsPer10), "paid-Subwert bleibt erhalten");
  assert.equal(providerValue([], "openCodeGo", 10, null, pattern), null);
});

test("compareGroup: draw <10%, Sieger bei großem Vorsprung, Free-Marge unendlich, promoExpires", () => {
  const goModel = (usage, price) => ({
    name: "Alpha",
    usage,
    input: price,
    output: price * 2,
    cachedRead: price / 2,
    cachedWrite: null,
    pattern: { input: 1000, cachedRead: 50000, output: 200 },
  });
  const ccPaid = { id: "alpha", name: "Alpha", input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, allowances: { goat: 60 } };
  const plan = { id: "goat", name: "GOAT", defaultAllowance: null, creditsMonthly: 70 };

  // identische Preise → draw (advantagePercent < 10, normalizedDifference in Requests)
  let row = compareGroup({ canonical: "alpha", kind: null, openCodeGo: [goModel(60, 0.1)], commandCode: [ccPaid] }, 10, 10.77, plan, EMPTY_MAP);
  assert.equal(row.status, "matched");
  assert.equal(row.comparison.winner, "draw");
  assert.ok(row.comparison.advantagePercent < DRAW_THRESHOLD_PERCENT);

  // Command Code 14× teurer → OpenCode Go gewinnt deutlich
  const expensive = { ...ccPaid, input: 1.5, output: 4, cachedRead: 0.5 };
  row = compareGroup({ canonical: "alpha", kind: null, openCodeGo: [goModel(60, 0.1)], commandCode: [expensive] }, 10, 10.77, plan, EMPTY_MAP);
  assert.equal(row.comparison.winner, "openCodeGo");
  assert.ok(row.comparison.advantagePercent > 100);

  // Command Code free → unendlicher Vorsprung, kein Prozentwert
  const freeCc = { ...ccPaid, deal: { free: true, expires: "2026-12-31" }, input: 0, output: 0, cachedRead: 0 };
  row = compareGroup({ canonical: "alpha", kind: null, openCodeGo: [goModel(60, 0.1)], commandCode: [freeCc] }, 10, 10.77, plan, EMPTY_MAP);
  assert.equal(row.comparison.winner, "commandCode");
  assert.equal(row.comparison.advantagePercent, null);
  assert.deepEqual(row.freeIncluded, { openCodeGo: false, commandCode: true });
  assert.equal(row.promoExpires, "2026-12-31");

  // beide free → draw, kein Vorsprung
  row = compareGroup({ canonical: "alpha", kind: null, openCodeGo: [goModel(null, 0)], commandCode: [freeCc] }, 10, 10.77, plan, EMPTY_MAP);
  assert.equal(row.comparison.winner, "draw");
  assert.equal(row.comparison.advantagePercent, null);
});

test("variantKind/variantTitle: Peak-Splits getrennt, anderes Tier → null", () => {
  assert.equal(variantKind("Peak"), "peak");
  assert.equal(variantKind("Off-Peak"), "offpeak");
  assert.equal(variantKind("off peak"), "offpeak");
  assert.equal(variantKind("Standard / Long context"), null);
  assert.equal(variantKind(undefined), null);
  assert.equal(variantTitle("peak"), "Peak");
  assert.equal(variantTitle("offpeak"), "Off-Peak");
  assert.equal(variantTitle(null), null);
});

test("findOutliers: Tukey-IQR auf log2-Ratio markiert Ausreißer", () => {
  const mk = (name, g, c) => ({
    displayName: name,
    status: "matched",
    openCodeGo: { normalizedRequestsPer10: g },
    commandCode: { normalizedRequestsPer10: c },
    comparison: { advantagePercent: null, winner: "openCodeGo" },
  });
  const rows = [mk("A", 100, 100), mk("B", 100, 100), mk("C", 100, 100), mk("D", 6400, 100)];
  const outliers = findOutliers(rows);
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].model, "D");
  assert.equal(findOutliers(rows.slice(0, 3)).length, 0);
});

// ---------------------------------------------------------------------------
// Pipeline (buildComparison): deterministisch aus Fixture-Snapshots
// ---------------------------------------------------------------------------

const fixtureGo = {
  fetchedAt: "2026-08-31T08:00:00.000Z",
  monthlyCost: 10,
  monthlyCredit: 60,
  models: [
    { id: "alpha", name: "Alpha", usage: 60, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
    { id: "beta", name: "Beta", usage: 60, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
    { id: "delta", name: "Delta", usage: 60, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
    { id: "only-go", name: "Only Go", usage: 60, input: 0.5, output: 1, cachedRead: 0.1, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
  ],
};

const fixtureCc = {
  fetchedAt: "2026-08-31T09:00:00.000Z",
  plans: [{ id: "goat", name: "GOAT", priceMonthly: 10, defaultAllowance: null, creditsMonthly: 70 }],
  models: [
    { id: "alpha", name: "Alpha", input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, allowances: { goat: 60 }, availability: { goat: true } },
    { id: "beta", name: "Beta", input: 1.5, output: 4, cachedRead: 0.5, cachedWrite: null, allowances: { goat: 60 }, availability: { goat: true } },
    { id: "delta", name: "Delta", input: 0, output: 0, cachedRead: 0, cachedWrite: 0, deal: { free: true }, allowances: { goat: 0 }, availability: { goat: true } },
    { id: "hidden", name: "Hidden", input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, allowances: { goat: 60 }, availability: { goat: false } },
  ],
};

test("buildComparison: deterministische Pipeline über Fixture-Snapshots", () => {
  const out = buildComparison(fixtureGo, fixtureCc, EMPTY_MAP);
  assert.equal(out.schemaVersion, 1);
  assert.equal(out.targetMonthlyPrice, TARGET_PRICE);
  assert.equal(out.sources.commandCode.paidMonthly, COMMAND_CODE_PAID_PRICE);
  assert.equal(out.sources.commandCode.creditsMonthly, 70);

  // Zeilen sortiert nach displayName (numeric, base).
  const names = out.rows.map((r) => r.displayName);
  assert.deepEqual([...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })), names);
  // goat-unverfügbare CC-Modelle sind ausgeschlossen (Hidden fehlt).
  assert.ok(!names.some((n) => n.includes("Hidden")));

  const by = (n) => out.rows.find((r) => r.displayName === n);
  // Alpha identisch → draw
  assert.equal(by("Alpha").comparison.winner, "draw");
  // Beta: CC 14× teurer → OpenCode Go gewinnt
  assert.equal(by("Beta").comparison.winner, "openCodeGo");
  // Delta: nur bei CC free → Command Code mit ∞-Vorsprung
  assert.equal(by("Delta").comparison.winner, "commandCode");
  assert.equal(by("Delta").commandCode.normalizedRequestsPer10, Infinity);
  // Only Go ohne CC-Pendant → unmatched, aus Statistik ausgenommen
  assert.equal(by("Only Go").status, "openCodeGoOnly");

  assert.equal(out.statistics.matchedModels, 3);
  assert.equal(out.statistics.totalModels, 4);
  assert.deepEqual(out.statistics.winnerCounts, { openCodeGo: 1, commandCode: 1, draw: 1 });
  // ∞-Requests (Delta) dürfen die Verteilungen nicht vergiften.
  assert.ok(out.statistics.requestsPer10.commandCode.count <= 2);
  // Unmatched-Zeilen → Warnung
  assert.ok(out.warnings.some((w) => w.includes("without a model on both plans")));

  // Sortier-Helfer in den Daten (biggestDifferences) existieren.
  assert.ok(Array.isArray(out.statistics.biggestDifferences));
});

test("buildComparison: wirft, wenn der GOAT-Plan fehlt", () => {
  const noPlan = { ...fixtureCc, plans: [{ id: "pro", name: "Pro", priceMonthly: 20, defaultAllowance: null, creditsMonthly: 80 }] };
  assert.throws(() => buildComparison(fixtureGo, noPlan, EMPTY_MAP), /plan goat/);
});

test("buildComparison: Free nur auf der OpenCode-Seite → OpenCode Go gewinnt (∞)", () => {
  const goWithDeltaFree = {
    ...fixtureGo,
    models: [
      ...fixtureGo.models.filter((m) => m.id !== "delta"),
      { id: "delta", name: "Delta", usage: null, input: 0, output: 0, cachedRead: 0, cachedWrite: 0 },
    ],
  };
  const ccDeltaPaid = {
    ...fixtureCc,
    models: fixtureCc.models.map((m) =>
      m.id === "delta" ? { ...m, deal: null, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, allowances: { goat: 60 } } : m
    ),
  };
  const out = buildComparison(goWithDeltaFree, ccDeltaPaid, EMPTY_MAP);
  const delta = out.rows.find((r) => r.displayName === "Delta");
  assert.equal(delta.status, "matched");
  assert.equal(delta.freeIncluded.openCodeGo, true);
  assert.equal(delta.freeIncluded.commandCode, false);
  assert.equal(delta.comparison.winner, "openCodeGo");
  assert.equal(delta.openCodeGo.normalizedRequestsPer10, Infinity);
});

// ---------------------------------------------------------------------------
// Modell-Map (echtes Modul, liest data/model-map.json)
// ---------------------------------------------------------------------------

test("canonicalName: Muse Spark 1.2 Contributor mappt beide Quellen auf dasselbe kanonische Modell", async () => {
  const modelMap = await loadModelMap();
  assert.equal(canonicalName(modelMap, "Muse Spark 1.2", "openCodeGo"), "muse-spark-1.2-contributor");
  assert.equal(canonicalName(modelMap, "Muse Spark 1.2 Contributor", "commandCode"), "muse-spark-1.2-contributor");
  assert.equal(canonicalName(modelMap, "Muse Spark 1.2", "commandCode"), "musespark12");
});

test("canonicalName: sourceAliases gewinnen vor globalen aliases", async () => {
  const modelMap = await loadModelMap();
  assert.equal(canonicalName(modelMap, "hy3", "openCodeGo"), "hy3");
  assert.equal(canonicalName(modelMap, "tencenthy3", "commandCode"), "hy3");
});

test("displayNameOf: prettyNames überschreiben den Quellnamen für kanonische Modelle", async () => {
  const modelMap = await loadModelMap();
  assert.equal(displayNameOf(modelMap, "Muse Spark 1.2", "muse-spark-1.2-contributor"), "Muse Spark 1.2 Contributor");
  assert.equal(displayNameOf(modelMap, "Grok 4.5", "grok45"), "Grok 4.5");
});

test("normalizeName: normiert auf lowercase ohne Trenner/Suffixe", () => {
  assert.equal(normalizeName("DeepSeek V4 Flash (latest)"), "deepseekv4flash");
  assert.equal(normalizeName("GLM-5.2"), "glm52");
  assert.equal(normalizeName("Hy3 preview"), "hy3");
});