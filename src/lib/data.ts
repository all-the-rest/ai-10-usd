import type { ComparisonData } from "../types";

export async function loadComparison(): Promise<ComparisonData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/latest.json`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Comparison data returned HTTP ${response.status}`);
  return (await response.json()) as ComparisonData;
}
