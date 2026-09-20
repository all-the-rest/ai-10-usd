import { render } from "svelte/server";
import App from "./App.svelte";
import type { ComparisonData } from "./types";
import type { Lang } from "./i18n";
import { buildJsonLd, safeJson } from "./lib/seo";

export { safeJson };

export interface SsrResult {
  /** `<svelte:head>` content produced by the component (may be empty). */
  head: string;
  /** Rendered app markup for `#app`. */
  body: string;
  /** Serialized `application/ld+json` payload for this language. */
  jsonLd: string;
}

/**
 * Renders `App` once for a language. Called twice by the prerender step —
 * `renderApp("en", data)` for `dist/index.html` and `renderApp("de", data)` for
 * `dist/de/index.html` — so both files carry real, crawlable content and
 * hydration can start from the exact same state on the client.
 */
export function renderApp(lang: Lang, data: ComparisonData | null): SsrResult {
  const { head, body } = render(App, {
    props: { initialData: data, initialLang: lang },
  });
  return { head, body, jsonLd: buildJsonLd(data, lang) };
}
