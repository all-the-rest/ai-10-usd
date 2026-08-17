import type { ComparisonRow, SortKey } from "../types";

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
  if (key === "openCodeRequests") return row.openCodeGo?.normalizedRequestsPer10 ?? null;
  if (key === "commandCodeRequests") return row.commandCode?.normalizedRequestsPer10 ?? null;
  if (key === "maxRequests") {
    const go = row.openCodeGo?.normalizedRequestsPer10 ?? null;
    const cc = row.commandCode?.normalizedRequestsPer10 ?? null;
    if (go === null && cc === null) return null;
    return Math.max(go ?? -Infinity, cc ?? -Infinity);
  }
  if (key === "normalizedDifference") return row.comparison.normalizedDifference;
  if (key === "advantage") return row.comparison.advantagePercent;
  return null;
}
