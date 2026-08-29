import type { ComparisonRow, SortKey } from "../types";

// JSON cannot represent Infinity, so an unlimited side serializes
// normalizedRequestsPer10 as null. Treat the `unlimited` flag as ∞ for sorting
// so free/unlimited models rank first (above any finite request sum).
function unlimitedOf(row: ComparisonRow): boolean {
  return row.openCodeGo?.unlimited === true || row.commandCode?.unlimited === true;
}

export function sortRows(rows: ComparisonRow[], key: SortKey, direction: "asc" | "desc") {
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "model") return sign * a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" });
    const av = valueFor(a, key);
    const bv = valueFor(b, key);
    if (av === bv) return a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: "base" });
    return sign * ((av ?? Number.NEGATIVE_INFINITY) - (bv ?? Number.NEGATIVE_INFINITY));
  });
}

function valueFor(row: ComparisonRow, key: SortKey): number | null {
  if (key === "openCodeRequests") return row.openCodeGo?.unlimited ? Infinity : (row.openCodeGo?.normalizedRequestsPer10 ?? null);
  if (key === "commandCodeRequests") return row.commandCode?.unlimited ? Infinity : (row.commandCode?.normalizedRequestsPer10 ?? null);
  if (key === "maxRequests") {
    const go = row.openCodeGo?.unlimited ? Infinity : (row.openCodeGo?.normalizedRequestsPer10 ?? null);
    const cc = row.commandCode?.unlimited ? Infinity : (row.commandCode?.normalizedRequestsPer10 ?? null);
    if (go === null && cc === null) return null;
    return Math.max(go ?? -Infinity, cc ?? -Infinity);
  }
  // Unlimited models are an infinite gap/advantage → rank first.
  if (key === "normalizedDifference") return unlimitedOf(row) ? Infinity : row.comparison.normalizedDifference;
  if (key === "advantage") return unlimitedOf(row) ? Infinity : row.comparison.advantagePercent;
  return null;
}
