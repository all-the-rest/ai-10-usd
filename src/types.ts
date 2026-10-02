export type Provider = "openCodeGo" | "commandCode";
export type SortKey =
  | "model"
  | "openCodeRequests"
  | "commandCodeRequests"
  | "maxRequests"
  | "normalizedDifference"
  | "advantage";

/** OpenCode Go subscription entry (new multi-plan tracker format). */
export interface OpenCodePlan {
  id: string;
  name: string;
  priceMonthly: number;
  creditsMonthly: number | null;
  sourceUrl?: string;
}

export interface PriceSnapshot {
  fetchedAt: string;
  sourceUrl?: string;
  /** Legacy trackers only; new snapshots expose the same values via `plans`. */
  monthlyCredit?: number;
  /** Legacy trackers only; new snapshots expose the same values via `plans`. */
  monthlyCost?: number;
  plans?: Array<OpenCodePlan | CommandCodePlan>;
  models: OpenCodeModel[] | CommandCodeModel[];
}

export interface OpenCodeModel {
  name: string;
  tier: string | null;
  input: number | null;
  output: number | null;
  cachedRead: number | null;
  cachedWrite: number | null;
  /**
   * Legacy: flat allowance per model. New: a `{ [planId]: allowance | null }`
   * map (null = free/unlimited). Normalized to `number | null` before use.
   */
  usage: number | Record<string, number | null> | null;
  pattern: RequestPattern;
}

export interface CommandCodePlan {
  id: string;
  name: string;
  priceMonthly: number;
  creditsMonthly: number | null;
  defaultAllowance: number | null;
}

export interface CommandCodeModel {
  id: string;
  name: string;
  input: number | null;
  output: number | null;
  cachedRead: number | null;
  cachedWrite: number | null;
  pattern: RequestPattern;
  availability: { goat?: boolean };
  allowances: { goat?: number | null };
  deal?: { free?: boolean } | null;
}

export interface RequestPattern {
  input: number;
  cachedRead: number;
  output: number;
}

/**
 * Peak/off-peak rule as emitted by the OpenCode Go tracker (`peakRules`).
 * Mirrors the tracker's zod schema verbatim (peak-spec §1) so both repos stay
 * interchangeable:
 * - `peak.days` / `offPeak.days`: ISO weekdays, 1 = Monday … 7 = Sunday.
 * - `peak.windowsUtc`: UTC hour ranges `[start, end]`, same semantics as the
 *   legacy `peakHours` values.
 * - `timezone`: IANA zone the weekday is evaluated in (DeepSeek = Asia/Shanghai).
 * - `holidays`: only present when the source names holidays; `calendar` is a
 *   key into `holidayCalendars`.
 */
export interface PeakRule {
  timezone: string;
  effectiveFrom?: string;
  peak: { days: number[]; windowsUtc: Array<[number, number]> };
  offPeak: { days: number[]; allDay: true };
  holidays?: { policy: "off-peak"; calendar: string };
}

/** Chinese (or other) public-holiday calendar referenced by a `PeakRule`. */
export interface HolidayCalendar {
  /** Ascending ISO date strings (local calendar days of the rule's zone). */
  dates: string[];
  /** Last calendar day the holiday source covers (ISO date). */
  coveredThrough: string;
}

/**
 * The two compared providers. Peak data is provider-dimensioned: each column
 * shows **its own** times (Command Code ships its own `peakRules`, previously
 * discarded).
 */
export type PeakProvider = "openCodeGo" | "commandCode";

/**
 * Per-provider peak payload. `null` per provider = that source carries no
 * data in this shape (e.g. the tracker still serves the legacy `peakHours`
 * only) — consumers must fall back, never guess.
 */
export interface ProviderPeakData<T> {
  openCodeGo: T | null;
  commandCode: T | null;
}

/** Rules keyed by `normalizePeakKey(<provider model name>)`. */
export type PeakRules = Record<string, PeakRule>;
/** Calendars keyed as in the source (`holidays.calendar`). */
export type HolidayCalendars = Record<string, HolidayCalendar>;
/** Legacy UTC windows keyed by `normalizePeakKey(<provider model name>)`. */
export type LegacyPeakWindows = Record<string, Array<[number, number]>>;

export interface ProviderModelValue {
  sourceName: string;
  variantCount: number;
  unlimited: boolean;
  averageAllowance: number;
  averageRequestCost: number;
  averageRequestsPerMonth: number;
  normalizedRequestsPer10: number;
  paidMonthly: number;
  effectiveRequestCostAtPaidPrice: number;
  paidNormalizedRequestsPer10?: number | null;
  paidAverageRequestsPerMonth?: number | null;
}

export interface ComparisonRow {
  canonicalModel: string;
  displayName: string;
  status: "matched" | "openCodeGoOnly" | "commandCodeOnly";
  openCodeGo: ProviderModelValue | null;
  commandCode: ProviderModelValue | null;
  freeIncluded: { openCodeGo: boolean; commandCode: boolean };
  promoExpires: string | null;
  comparison: {
    normalizedDifference: number | null;
    advantagePercent: number | null;
    winner: Provider | "draw" | null;
  };
}

export interface DistributionStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
}

export interface ComparisonData {
  schemaVersion: 1;
  generatedAt: string;
  targetMonthlyPrice: number;
  /**
   * @deprecated Legacy-only: UTC hour windows per tracker key, passed through
   * from the old `peakHours` source field. Kept for dual tolerance while the
   * trackers are mid-migration — the new sources serve `peakRules` instead.
   * Never converted into weekdays (that would be a guess); see `peakRules`.
   * Provider-dimensioned: each provider's cell uses its own windows.
   */
  peakWindows: ProviderPeakData<LegacyPeakWindows>;
  /**
   * New peak rules, provider-dimensioned (`{ openCodeGo, commandCode }`) and
   * keyed by `normalizePeakKey(<provider model name>)` — the same key the UI
   * derives from `ProviderModelValue.sourceName`, so each cell shows **its own
   * provider's** times. `null` per provider = that source is still legacy.
   */
  peakRules: ProviderPeakData<PeakRules>;
  /** Holiday calendars referenced by `peakRules`, provider-dimensioned. */
  holidayCalendars: ProviderPeakData<HolidayCalendars>;
  sources: {
    openCodeGo: {
      url: string;
      fetchedAt: string;
      planName: string;
      paidMonthly: number;
      monthlyCredit: number;
    };
    commandCode: {
      url: string;
      fetchedAt: string;
      planId: string;
      planName: string;
      advertisedMonthly: number;
      paidMonthly: number;
      paidPriceSource: string;
      creditsMonthly: number | null;
    };
  };
  methodology: {
    workload: RequestPattern;
    normalizedMetric: string;
    modelAggregation: string;
    matching: string;
  };
  rows: ComparisonRow[];
  statistics: {
    matchedModels: number;
    totalModels: number;
    coverage: { openCodeGo: number; commandCode: number };
    requestsPer10: { openCodeGo: DistributionStats; commandCode: DistributionStats };
    normalizedDifference: DistributionStats;
    winnerCounts: { openCodeGo: number; commandCode: number; draw: number };
    biggestDifferences: ComparisonRow[];
    outliers: Array<{
      model: string;
      ratio: number;
      advantagePercent: number;
      winner: Provider;
      method: string;
    }>;
  };
  warnings: string[];
}
