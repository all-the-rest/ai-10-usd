import test from "node:test";
import assert from "node:assert/strict";

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
