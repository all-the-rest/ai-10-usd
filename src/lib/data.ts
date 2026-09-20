import type { ComparisonData } from "../types";

declare global {
  interface Window {
    /** Optional global payload (set by prerender alongside the JSON script tag). */
    __COMPARISON__?: ComparisonData;
  }
}

/**
 * Shape check. Important: an element with `id="__COMPARISON__"` is exposed by
 * the browser as `window.__COMPARISON__` (named-element global), so the global
 * must be validated instead of trusted.
 */
function isComparison(value: unknown): value is ComparisonData {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ComparisonData).rows)
  );
}

/**
 * Reads the comparison data embedded into the prerendered HTML. This runs
 * synchronously so the first hydrated render matches the server output exactly
 * (no skeleton → data flash, no hydration mismatch). Returns `null` in dev /
 * when the page was not prerendered.
 */
export function readEmbeddedComparison(): ComparisonData | null {
  const globalValue = (globalThis as { __COMPARISON__?: unknown }).__COMPARISON__;
  if (isComparison(globalValue)) return globalValue;

  if (typeof document !== "undefined") {
    const el = document.getElementById("__COMPARISON__");
    if (el?.textContent) {
      try {
        const parsed: unknown = JSON.parse(el.textContent);
        return isComparison(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function loadComparison(): Promise<ComparisonData> {
  // Prefer the data baked into the page; only hit the network as a fallback
  // (dev server, or a page that was served without the embedded payload).
  const embedded = readEmbeddedComparison();
  if (embedded) return embedded;

  const response = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Comparison data returned HTTP ${response.status}`);
  return (await response.json()) as ComparisonData;
}
