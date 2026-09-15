import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const INDEX_HTML = readFileSync(join(ROOT, "index.html"), "utf8");
const OG_PNG = join(ROOT, "public", "share", "og.png");
const DESCRIPTION =
  "Compare how many average AI coding requests the OpenCode Go and Command Code GOAT plans provide for a normalized $10.";

test("index.html: SEO/OG/Twitter-Tags mit absoluten URLs", () => {
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

test("build-share: erzeugt public/share/og.png als 1200x630-PNG", () => {
  execFileSync("node", ["scripts/build-share.mjs"], { cwd: ROOT, stdio: "pipe" });
  assert.ok(existsSync(OG_PNG), "public/share/og.png wurde nicht erzeugt");
  const buf = readFileSync(OG_PNG);
  assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "keine PNG-Magic-Bytes");
  assert.equal(buf.readUInt32BE(16), 1200, "IHDR-Breite ist nicht 1200");
  assert.equal(buf.readUInt32BE(20), 630, "IHDR-Höhe ist nicht 630");
});
