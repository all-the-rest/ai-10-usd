import type { ComparisonData } from "../types";
import { FAQ, type Lang } from "../i18n";
import { sortRows } from "./sort";

export const SITE_URL = "https://ai-10-usd.all-the.rest/";
export const SITE_NAME = "AI plans at $10";

const DESCRIPTION: Record<Lang, string> = {
  en: "Which $10 AI coding subscription gives you the most requests? Model-by-model comparison, normalized to $10, updated automatically.",
  de: "Welches $10-KI-Abo liefert die meisten Anfragen? Modell-für-Modell-Vergleich, auf $10 normalisiert, automatisch aktualisiert.",
};

/** JSON that is safe to inline into an HTML `<script>` (no `</script>`, no `<!--`). */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Structured data for the prerendered page: `WebSite` + `ItemList` (the
 * compared models) + `FAQPage` (mirrors the visible FAQ). Built per language so
 * `dist/de/index.html` carries German structured data.
 */
export function buildJsonLd(data: ComparisonData | null, lang: Lang = "en"): string {
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION[lang],
      inLanguage: lang,
    },
  ];

  if (data) {
    const rows = sortRows(
      data.rows.filter((row) => row.status === "matched"),
      "maxRequests",
      "desc",
    ).slice(0, 10);
    graph.push({
      "@type": "ItemList",
      name: lang === "de" ? "KI-Coding-Modelle pro $10 im Vergleich" : "AI coding models compared per $10",
      itemListElement: rows.map((row, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: row.displayName,
      })),
    });
  }

  graph.push({
    "@type": "FAQPage",
    mainEntity: FAQ[lang].map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  });

  return safeJson({ "@context": "https://schema.org", "@graph": graph });
}
