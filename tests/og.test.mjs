import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INDEX_HTML = readFileSync(join(ROOT, "index.html"), "utf8");
const OG_PNG = join(ROOT, "public", "share", "og.png");
const TITLE = "Best AI Coding Plan for $10/month — OpenCode Go vs Command Code GOAT";
const DESCRIPTION =
  "Which $10 AI coding subscription gives you the most requests? Model-by-model comparison, normalized to $10, updated automatically.";

test("index.html: SEO/OG/Twitter-Tags mit absoluten URLs", () => {
  assert.ok(INDEX_HTML.includes(`<title>${TITLE}</title>`), "title fehlt oder nicht aktualisiert");
  assert.ok(
    INDEX_HTML.includes('<link rel="canonical" href="https://ai-10-usd.all-the.rest/" />'),
    "canonical fehlt"
  );
  assert.ok(INDEX_HTML.includes('<meta property="og:type" content="website" />'), "og:type fehlt");
  assert.ok(
    INDEX_HTML.includes('<meta property="og:image" content="https://ai-10-usd.all-the.rest/share/og.png" />'),
    "og:image fehlt oder nicht absolut"
  );
  assert.ok(INDEX_HTML.includes('<meta property="og:image:width" content="1200" />'), "og:image:width fehlt");
  assert.ok(INDEX_HTML.includes('<meta property="og:image:height" content="630" />'), "og:image:height fehlt");
  assert.ok(
    INDEX_HTML.includes('<meta name="twitter:card" content="summary_large_image" />'),
    "twitter:card fehlt"
  );
  assert.ok(
    INDEX_HTML.includes('<meta name="twitter:image" content="https://ai-10-usd.all-the.rest/share/og.png" />'),
    "twitter:image fehlt oder nicht absolut"
  );
  assert.ok(INDEX_HTML.includes(`content="${DESCRIPTION}"`), "description-Text fehlt");
});

test("index.html: hreflang, RSS-Autodiscovery und og:locale:alternate", () => {
  assert.ok(
    INDEX_HTML.includes('<link rel="alternate" hreflang="en" href="https://ai-10-usd.all-the.rest/" />'),
    "hreflang=en fehlt"
  );
  assert.ok(
    INDEX_HTML.includes('<link rel="alternate" hreflang="de" href="https://ai-10-usd.all-the.rest/de/" />'),
    "hreflang=de fehlt"
  );
  assert.ok(
    INDEX_HTML.includes('<link rel="alternate" hreflang="x-default" href="https://ai-10-usd.all-the.rest/" />'),
    "hreflang=x-default fehlt"
  );
  assert.ok(
    INDEX_HTML.includes(
      '<link\n      rel="alternate"\n      type="application/atom+xml"\n      title="AI plans at $10 — releases"\n      href="https://github.com/all-the-rest/ai-10-usd/releases.atom"\n    />'
    ),
    "RSS-Autodiscovery fehlt"
  );
  assert.ok(INDEX_HTML.includes('<meta property="og:locale" content="en_US" />'), "og:locale fehlt");
  assert.ok(
    INDEX_HTML.includes('<meta property="og:locale:alternate" content="de_DE" />'),
    "og:locale:alternate fehlt"
  );
});

test("build-share: erzeugt public/share/og.png als 1200x630-PNG", () => {
  execFileSync("node", ["scripts/build-share.mjs"], { cwd: ROOT, stdio: "pipe" });
  assert.ok(existsSync(OG_PNG), "public/share/og.png wurde nicht erzeugt");
  const buf = readFileSync(OG_PNG);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "keine PNG-Magic-Bytes");
  assert.equal(buf.readUInt32BE(16), 1200, "IHDR-Breite ist nicht 1200");
  assert.equal(buf.readUInt32BE(20), 630, "IHDR-Höhe ist nicht 630");
});
