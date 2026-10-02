/**
 * Normalization layer between the OpenCode Go price tracker and every consumer
 * in this repo. The tracker is migrating to a multi-subscription shape but is
 * still deployed in the legacy shape, so this module accepts BOTH and yields one
 * internal shape:
 *
 *   { fetchedAt, peakHours, peakRules, holidayCalendars,
 *     plan: { id, name, priceMonthly, creditsMonthly },
 *     models: [{ ..., usage: number | null }] }
 *
 * `peakHours` (legacy) and `peakRules` + `holidayCalendars` (new) are passed
 * through verbatim (each `?? null`): the tracker is migrated concurrently, so
 * either shape may arrive. Consumers keep the legacy path active when the new
 * fields are absent and never convert legacy windows into weekdays.
 *
 * `ai-10-usd` is the $10 comparison page: from `plans` it always evaluates the
 * CHEAPEST plan (ties → the one first listed), never a pricier sibling such as
 * Go Plus ($40). After normalization consumers only ever see `number | null`
 * allowances and a single `plan`, so no downstream code has to know about the
 * `plans` array or the per-plan `usage` map.
 */

// Pre-`plans` legacy snapshots carried the allowance as top-level fields; keep
// these values as the documented fallback (see AGENTS.md).
export const DEFAULT_OPENCODE_PLAN = Object.freeze({
  id: "go",
  name: "Go",
  priceMonthly: 10,
  creditsMonthly: 60,
});

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isPlan(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    value.id.length > 0
  );
}

/**
 * Picks the cheapest plan by `priceMonthly`. Ties are resolved deterministically
 * in favour of the plan listed first. Returns `null` when no usable plan exists.
 */
export function pickCheapestPlan(plans) {
  const valid = (Array.isArray(plans) ? plans : []).filter(
    (plan) => isPlan(plan) && finiteNumber(plan.priceMonthly) !== null,
  );
  if (!valid.length) return null;
  return valid.reduce((best, plan) => (plan.priceMonthly < best.priceMonthly ? plan : best));
}

/**
 * Resolves one model's allowance for the selected plan.
 * - `null`/`undefined` → `null` (free/unlimited row, or missing)
 * - `number` → the legacy per-model allowance
 * - object → the new `{ [planId]: allowance | null }` map
 */
export function resolveOpenCodeUsage(usage, planId) {
  if (usage === null || usage === undefined) return null;
  if (typeof usage === "number") return finiteNumber(usage);
  if (typeof usage === "object") return finiteNumber(usage[planId]);
  return null;
}

function normalizePlan(raw) {
  const cheapest = pickCheapestPlan(raw.plans);
  if (cheapest) {
    return {
      id: cheapest.id,
      name: typeof cheapest.name === "string" ? cheapest.name : cheapest.id,
      priceMonthly: finiteNumber(cheapest.priceMonthly),
      creditsMonthly: finiteNumber(cheapest.creditsMonthly),
    };
  }
  // No `plans` array (pre-`plans` legacy snapshot) → top-level legacy fields.
  return {
    id: DEFAULT_OPENCODE_PLAN.id,
    name: DEFAULT_OPENCODE_PLAN.name,
    priceMonthly: finiteNumber(raw.monthlyCost) ?? DEFAULT_OPENCODE_PLAN.priceMonthly,
    creditsMonthly: finiteNumber(raw.monthlyCredit) ?? DEFAULT_OPENCODE_PLAN.creditsMonthly,
  };
}

/**
 * Normalizes an OpenCode Go tracker snapshot (legacy OR plans-based) into the
 * internal `{ plan, models }` shape. Idempotent: an already-normalized snapshot
 * (singular `plan`, flat `usage`) passes through unchanged.
 */
export function normalizeOpenCodeData(raw) {
  if (raw === null || typeof raw !== "object") {
    throw new Error("OpenCode Go snapshot is not an object");
  }
  // Already normalized (singular `plan`, no `plans` array) → pass through.
  if (raw.plan !== null && typeof raw.plan === "object" && !Array.isArray(raw.plans)) {
    return raw;
  }

  const plan = normalizePlan(raw);
  const models = Array.isArray(raw.models)
    ? raw.models.map((model) =>
        model !== null && typeof model === "object"
          ? { ...model, usage: resolveOpenCodeUsage(model.usage, plan.id) }
          : model,
      )
    : [];

  return {
    fetchedAt: raw.fetchedAt,
    // Legacy peak field (old, already-deployed tracker snapshots) and the new
    // peak representation (peakRules + holidayCalendars) are both carried
    // through verbatim. Exactly one is non-null depending on the source; the
    // consumer picks the new shape when present and never derives weekdays from
    // the legacy hour windows.
    peakHours: raw.peakHours ?? null,
    peakRules: raw.peakRules ?? null,
    holidayCalendars: raw.holidayCalendars ?? null,
    plan,
    models,
  };
}
