/**
 * Language-stable heading anchors — single source of truth.
 *
 * Every in-page anchor (`id` attributes on sections/cards and `#hash` links
 * to them) is derived ONCE from the English heading and frozen here. Both
 * languages (`/` and `/de/`) render byte-identical `id` values from this
 * table, so deep links (`#comparison`, …) survive language switches
 * (`/` ↔ `/de/`, `?lang=` alias) and browser-language redirects.
 *
 * RULES:
 * - Never derive an anchor from translated (`t.*`) text — always use this table.
 * - Never add a second element with the same `id` (the `id` lives on the
 *   scroll container — `<section>`/`<div>` — while `<Heading>` only renders
 *   the `#` deep link pointing at it).
 * - SSR (`ssr-entry.ts` → `prerender.mjs`) and client (`main.ts`) render the
 *   same `App.svelte`, so both pick up identical ids automatically. Keep this
 *   module dependency-free (no Svelte, no DOM) so it stays SSR-safe and
 *   unit-testable.
 */

/** Stable section anchors, keyed by UI area. Values are frozen URL hashes. */
export const SECTION_ANCHORS = {
  planPrices: "plan-prices",
  avgValue: "avg-value",
  verdict: "verdict",
  comparison: "comparison",
  biggestRel: "biggest-rel",
  biggestAbs: "biggest-abs",
  method: "method",
  faq: "faq",
} as const;

export type SectionKey = keyof typeof SECTION_ANCHORS;

/** The `id` / `#hash` for a section — identical in EN and DE. */
export function sectionAnchor(key: SectionKey): string {
  return SECTION_ANCHORS[key];
}

/**
 * Language-stable FAQ item anchor: index-based (`faq-q1`, …), NOT derived
 * from the translated question text, so DE and EN items share the same id
 * and a `#faq-q3` deep link works in both languages.
 */
export function faqAnchor(index: number): string {
  return `faq-q${index + 1}`;
}

/** All known in-page hashes (without the `#`), for validation / tests. */
export function knownAnchors(faqCount: number): string[] {
  const anchors: string[] = [...Object.values(SECTION_ANCHORS)];
  for (let i = 0; i < faqCount; i++) anchors.push(faqAnchor(i));
  return anchors;
}
