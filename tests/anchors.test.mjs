import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTION_ANCHORS, faqAnchor, knownAnchors } from "../src/lib/anchors.ts";

// Contract: heading anchors are language-stable — derived once from the
// English heading (frozen in `src/lib/anchors.ts`), identical in EN and DE.

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

test("SECTION_ANCHORS: expected frozen slugs (en-derived, stable)", () => {
  assert.deepEqual({ ...SECTION_ANCHORS }, {
    planPrices: "plan-prices",
    avgValue: "avg-value",
    verdict: "verdict",
    comparison: "comparison",
    biggestRel: "biggest-rel",
    biggestAbs: "biggest-abs",
    method: "method",
    faq: "faq",
  });
});

test("SECTION_ANCHORS: unique values, kebab-case, no empties", () => {
  const values = Object.values(SECTION_ANCHORS);
  assert.equal(new Set(values).size, values.length, "duplicate anchor slugs");
  for (const v of values) {
    assert.match(v, /^[a-z0-9]+(-[a-z0-9]+)*$/, `not a stable slug: ${v}`);
  }
});

test("faqAnchor: index-based, language-stable (not from translated text)", () => {
  assert.equal(faqAnchor(0), "faq-q1");
  assert.equal(faqAnchor(5), "faq-q6");
  assert.equal(new Set([0, 1, 2].map(faqAnchor)).size, 3);
});

test("knownAnchors: sections + per-question anchors, no duplicates", () => {
  const all = knownAnchors(6);
  assert.equal(all.length, Object.keys(SECTION_ANCHORS).length + 6);
  assert.equal(new Set(all).size, all.length, "duplicate anchors");
});

test("App.svelte: no hardcoded section ids — all via SECTION_ANCHORS/faqAnchor", () => {
  const src = read("src/App.svelte");
  // id="literal" / anchor="literal" / href="#literal" must not appear; the
  // single source of truth is `src/lib/anchors.ts`.
  for (const m of src.matchAll(/\b(id|anchor)="([^"]+)"/g)) {
    assert.fail(`hardcoded ${m[1]}="${m[2]}" — use SECTION_ANCHORS/faqAnchor`);
  }
  for (const m of src.matchAll(/href="#([a-z][a-z0-9-]*)"/g)) {
    assert.fail(`hardcoded href="#${m[1]}" — use SECTION_ANCHORS`);
  }
  for (const slug of Object.values(SECTION_ANCHORS)) {
    assert.ok(!src.includes(`"${slug}"`), `literal "${slug}" in App.svelte — use SECTION_ANCHORS`);
  }
});

test("Heading.svelte: hydration-safe href (bare #id first render, full URL in onMount)", () => {
  const src = read("src/Heading.svelte");
  assert.ok(src.includes('"#" + anchor'), "initial href must be the bare #id (SSR-identical)");
  assert.ok(src.includes("onMount"), "full pathname+search+#id URL applied in onMount");
  assert.ok(!src.match(/let href = .*window/), "no window access during first render (SSR mismatch)");
});

test("App.svelte: language switch + syncUrl preserve query (minus lang) and hash", () => {
  const src = read("src/App.svelte");
  assert.ok(src.includes("window.location.hash"), "hash must be carried over");
  assert.ok(src.includes('params.delete("lang")'), "lang alias must not leak into the path URL");
  // navigateLang keeps the complete query + hash…
  const nav = src.match(/function navigateLang[\s\S]*?\n  \}/);
  assert.ok(nav && nav[0].includes("window.location.hash"), "navigateLang must keep the hash");
  // …and syncUrl keeps the hash without forcing a trailing `?`.
  const sync = src.match(/function syncUrl[\s\S]*?\n  \}/);
  assert.ok(sync && sync[0].includes("window.location.hash"), "syncUrl must keep the hash");
  assert.ok(sync && !sync[0].includes("pathname}?${"), "syncUrl must omit `?` when no params remain");
});
