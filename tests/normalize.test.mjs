import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_OPENCODE_PLAN,
  pickCheapestPlan,
  resolveOpenCodeUsage,
  normalizeOpenCodeData,
} from "../scripts/normalize.mjs";
import { isFree, buildComparison } from "../scripts/comparison-core.mjs";

// Dual compatibility: the OpenCode Go tracker still serves the legacy shape
// (top-level monthlyCost/monthlyCredit + flat model.usage) while migrating to
// the multi-plan shape (plans[] + per-plan usage maps). Both frozen fixtures go
// through the SAME normalization and must yield the same internal contract.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const readFixture = (name) => JSON.parse(readFileSync(join(ROOT, "tests", "fixtures", name), "utf8"));

const legacy = readFixture("opencode-legacy.json");
const plans = readFixture("opencode-plans.json");

const byName = (models, name) => models.find((model) => model.name === name);

test("pickCheapestPlan: wählt den günstigsten, bei Gleichstand den zuerst gelisteten", () => {
  assert.equal(pickCheapestPlan([{ id: "go-plus", priceMonthly: 40 }, { id: "go", priceMonthly: 10 }]).id, "go");
  assert.equal(pickCheapestPlan([{ id: "a", priceMonthly: 8 }, { id: "b", priceMonthly: 8 }]).id, "a");
  assert.equal(pickCheapestPlan([{ id: "a", priceMonthly: 8 }, { id: "b", priceMonthly: 5 }]).id, "b");
  assert.equal(pickCheapestPlan([]), null);
  assert.equal(pickCheapestPlan(undefined), null);
  // Einträge ohne nutzbaren Preis werden ignoriert.
  assert.equal(pickCheapestPlan([{ id: "broken" }, { id: "go", priceMonthly: 10 }]).id, "go");
});

test("resolveOpenCodeUsage: number bleibt, Map wird per Plan-Id aufgelöst, null bleibt null", () => {
  assert.equal(resolveOpenCodeUsage(15, "go"), 15);
  assert.equal(resolveOpenCodeUsage({ go: 15, "go-plus": 120 }, "go"), 15);
  assert.equal(resolveOpenCodeUsage({ go: 15, "go-plus": 120 }, "go-plus"), 120);
  assert.equal(resolveOpenCodeUsage({ go: null }, "go"), null);
  assert.equal(resolveOpenCodeUsage({}, "go"), null);
  assert.equal(resolveOpenCodeUsage(null, "go"), null);
  assert.equal(resolveOpenCodeUsage(Infinity, "go"), null);
});

test("Legacy-Format → Plan go/10/60, usage als Zahl, effective*/multiplier ignoriert", () => {
  const normalized = normalizeOpenCodeData(legacy);
  assert.deepEqual(normalized.plan, { id: "go", name: "Go", priceMonthly: 10, creditsMonthly: 60 });
  assert.equal(normalized.models.length, 3);

  const grok = byName(normalized.models, "Grok 4.5");
  assert.equal(grok.usage, 15); // flat legacy usage pass-through
  // effective*/multiplier wurden früher vom Tracker vorgerechnet und sind für
  // die Vergleichslogik irrelevant (requestCost rechnet aus Rohpreisen + Muster).
  assert.equal(grok.effectiveInput, 8);

  const free = byName(normalized.models, "Ox Alpha Free");
  assert.equal(free.usage, null);
  assert.equal(isFree(free, "openCodeGo"), true);

  assert.equal(normalized.fetchedAt, legacy.fetchedAt);
  assert.deepEqual(normalized.peakHours, legacy.peakHours);
});

test("Neues plans-Format → günstigster Plan (go, NICHT go-plus), usage aus der Map", () => {
  const normalized = normalizeOpenCodeData(plans);
  // Go Plus ($40/240) ist teurer → die $10-Seite wertet Go ($10/60) aus.
  assert.deepEqual(normalized.plan, { id: "go", name: "Go", priceMonthly: 10, creditsMonthly: 60 });

  assert.equal(byName(normalized.models, "Grok 4.5").usage, 15); // usage.go
  assert.equal(byName(normalized.models, "DeepSeek V4 Flash").usage, 60); // usage.go
  // Map-Wert null → unlimited/free
  const free = byName(normalized.models, "Ox Alpha Free");
  assert.equal(free.usage, null);
  assert.equal(isFree(free, "openCodeGo"), true);
});

test("Beide Formate liefern denselben internen Vertrag (usage: number|null)", () => {
  const a = normalizeOpenCodeData(legacy);
  const b = normalizeOpenCodeData(plans);
  assert.deepEqual(a.plan, b.plan);
  assert.deepEqual(
    a.models.map((model) => model.usage),
    b.models.map((model) => model.usage),
  );
});

test("normalizeOpenCodeData ist idempotent (bereits normalisiert → unverändert)", () => {
  const once = normalizeOpenCodeData(plans);
  const twice = normalizeOpenCodeData(once);
  assert.equal(twice, once);
});

test("normalizeOpenCodeData: reines Vor-plans-Legacy nutzt monthlyCost/monthlyCredit", () => {
  const bare = { fetchedAt: "2026-01-01T00:00:00.000Z", monthlyCost: 10, monthlyCredit: 60, models: [{ name: "A", usage: 30 }] };
  const normalized = normalizeOpenCodeData(bare);
  assert.deepEqual(normalized.plan, { id: "go", name: "Go", priceMonthly: 10, creditsMonthly: 60 });
  assert.equal(normalized.models[0].usage, 30);
  // Fehlende Werte → dokumentierte Fallback-Konstanten des Layers.
  const empty = normalizeOpenCodeData({ models: [] });
  assert.deepEqual(empty.plan, { ...DEFAULT_OPENCODE_PLAN });
});

test("buildComparison: neues plans-Format wird wie das Legacy-Format ausgewertet", () => {
  const goNew = {
    fetchedAt: "2026-09-28T12:00:00.000Z",
    plans: [
      { id: "go", name: "Go", priceMonthly: 10, creditsMonthly: 60 },
      { id: "go-plus", name: "Go Plus", priceMonthly: 40, creditsMonthly: 240 },
    ],
    models: [
      { id: "alpha", name: "Alpha", usage: { go: 60, "go-plus": 480 }, input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
      { id: "only-go", name: "Only Go", usage: { go: 60, "go-plus": 480 }, input: 0.5, output: 1, cachedRead: 0.1, cachedWrite: null, pattern: { input: 1000, cachedRead: 50000, output: 200 } },
    ],
  };
  const cc = {
    fetchedAt: "2026-09-28T09:00:00.000Z",
    plans: [{ id: "goat", name: "GOAT", priceMonthly: 10, defaultAllowance: null, creditsMonthly: 70 }],
    models: [
      { id: "alpha", name: "Alpha", input: 0.1, output: 0.2, cachedRead: 0.05, cachedWrite: null, allowances: { goat: 60 }, availability: { goat: true } },
    ],
  };
  const emptyMap = { aliases: {}, sourceAliases: {}, prettyNames: {}, ignoredNames: [] };
  const out = buildComparison(goNew, cc, emptyMap);

  // Plan + Guthaben kommen aus dem günstigsten Plan, nicht aus Go Plus.
  assert.equal(out.sources.openCodeGo.paidMonthly, 10);
  assert.equal(out.sources.openCodeGo.monthlyCredit, 60);

  const alpha = out.rows.find((row) => row.displayName === "Alpha");
  // usage.go = 60 → identische Allowance wie Command Code → draw.
  assert.equal(alpha.openCodeGo.averageAllowance, 60);
  assert.equal(alpha.comparison.winner, "draw");
});
