import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// SEO/prerender contract, checked against the built `dist/` output. Skips
// cleanly when no build exists (e.g. a fresh checkout running only `pnpm test`).
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, "dist");
const HAS_DIST = existsSync(join(DIST, "index.html")) && existsSync(join(DIST, "data", "latest.json"));
const skip = HAS_DIST ? false : "dist/ fehlt — `pnpm build` ausführen";

const read = (file) => readFileSync(join(DIST, file), "utf8");

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

test("dist/index.html: echtes, vorgerendertes Markup in #app", { skip }, () => {
  const html = read("index.html");
  const app = html.match(/<div id="app">([\s\S]*?)<script type="application\/json" id="__COMPARISON__"/);
  assert.ok(app, "#app-Inhalt oder eingebettete Daten fehlen");
  assert.ok(app[1].includes("<h1"), "vorgerendertes #app enthält keine <h1>");
  assert.ok(app[1].length > 1000, "vorgerendertes #app ist verdächtig kurz (nur Skeleton?)");
  assert.match(html, /<script type="application\/json" id="__COMPARISON__">/);
});

test("dist/index.html: Modellnamen aus den Vergleichsdaten sind vorgerendert", { skip }, () => {
  const html = read("index.html");
  const data = JSON.parse(read(join("data", "latest.json")));
  const matched = data.rows.filter((row) => row.status === "matched");
  assert.ok(matched.length > 0, "keine gematchten Modelle in latest.json");
  const missing = matched.filter((row) => !html.includes(row.displayName));
  assert.equal(missing.length, 0, `nicht vorgerenderte Modelle: ${missing.map((r) => r.displayName).join(", ")}`);
});

test("dist/index.html: valides JSON-LD mit WebSite + ItemList + FAQPage", { skip }, () => {
  const blocks = jsonLdBlocks(read("index.html"));
  assert.equal(blocks.length, 1, "genau ein JSON-LD-Block erwartet");
  const parsed = JSON.parse(blocks[0]);
  assert.equal(parsed["@context"], "https://schema.org");
  assert.ok(Array.isArray(parsed["@graph"]), "@graph fehlt");
  const types = parsed["@graph"].map((node) => node["@type"]);
  for (const type of ["WebSite", "ItemList", "FAQPage"]) {
    assert.ok(types.includes(type), `JSON-LD ohne ${type}`);
  }
  const list = parsed["@graph"].find((node) => node["@type"] === "ItemList");
  assert.ok(list.itemListElement.length > 0, "ItemList ohne Einträge");
  const faq = parsed["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.ok(faq.mainEntity.length >= 5, "FAQPage mit weniger als 5 Fragen");
});

test("dist/index.html: canonical, hreflang, og:locale und RSS", { skip }, () => {
  const html = read("index.html");
  assert.ok(html.includes('<link rel="canonical" href="https://ai-10-usd.all-the.rest/" />'), "canonical en fehlt");
  assert.ok(html.includes('hreflang="en" href="https://ai-10-usd.all-the.rest/"'), "hreflang en fehlt");
  assert.ok(html.includes('hreflang="de" href="https://ai-10-usd.all-the.rest/de/"'), "hreflang de fehlt");
  assert.ok(html.includes('hreflang="x-default" href="https://ai-10-usd.all-the.rest/"'), "hreflang x-default fehlt");
  assert.ok(html.includes('<meta property="og:locale" content="en_US" />'), "og:locale en_US fehlt");
  assert.ok(
    html.includes('<meta property="og:locale:alternate" content="de_DE" />'),
    "og:locale:alternate de_DE fehlt"
  );
  assert.ok(html.includes("https://github.com/all-the-rest/ai-10-usd/releases.atom"), "RSS-Autodiscovery fehlt");
});

test("dist/de/index.html: deutsche Sprache, Canonical und hreflang", { skip }, () => {
  const html = read(join("de", "index.html"));
  assert.match(html, /<html lang="de"/);
  assert.ok(html.includes("<h1"), "deutsche Seite ohne <h1>");
  assert.ok(html.includes('<link rel="canonical" href="https://ai-10-usd.all-the.rest/de/" />'), "canonical de fehlt");
  assert.ok(html.includes('<meta property="og:locale" content="de_DE" />'), "og:locale de_DE fehlt");
  assert.ok(
    html.includes('<meta property="og:locale:alternate" content="en_US" />'),
    "og:locale:alternate en_US fehlt"
  );
  // German FAQ is in the structured data.
  const parsed = JSON.parse(jsonLdBlocks(html)[0]);
  const faq = parsed["@graph"].find((node) => node["@type"] === "FAQPage");
  assert.ok(
    faq.mainEntity.some((q) => q.name.includes("Lohnt sich OpenCode Go")),
    "deutsche FAQ im JSON-LD fehlt"
  );
});

test("dist/robots.txt und dist/sitemap.xml sind vorhanden und parsebar", { skip }, () => {
  const robots = read("robots.txt");
  assert.ok(robots.includes("User-agent: *"), "robots.txt ohne User-agent");
  assert.ok(robots.includes("Allow: /"), "robots.txt ohne Allow");
  assert.ok(
    robots.includes("Sitemap: https://ai-10-usd.all-the.rest/sitemap.xml"),
    "robots.txt ohne Sitemap-Verweis"
  );

  const sitemap = read("sitemap.xml");
  assert.ok(sitemap.trimStart().startsWith("<?xml"), "sitemap.xml ohne XML-Deklaration");
  assert.ok(sitemap.includes("<urlset"), "sitemap.xml ohne <urlset>");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ["https://ai-10-usd.all-the.rest/", "https://ai-10-usd.all-the.rest/de/"]);
});

test("Anker-IDs sind sprachstabil: EN und DE liefern identische ids (keine Duplikate)", { skip }, () => {
  const expected = [
    "plan-prices",
    "avg-value",
    "verdict",
    "comparison",
    "biggest-rel",
    "biggest-abs",
    "method",
    "faq",
  ];
  const idsOf = (html) => {
    const app = html.match(/<div id="app">([\s\S]*?)<script type="application\/json" id="__COMPARISON__"/);
    assert.ok(app, "#app-Inhalt fehlt");
    const ids = [...app[1].matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `doppelte ids: ${[...new Set(dupes)].join(", ")}`);
    return ids;
  };
  const en = idsOf(read("index.html"));
  const de = idsOf(read(join("de", "index.html")));
  for (const id of expected) {
    assert.ok(en.includes(id), `EN ohne #${id}`);
    assert.ok(de.includes(id), `DE ohne #${id}`);
  }
  // FAQ-Anker (faq-qN) sind indexbasiert und in beiden Sprachen identisch.
  const faqIds = (ids) => ids.filter((id) => /^faq-q\d+$/.test(id)).sort();
  assert.ok(faqIds(en).length >= 5, "EN ohne FAQ-Anker");
  assert.deepEqual(faqIds(de), faqIds(en), "FAQ-Anker unterscheiden sich zwischen EN und DE");
  // Alle internen #Hashes müssen ein Ziel in derselben Datei haben.
  for (const [name, ids, html] of [["en", en, read("index.html")], ["de", de, read(join("de", "index.html"))]]) {
    const app = html.match(/<div id="app">([\s\S]*?)<script type="application\/json" id="__COMPARISON__"/)[1];
    const hrefs = [...app.matchAll(/ href="#([^"]+)"/g)].map((m) => m[1]);
    const missing = [...new Set(hrefs)].filter((h) => !ids.includes(h));
    assert.deepEqual(missing, [], `${name}: Hashes ohne Ziel: ${missing.join(", ")}`);
  }
});
