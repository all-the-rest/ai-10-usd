import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadModelMap, normalizeName, canonicalName, displayNameOf } from "./model-map.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OPEN_CODE_URL = "https://ocgo-pricing.all-the.rest/data/latest.json";
const COMMAND_CODE_URL = "https://cc-pricing.all-the.rest/data/latest.json";
const TARGET_PRICE = 10;
const COMMAND_CODE_PLAN_ID = "goat";

// Command Code's current checkout amount is $10.77. It is not part of the
// published latest.json, so keep the verified paid amount explicit here rather
// than silently using the advertised $10 plan price.
const COMMAND_CODE_PAID_PRICE = 10.77;
const COMMAND_CODE_PAID_PRICE_SOURCE = "https://cc-pricing.all-the.rest/?sort=requests%3Adesc";
// Command Code's documented "average message" token profile. Used as the
// fallback token statistic for models OpenCode Go does not have.
const AVERAGE_MESSAGE_PATTERN = { input: 800, cachedRead: 50000, output: 162 };

// A difference below this threshold (relative to the worse plan) counts as a
// draw instead of a winner.
const DRAW_THRESHOLD_PERCENT = 10;

const modelMap = await loadModelMap();

function finite(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// A model is "free" (unlimited, no per-request cost) on a provider when:
// - Command Code: flagged by a 100%-discount free deal
// - OpenCode Go: a free catalog row (usage is null, tokens priced at 0)
// OpenCode Zen free models live in `freeModels`, not `models`, so they never
// reach this generator and are intentionally excluded from the comparison.
function isFree(model, provider) {
  if (provider === "commandCode") return model.deal?.free === true;
  return model.usage == null;
}

function prettyName(value) {
  return String(value)
    .replace(/\s*\(latest\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function assertSnapshot(data, label) {
  if (!data || typeof data !== "object" || !Array.isArray(data.models)) {
    throw new Error(`${label} does not contain a models array`);
  }
  if (typeof data.fetchedAt !== "string") throw new Error(`${label} has no fetchedAt timestamp`);
}

async function fetchJson(url, label) {
  const response = await fetch(`${url}?comparison=${Date.now()}`, {
    headers: { accept: "application/json", "user-agent": "ai-10-usd-comparison/1.0" },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  const data = await response.json();
  assertSnapshot(data, label);
  return data;
}

function requestCost(model, pattern) {
  const input = finite(model.input);
  const cachedRead = finite(model.cachedRead);
  const output = finite(model.output);
  const cachedWrite = finite(model.cachedWrite) ?? input;
  if (!input || cachedRead === null || !output || !pattern) return null;
  const inputPrice = 0.05 * input + 0.95 * cachedWrite;
  return (
    (inputPrice * pattern.input + cachedRead * pattern.cachedRead + output * pattern.output) / 1_000_000
  );
}

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function percentile(values, fraction) {
  const usable = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!usable.length) return null;
  const index = (usable.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return usable[lower];
  return usable[lower] + (usable[upper] - usable[lower]) * (index - lower);
}

function distribution(values) {
  const usable = values.filter((value) => Number.isFinite(value));
  return {
    count: usable.length,
    min: usable.length ? Math.min(...usable) : 0,
    max: usable.length ? Math.max(...usable) : 0,
    mean: average(usable) ?? 0,
    median: percentile(usable, 0.5) ?? 0,
    p25: percentile(usable, 0.25) ?? 0,
    p75: percentile(usable, 0.75) ?? 0
  };
}

function commandCodeAllowance(model, plan) {
  return finite(model.allowances?.goat) ?? finite(plan.defaultAllowance) ?? finite(plan.creditsMonthly);
}

function computeFinite(models, provider, paidMonthly, plan, pattern) {
  const values = models
    .map((model) => {
      const allowance = provider === "openCodeGo" ? finite(model.usage) : commandCodeAllowance(model, plan);
      const cost = requestCost(model, pattern);
      if (allowance === null || allowance <= 0 || cost === null || cost <= 0) return null;
      const requests = allowance / cost;
      return {
        allowance,
        cost,
        requests,
        normalized: (requests * TARGET_PRICE) / paidMonthly,
        effective: (cost * paidMonthly) / allowance
      };
    })
    .filter(Boolean);

  if (!values.length) return null;
  return {
    sourceName: prettyName(models[0].name),
    variantCount: models.length,
    unlimited: false,
    averageAllowance: average(values.map((value) => value.allowance)),
    averageRequestCost: average(values.map((value) => value.cost)),
    averageRequestsPerMonth: average(values.map((value) => value.requests)),
    normalizedRequestsPer10: average(values.map((value) => value.normalized)),
    paidMonthly,
    effectiveRequestCostAtPaidPrice: average(values.map((value) => value.effective))
  };
}

// Splits a provider's models into free (unlimited) and paid, then derives a
// single ProviderModelValue: a paid-only group stays finite; a group with both
// paid and free reports as unlimited (free wins) while keeping the paid figure
// for a sub-caption; a free-only group is unlimited with no finite figure.
function providerValue(models, provider, paidMonthly, plan, pattern) {
  const free = models.filter((model) => isFree(model, provider));
  const paid = models.filter((model) => !isFree(model, provider));
  const finiteValue = computeFinite(paid, provider, paidMonthly, plan, pattern);
  if (finiteValue) {
    if (free.length) {
      return {
        ...finiteValue,
        unlimited: true,
        normalizedRequestsPer10: Infinity,
        averageRequestsPerMonth: Infinity,
        paidNormalizedRequestsPer10: finiteValue.normalizedRequestsPer10,
        paidAverageRequestsPerMonth: finiteValue.averageRequestsPerMonth
      };
    }
    return finiteValue;
  }
  if (free.length) {
    return {
      sourceName: prettyName(free[0].name),
      variantCount: free.length,
      unlimited: true,
      normalizedRequestsPer10: Infinity,
      averageRequestsPerMonth: Infinity,
      averageAllowance: 0,
      averageRequestCost: 0,
      paidMonthly,
      effectiveRequestCostAtPaidPrice: 0
    };
  }
  return null;
}

function compareGroup(group, openCodePaid, commandCodePaid, commandPlan) {
  // Token statistics: OpenCode Go's per-model pattern (the realistic one)
  // applies to BOTH providers when the family exists in OpenCode. Command
  // Code's average message profile is the fallback for models OpenCode lacks.
  const pattern = group.openCodeGo[0]?.pattern ?? AVERAGE_MESSAGE_PATTERN;
  const openCodeGo = providerValue(group.openCodeGo, "openCodeGo", openCodePaid, null, pattern);
  const commandCode = providerValue(group.commandCode, "commandCode", commandCodePaid, commandPlan, pattern);
  const matched = openCodeGo && commandCode;
  const goUnlimited = openCodeGo?.unlimited ?? false;
  const ccUnlimited = commandCode?.unlimited ?? false;
  const goRequests = openCodeGo?.normalizedRequestsPer10 ?? null;
  const ccRequests = commandCode?.normalizedRequestsPer10 ?? null;
  let winner = null;
  let difference = null;
  let advantagePercent = null;
  if (goUnlimited && ccUnlimited) {
    // Free on both plans → no finite advantage to compute (both unlimited).
    winner = "draw";
  } else if (ccUnlimited) {
    // Command Code includes the model for free → wins by an infinite margin.
    winner = "commandCode";
  } else if (goUnlimited) {
    winner = "openCodeGo";
  } else if (matched) {
    // Always positive: "how much better the plan with more requests is".
    difference = Math.abs(goRequests - ccRequests);
    const lower = Math.min(goRequests, ccRequests);
    advantagePercent = lower && lower > 0 ? (difference / lower) * 100 : null;
    winner =
      advantagePercent < DRAW_THRESHOLD_PERCENT
        ? "draw"
        : goRequests >= ccRequests
          ? "openCodeGo"
          : "commandCode";
  }

  const baseName = displayNameOf(
    modelMap,
    prettyName(group.openCodeGo[0]?.name ?? group.commandCode[0]?.name ?? group.canonical),
    group.canonical
  );
  const title = group.kind ? ` (${variantTitle(group.kind)})` : "";
  const promoExpires = group.commandCode.find((model) => model.deal?.free)?.deal?.expires ?? null;
  return {
    canonicalModel: group.kind ? `${group.canonical}${title}` : group.canonical,
    displayName: `${baseName}${title}`,
    status: matched ? "matched" : openCodeGo ? "openCodeGoOnly" : "commandCodeOnly",
    openCodeGo,
    commandCode,
    freeIncluded: { openCodeGo: goUnlimited, commandCode: ccUnlimited },
    promoExpires,
    comparison: { normalizedDifference: difference, advantagePercent, winner }
  };
}

function findOutliers(rows) {
  const candidates = rows
    .filter((row) => row.status === "matched")
    .map((row) => ({ row, ratio: row.openCodeGo.normalizedRequestsPer10 / row.commandCode.normalizedRequestsPer10 }))
    .filter(({ ratio }) => Number.isFinite(ratio) && ratio > 0)
    .map((entry) => ({ ...entry, logRatio: Math.log2(entry.ratio) }));
  const logs = candidates.map((entry) => entry.logRatio);
  const q1 = percentile(logs, 0.25);
  const q3 = percentile(logs, 0.75);
  if (q1 === null || q3 === null) return [];
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return candidates
    .filter((entry) => entry.logRatio < low || entry.logRatio > high)
    .sort((a, b) => Math.abs(b.logRatio) - Math.abs(a.logRatio))
    .map(({ row, ratio }) => ({
      model: row.displayName,
      ratio,
      advantagePercent: row.comparison.advantagePercent,
      winner: row.comparison.winner,
      method: "Tukey IQR on log2 normalized-requests ratio"
    }));
}

const [openCodeData, commandCodeData] = await Promise.all([
  fetchJson(OPEN_CODE_URL, "OpenCode Go data"),
  fetchJson(COMMAND_CODE_URL, "Command Code data")
]);

const commandPlan = commandCodeData.plans?.find((plan) => plan.id === COMMAND_CODE_PLAN_ID);
if (!commandPlan) throw new Error(`Command Code plan ${COMMAND_CODE_PLAN_ID} is missing`);

const groups = new Map();
const warnings = [];

function variantKind(tier) {
  if (!tier) return null;
  const t = String(tier).toLowerCase();
  if (!t.includes("peak")) return null;
  return t.includes("off") ? "offpeak" : "peak";
}

function variantTitle(kind) {
  return kind === "peak" ? "Peak" : kind === "offpeak" ? "Off-Peak" : null;
}

function add(provider, model) {
  if (modelMap.ignoredNames.some((name) => normalizeName(name) === normalizeName(model.name))) return;
  if (provider === "commandCode" && model.availability?.goat === false) return;
  const canonical = canonicalName(modelMap, model.name, provider);
  // Peak/off-peak variants stay separate comparison rows ("show both
  // variants"); other variants of a family are aggregated.
  const kind = variantKind(model.tier);
  const key = kind ? `${canonical}::${kind}` : canonical;
  const group = groups.get(key) ?? { canonical, kind, openCodeGo: [], commandCode: [] };
  group[provider].push(model);
  groups.set(key, group);
}

for (const model of openCodeData.models) add("openCodeGo", model);
for (const model of commandCodeData.models) add("commandCode", model);

const rows = [...groups.values()]
  .map((group) => compareGroup(group, finite(openCodeData.monthlyCost) ?? 10, COMMAND_CODE_PAID_PRICE, commandPlan))
  .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" }));

const matchedRows = rows.filter((row) => row.status === "matched");
// Free/unlimited rows report Infinity requests; they are real comparison
// results (counted in matchedModels/winnerCounts) but must not poison the
// numeric request distributions, so filter them out of those aggregates.
const normalizedGo = matchedRows
  .map((row) => row.openCodeGo.normalizedRequestsPer10)
  .filter(Number.isFinite);
const normalizedCc = matchedRows
  .map((row) => row.commandCode.normalizedRequestsPer10)
  .filter(Number.isFinite);
const differences = matchedRows.map((row) => row.comparison.normalizedDifference);
const winnerCounts = { openCodeGo: 0, commandCode: 0, draw: 0 };
for (const row of matchedRows) winnerCounts[row.comparison.winner] += 1;

const biggestDifferences = [...matchedRows]
  .filter((row) => row.comparison.advantagePercent != null)
  .sort((a, b) => (b.comparison.advantagePercent ?? 0) - (a.comparison.advantagePercent ?? 0))
  .slice(0, 8);

const openCodePaid = finite(openCodeData.monthlyCost) ?? 10;
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  targetMonthlyPrice: TARGET_PRICE,
  sources: {
    openCodeGo: {
      url: OPEN_CODE_URL,
      fetchedAt: openCodeData.fetchedAt,
      planName: "OpenCode Go",
      paidMonthly: openCodePaid,
      monthlyCredit: finite(openCodeData.monthlyCredit) ?? 60
    },
    commandCode: {
      url: COMMAND_CODE_URL,
      fetchedAt: commandCodeData.fetchedAt,
      planId: commandPlan.id,
      planName: commandPlan.name,
      advertisedMonthly: commandPlan.priceMonthly,
      paidMonthly: COMMAND_CODE_PAID_PRICE,
      paidPriceSource: COMMAND_CODE_PAID_PRICE_SOURCE,
      creditsMonthly: commandPlan.creditsMonthly
    }
  },
  methodology: {
    workload: AVERAGE_MESSAGE_PATTERN,
    normalizedMetric: "average requests per month scaled to exactly $10 paid",
    modelAggregation:
      "arithmetic mean across variants; peak/off-peak variants compared separately",
    matching:
      "OpenCode Go per-model token statistics used for both providers when available, Command Code average message profile as fallback; free models (Command Code 100%-discount deals, OpenCode Go usage=null rows) included as unlimited on the offering side vs the other plan's paid offering — both free → draw; OpenCode Zen free models live in freeModels and are excluded"
  },
  rows,
  statistics: {
    matchedModels: matchedRows.length,
    totalModels: rows.length,
    coverage: {
      openCodeGo: rows.filter((row) => row.openCodeGo).length,
      commandCode: rows.filter((row) => row.commandCode).length
    },
    requestsPer10: {
      openCodeGo: distribution(normalizedGo),
      commandCode: distribution(normalizedCc)
    },
    normalizedDifference: distribution(differences),
    winnerCounts,
    biggestDifferences,
    outliers: findOutliers(rows)
  },
  warnings
};

if (COMMAND_CODE_PAID_PRICE === commandPlan.priceMonthly) {
  warnings.push("Command Code paid price equals its advertised price; verify checkout pricing.");
}
if (rows.some((row) => row.status !== "matched")) {
  warnings.push("Rows without a model on both plans are shown but excluded from comparison statistics.");
}

const outputPath = join(ROOT, "public/data/latest.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Generated ${outputPath}: ${matchedRows.length} matched models, ${rows.length} total model families`);
