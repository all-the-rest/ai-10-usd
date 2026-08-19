import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .replace(/\(latest\)|\b(latest|preview)\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Lädt data/model-map.json: globale `aliases`, pro-Quelle überschreibende
 * `sourceAliases` (z. B. OpenCode Go "Muse Spark 1.2" = Contributor-Tier,
 * Command Code unterscheidet zusätzlich das teure Basis-Modell) und
 * `prettyNames` (kanonische Anzeige-Namen, wenn die Quelldaten abweichen).
 */
export async function loadModelMap() {
  const raw = await readFile(join(ROOT, "data/model-map.json"), "utf8");
  return JSON.parse(raw);
}

/**
 * Kanonischer Modellname für den Vergleich. `sourceAliases` (pro Quelle) haben
 * Vorrang vor den globalen `aliases` — damit können Quellen, die denselben
 * Namen für unterschiedliche Modelle verwenden (Muse Spark 1.2 teuer vs.
 * Contributor), sauber getrennt werden.
 */
export function canonicalName(modelMap, value, source) {
  const normalized = normalizeName(value);
  return modelMap.sourceAliases?.[source]?.[normalized] ?? modelMap.aliases[normalized] ?? normalized;
}

/** Anzeige-Name: schöner Label aus model-map.json, sonst Quellname. */
export function displayNameOf(modelMap, fallbackName, canonical) {
  return modelMap.prettyNames?.[canonical] ?? fallbackName;
}