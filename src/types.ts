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
  /** Off-peak UTC hour ranges per tracker-normalized model key (or null). */
  peakWindows: Record<string, Array<[number, number]>> | null;
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
