// Prerenders the Svelte SPA into two static, crawlable HTML files:
//   dist/index.html      → English (default, `/`)
//   dist/de/index.html   → German (`/de/`)
//
// Steps:
//   1. read the generated comparison data (`public/data/latest.json`)
//   2. SSR-build `src/ssr-entry.ts` into `.ssr-build/` (Vite JS API)
//   3. render the real `App.svelte` for both languages
//   4. run the normal client build into `dist/`
//   5. inject the rendered markup + embedded JSON + JSON-LD + per-language SEO
//   6. write `robots.txt` and `sitemap.xml`
//
// No network and no new runtime dependencies: `svelte/server` ships with `svelte`.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA_PATH = join(ROOT, "public", "data", "latest.json");
const DIST = join(ROOT, "dist");
const SSR_OUT = join(ROOT, ".ssr-build");
const SSR_ENTRY = "src/ssr-entry.ts";

const SITE = "https://ai-10-usd.all-the.rest";

const SEO = {
  en: {
    title: "Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT",
    description:
      "Which $10 AI coding subscription gives you the most requests? Model-by-model comparison, normalized to $10, updated automatically.",
    siteName: "AI plans at $10",
    locale: "en_US",
    alternate: "de_DE",
    url: `${SITE}/`,
    canonical: `${SITE}/`,
  },
  de: {
    title: "Bester Coding-Plan für $10/Monat — OpenCode Go vs Command Code GOAT",
    description:
      "Welches $10-KI-Abo liefert die meisten Anfragen? Modell-für-Modell-Vergleich, auf $10 normalisiert, automatisch aktualisiert.",
    siteName: "KI-Pläne für $10",
    locale: "de_DE",
    alternate: "en_US",
    url: `${SITE}/de/`,
    canonical: `${SITE}/de/`,
  },
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function setMeta(html, attr, key, value) {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}="${escapeRegExp(key)}"[^>]*>`);
  if (!re.test(html)) throw new Error(`prerender: <meta ${attr}="${key}"> not found in index.html`);
  return html.replace(re, `<meta ${attr}="${key}" content="${value}" />`);
}

/** Swap the language-specific head tags (title, description, canonical, OG). */
function localizeHead(html, lang) {
  const seo = SEO[lang];
  let out = html;
  out = out.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${seo.title}</title>`);
  out = setMeta(out, "name", "description", seo.description);
  out = setMeta(out, "property", "og:site_name", seo.siteName);
  out = setMeta(out, "property", "og:locale", seo.locale);
  out = setMeta(out, "property", "og:locale:alternate", seo.alternate);
  out = setMeta(out, "property", "og:title", seo.title);
  out = setMeta(out, "property", "og:description", seo.description);
  out = setMeta(out, "property", "og:url", seo.url);
  out = setMeta(out, "name", "twitter:title", seo.title);
  out = setMeta(out, "name", "twitter:description", seo.description);
  out = out.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${seo.canonical}" />`);
  if (!out.includes(`href="${seo.canonical}"`)) {
    throw new Error(`prerender: canonical for ${lang} was not applied`);
  }
  return out;
}

function injectApp(html, body, json) {
  const marker = '<div id="app"></div>';
  if (!html.includes(marker)) throw new Error(`prerender: "${marker}" not found in built index.html`);
  return html.replace(
    marker,
    () => `<div id="app">${body}</div>\n    <script type="application/json" id="__COMPARISON__">${json}</script>`,
  );
}

function injectHead(html, head, jsonLd) {
  const marker = "</head>";
  if (!html.includes(marker)) throw new Error("prerender: </head> not found in built index.html");
  const extra = `${head}\n    <script type="application/ld+json">${jsonLd}</script>`;
  return html.replace(marker, () => `${extra}\n  </head>`);
}

async function buildSsr() {
  await build({
    configFile: false,
    root: ROOT,
    logLevel: "error",
    plugins: [svelte()],
    build: {
      ssr: SSR_ENTRY,
      outDir: ".ssr-build",
      emptyOutDir: true,
      copyPublicDir: false,
      minify: false,
      sourcemap: false,
      rollupOptions: { output: { entryFileNames: "ssr-entry.js" } },
    },
  });
}

async function buildClient() {
  await build({ root: ROOT, configFile: join(ROOT, "vite.config.ts"), logLevel: "info" });
}

async function main() {
  if (!existsSync(DATA_PATH)) {
    throw new Error(
      `prerender: ${DATA_PATH} not found — run \`pnpm generate\` first (or keep an existing public/data/latest.json).`,
    );
  }
  const data = JSON.parse(await readFile(DATA_PATH, "utf8"));

  // 1. SSR bundle + render both languages.
  await buildSsr();
  const bundleUrl = `${pathToFileURL(join(SSR_OUT, "ssr-entry.js")).href}?v=${Date.now()}`;
  const { renderApp, safeJson } = await import(bundleUrl);

  const rendered = {
    en: renderApp("en", data),
    de: renderApp("de", data),
  };
  const embeddedJson = safeJson(data);

  // 2. Client build (base "/" from vite.config.ts).
  await buildClient();

  const template = await readFile(join(DIST, "index.html"), "utf8");

  // 3. Inject per language.
  for (const lang of ["en", "de"]) {
    const { head, body, jsonLd } = rendered[lang];
    let html = localizeHead(template, lang);
    html = injectHead(html, head, jsonLd);
    html = injectApp(html, body, embeddedJson);
    const outFile = lang === "de" ? join(DIST, "de", "index.html") : join(DIST, "index.html");
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, html);
    console.log(`prerender: wrote ${outFile.replace(`${ROOT}/`, "")} (${body.length} bytes of markup)`);
  }

  // 4. robots.txt + sitemap.xml (both language URLs).
  await writeFile(
    join(DIST, "robots.txt"),
    ["User-agent: *", "Allow: /", "", `Sitemap: ${SITE}/sitemap.xml`, ""].join("\n"),
  );
  await writeFile(
    join(DIST, "sitemap.xml"),
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <url><loc>${SITE}/</loc><changefreq>daily</changefreq></url>`,
      `  <url><loc>${SITE}/de/</loc><changefreq>daily</changefreq></url>`,
      "</urlset>",
      "",
    ].join("\n"),
  );
  console.log("prerender: wrote robots.txt + sitemap.xml");
}

main().catch((error) => {
  console.error(`prerender: FEHLER: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
