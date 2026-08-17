export type Provider = "openCodeGo" | "commandCode";
export type SortKey =
  | "model"
  | "openCodeRequests"
  | "commandCodeRequests"
  | "maxRequests"
  | "normalizedDifference"
  | "advantage";

export interface PriceSnapshot {
  fetchedAt: string;
  sourceUrl: string;
  monthlyCredit?: number;
  monthlyCost?: number;
  plans?: CommandCodePlan[];
  models: OpenCodeModel[] | CommandCodeModel[];
}

export interface OpenCodeModel {
  name: string;
  tier: string | null;
  input: number | null;
  output: number | null;
  cachedRead: number | null;
  cachedWrite: number | null;
  usage: number;
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
  averageAllowance: number;
  averageRequestCost: number;
  averageRequestsPerMonth: number;
  normalizedRequestsPer10: number;
  paidMonthly: number;
  effectiveRequestCostAtPaidPrice: number;
}

export interface ComparisonRow {
  canonicalModel: string;
  displayName: string;
  status: "matched" | "openCodeGoOnly" | "commandCodeOnly";
  openCodeGo: ProviderModelValue | null;
  commandCode: ProviderModelValue | null;
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
