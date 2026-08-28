import test from "node:test";
import assert from "node:assert/strict";
import { loadModelMap, normalizeName, canonicalName, displayNameOf } from "../scripts/model-map.mjs";

function normalizedRequests(allowance, requestCost, paidMonthly) {
  return (allowance / requestCost) * (10 / paidMonthly);
}

test("normalizes requests to exactly ten dollars", () => {
  assert.equal(normalizedRequests(100, 1, 10), 100);
  assert.equal(normalizedRequests(100, 1, 10.77), (100 * 10) / 10.77);
});

test("a higher paid price lowers the normalized Command Code result", () => {
  const atAdvertisedPrice = normalizedRequests(20, 0.01, 10);
  const atPaidPrice = normalizedRequests(20, 0.01, 10.77);
  assert.ok(atPaidPrice < atAdvertisedPrice);
  assert.equal(Number((atPaidPrice / atAdvertisedPrice).toFixed(6)), Number((10 / 10.77).toFixed(6)));
});

test("median and percentile interpolation are stable for statistics", () => {
  const values = [1, 2, 4, 8];
  const percentile = (fraction) => {
    const index = (values.length - 1) * fraction;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return values[lower] + (values[upper] - values[lower]) * (index - lower);
  };
  assert.equal(percentile(0.5), 3);
  assert.equal(percentile(0.25), 1.75);
  assert.equal(percentile(0.75), 5);
});

test("difference below 10% counts as a draw", () => {
  const winner = (go, cc) => {
    const difference = Math.abs(go - cc);
    const lower = Math.min(go, cc);
    const pct = (difference / lower) * 100;
    return pct < 10 ? "draw" : go >= cc ? "openCodeGo" : "commandCode";
  };
  assert.equal(winner(100, 100), "draw");
  assert.equal(winner(105, 100), "draw");
  assert.equal(winner(109.9, 100), "draw");
  assert.equal(winner(110, 100), "openCodeGo");
  assert.equal(winner(100, 110), "commandCode");
});

test("difference is always positive (how much better the better plan is)", () => {
  const difference = (go, cc) => Math.abs(go - cc);
  assert.equal(difference(100, 110), 10);
  assert.equal(difference(110, 100), 10);
  assert.equal(difference(100, 100), 0);
});

test("token pattern: OpenCode Go pattern for both when available, Command Code average as fallback", () => {
  const fallback = { input: 800, cachedRead: 50000, output: 162 };
  const resolvePattern = (goPattern) => goPattern ?? fallback;
  const goPattern = { input: 1100, cachedRead: 71500, output: 220 };
  assert.deepEqual(resolvePattern(goPattern), goPattern);
  assert.deepEqual(resolvePattern(undefined), fallback);
});

test("canonicalName: Muse Spark 1.2 Contributor mappt beide Quellen auf dasselbe kanonische Modell", async () => {
  const modelMap = await loadModelMap();
  // OpenCode Go nennt den Contributor-Tier nur "Muse Spark 1.2" …
  assert.equal(canonicalName(modelMap, "Muse Spark 1.2", "openCodeGo"), "muse-spark-1.2-contributor");
  // … Command Code führt Contributor UND das teure Basis-Modell separat:
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

// Free/unlimited detection mirrors build-comparison.mjs `isFree`:
// Command Code flags a 100%-discount free deal; OpenCode Go free rows have usage=null.
test("isFree: Command Code deal.free and OpenCode Go usage=null mark unlimited models", () => {
  const isFree = (model, provider) =>
    provider === "commandCode" ? model.deal?.free === true : model.usage == null;
  assert.equal(isFree({ deal: { free: true } }, "commandCode"), true);
  assert.equal(isFree({ deal: { free: false } }, "commandCode"), false);
  assert.equal(isFree({ usage: null }, "openCodeGo"), true);
  assert.equal(isFree({ usage: 60 }, "openCodeGo"), false);
});

// Winner classification for free/unlimited models (mirrors compareGroup):
// both free → draw; only one side free → that side wins by an infinite margin.
test("free model wins by infinite margin when only one plan offers it free", () => {
  const classify = (goUnlimited, ccUnlimited, go, cc) => {
    if (goUnlimited && ccUnlimited) return { winner: "draw", advantagePercent: null };
    if (ccUnlimited) return { winner: "commandCode", advantagePercent: null };
    if (goUnlimited) return { winner: "openCodeGo", advantagePercent: null };
    const difference = Math.abs(go - cc);
    const lower = Math.min(go, cc);
    const pct = lower > 0 ? (difference / lower) * 100 : null;
    return { winner: pct < 10 ? "draw" : go >= cc ? "openCodeGo" : "commandCode", advantagePercent: pct };
  };
  assert.equal(classify(false, true, 500, Infinity).winner, "commandCode");
  assert.equal(classify(true, false, Infinity, 500).winner, "openCodeGo");
  assert.equal(classify(true, true, Infinity, Infinity).winner, "draw");
  assert.equal(classify(true, true, Infinity, Infinity).advantagePercent, null);
  assert.equal(classify(false, true, 500, Infinity).advantagePercent, null);
});

// Unlimited (Infinity) request counts must not poison numeric distributions.
test("unlimited requests are excluded from numeric distributions", () => {
  const finite = (xs) => xs.filter(Number.isFinite);
  const mean = (xs) => {
    const u = finite(xs);
    return u.length ? u.reduce((a, b) => a + b, 0) / u.length : 0;
  };
  assert.equal(mean([100, 200, Infinity]), 150);
  assert.equal(finite([100, 200, Infinity]).length, 2);
});
