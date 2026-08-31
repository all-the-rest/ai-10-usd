import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelMap } from "./model-map.mjs";
import { buildComparison } from "./comparison-core.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OPEN_CODE_URL = "https://ocgo-pricing.all-the.rest/data/latest.json";
const COMMAND_CODE_URL = "https://cc-pricing.all-the.rest/data/latest.json";

// Die gesamte Rechenlogik lebt in `comparison-core.mjs` (exportiert, unit-testbar);
// dieses Skript kümmert sich nur um Fetch, Modell-Map laden und Schreiben.

function assertSnapshot(data, label) {
  if (!data || typeof data !== "object" || !Array.isArray(data.models)) {
    throw new Error(`${label} does not contain a models array`);
  }
  if (typeof data.fetchedAt !== "string") throw new Error(`${label} has no fetchedAt timestamp`);
}

async function fetchJson(url, label) {
  const response = await fetch(`${url}?comparison=${Date.now()}`, {
    headers: { accept: "application/json", "user-agent": "ai-10-usd-comparison/1.0" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const data = await response.json();
  assertSnapshot(data, label);
  return data;
}

const [openCodeData, commandCodeData] = await Promise.all([
  fetchJson(OPEN_CODE_URL, "OpenCode Go data"),
  fetchJson(COMMAND_CODE_URL, "Command Code data"),
]);
const modelMap = await loadModelMap();

const output = buildComparison(openCodeData, commandCodeData, modelMap);

const outputPath = join(ROOT, "public/data/latest.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `Generated ${outputPath}: ${output.statistics.matchedModels} matched models, ${output.statistics.totalModels} total model families`
);