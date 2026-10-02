/**
 * Peak-/Off-Peak-Logik für **beide** Auswertungen dieses Repos:
 *
 * 1. die Live-Anzeige in der Provider-Zelle der Vergleichstabelle
 *    (`PeakCell.svelte`) — Zeiten, „jetzt Peak/Off-Peak" und Countdown,
 * 2. den Fenster-Lookup der Share-Card (`lib/share.ts`).
 *
 * Bewusst **ohne** Svelte-/DOM-Bezug (wie `lib/share.ts`), damit die Logik
 * unter Node (`node --experimental-strip-types --test`) direkt testbar ist und
 * die Karte nicht ins UI-Bundle zieht.
 *
 * Die Auswertungssemantik ist **übernommen** aus `ocgo-price-tracker`
 * (`src/config/peakPricing.ts`), nicht neu erfunden:
 * - `rule.timezone` ist die Zone, in der der **Wochentag** bewertet wird,
 *   die Fenster sind **UTC**-Stunden.
 * - Feiertag (in `rule.timezone`) → Off-Peak. In dieser Repo-Familie liefert
 *   die Quelle derzeit keine Feiertage (`holidays` fehlt) — die Verzweigung
 *   bleibt trotzdem vorhanden.
 * - Vor `effectiveFrom` kein Peak.
 * - **Kein** `isWorkday`/调休: ein Ausgleichs-Samstag bleibt Off-Peak
 *   (DeepSeek sagt wörtlich „Monday through Friday").
 */
import type { ComparisonData, HolidayCalendar, PeakRule } from "../types.ts";

/** Die beiden Anbieterspalten, die je eigene Peak-Daten tragen. */
export type PeakProvider = "openCodeGo" | "commandCode";

export const PEAK_PROVIDERS: readonly PeakProvider[] = ["openCodeGo", "commandCode"];

// ---------------------------------------------------------------------------
// Key-Normalisierung — EINE Stelle, beide Richtungen
// ---------------------------------------------------------------------------

/**
 * Normalform eines Tracker-Keys: lowercase, **alle** Nicht-Alphanumerika entfernt.
 *
 * Muss auf **beide** Seiten eines Peak-Lookups angewandt werden: die Tracker
 * behalten im Key Zeichen, die die Anzeige-/Zeilennamen nicht haben
 * (`deepseekv4.1flash` behält den Punkt, „DeepSeek V4.1 Flash" nicht; der
 * Command-Code-Tracker behält „latest" aus „DeepSeek V4 Pro (latest)").
 * Einseitig normalisiert traf der Key der V4.1-Flash-Zeile nie ihr Fenster.
 */
export function normalizePeakKey(name: string): string {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Zeilen-Name → Tracker-Key: Varianten-Suffix (`(Peak)`/`(Off-Peak)`) weg,
 *  danach dieselbe Normalisierung wie die Datenseite. */
export function peakKey(displayName: string): string {
  return normalizePeakKey(displayName.replace(/\s*\((Peak|Off-Peak)\)\s*$/i, ""));
}

/** Sucht einen Tracker-Key in einem rohen Verzeichnis, wobei **jeder**
 *  Datenschlüssel durch `normalizePeakKey` läuft. */
export function lookupNormalized<T>(source: unknown, key: string): T | undefined {
  if (source === null || typeof source !== "object") return undefined;
  for (const [rawKey, value] of Object.entries(source as Record<string, unknown>)) {
    if (normalizePeakKey(rawKey) === key) return value as T;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Auflösung: was weiß der Anbieter über dieses Modell?
// ---------------------------------------------------------------------------

/**
 * Aufgelöste Peak-Info **pro Anbieter**. `null` bedeutet: für dieses Modell
 * nennt die Quelle nichts → die UI rendert dann nichts (kein „-", kein
 * Platzhalter).
 */
export interface ResolvedPeak {
  provider: PeakProvider;
  /** Regel der neuen Form (`peakRules`) — `null` bei Legacy-Daten. */
  rule: PeakRule | null;
  /** Feiertagskalender der Regel, sofern die Quelle einen nennt. */
  calendar: HolidayCalendar | null;
  /** Anzuzeigende UTC-Fenster (neue Form: `peak.windowsUtc`). */
  windows: Array<[number, number]>;
  /**
   * `true` = nur die Legacy-Form (`peakHours`) liegt vor. Sie nennt **keinen**
   * Wochentags-Scope, deshalb wird hier **kein** Wochentag und **kein**
   * Live-Status erfunden — die Anzeige bleibt bei den Fenstern.
   */
  legacy: boolean;
}

/** Regel-Verzeichnis eines Anbieters (oder `null`, wenn die Quelle keins hat). */
export function peakRulesOf(data: ComparisonData, provider: PeakProvider): Record<string, PeakRule> | null {
  const rules = data.peakRules?.[provider];
  return rules && typeof rules === "object" ? rules : null;
}

/** Legacy-Fenster-Verzeichnis eines Anbieters (oder `null`). */
export function legacyPeakWindowsOf(
  data: ComparisonData,
  provider: PeakProvider,
): Record<string, Array<[number, number]>> | null {
  const windows = data.peakWindows?.[provider];
  return windows && typeof windows === "object" ? windows : null;
}

/** Feiertagskalender, den eine Regel referenziert (oder `null`). */
export function calendarFor(
  calendars: Record<string, HolidayCalendar> | null,
  rule: PeakRule | null,
): HolidayCalendar | null {
  const key = rule?.holidays?.calendar;
  if (!key || !calendars) return null;
  const found = lookupNormalized<HolidayCalendar>(calendars, normalizePeakKey(key));
  return found && typeof found === "object" ? found : null;
}

/**
 * Löst die Peak-Info eines Anbieters für einen Zeilennamen auf.
 *
 * Reihenfolge: die neue Form (`peakRules`) gewinnt, sonst die Legacy-Form
 * (`peakWindows`) — **ohne** Wochentage zu erfinden. `sourceName` ist der
 * rohe Anbieter-Name der Zeile (`ProviderModelValue.sourceName`); der Generator
 * legt die Regeln unter genau diesem normalisierten Namen ab.
 */
export function resolvePeak(
  data: ComparisonData,
  provider: PeakProvider,
  sourceName: string | null | undefined,
): ResolvedPeak | null {
  if (!sourceName) return null;
  const key = normalizePeakKey(sourceName);

  const rule = lookupNormalized<PeakRule>(peakRulesOf(data, provider), key);
  if (rule && typeof rule === "object" && Array.isArray(rule.peak?.windowsUtc)) {
    return {
      provider,
      rule,
      calendar: calendarFor(data.holidayCalendars?.[provider] ?? null, rule),
      windows: rule.peak.windowsUtc,
      legacy: false,
    };
  }

  const windows = lookupNormalized<Array<[number, number]>>(legacyPeakWindowsOf(data, provider), key);
  if (Array.isArray(windows) && windows.length > 0) {
    return { provider, rule: null, calendar: null, windows, legacy: true };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Auswertung (Semantik aus ocgo-price-tracker/src/config/peakPricing.ts)
// ---------------------------------------------------------------------------

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dateFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dateFormatters.set(timeZone, f);
  }
  return f;
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();
function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, f);
  }
  return f;
}

function partsToMap(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return map;
}

/** Lokales Kalenderdatum (`YYYY-MM-DD`) von `nowMs` in `timeZone`. */
export function localIsoDate(nowMs: number, timeZone: string): string {
  const m = partsToMap(dateFormatter(timeZone).formatToParts(new Date(nowMs)));
  return `${m.year}-${m.month}-${m.day}`;
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines `YYYY-MM-DD`-Datums. */
export function isoWeekday(isoDate: string): number {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const js = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0 = Sonntag
  return js === 0 ? 7 : js;
}

function addDaysIso(isoDate: string, n: number): string {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, mo - 1, d));
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** Offset (ms) der Zone `timeZone` zum Zeitpunkt `ts`. */
function zoneOffsetMs(ts: number, timeZone: string): number {
  const m = partsToMap(offsetFormatter(timeZone).formatToParts(new Date(ts)));
  const asUtc = Date.UTC(
    Number(m.year),
    Number(m.month) - 1,
    Number(m.day),
    Number(m.hour) % 24,
    Number(m.minute),
    Number(m.second),
  );
  return asUtc - ts;
}

/** UTC-Millisekunden der lokalen Mitternacht von `isoDate` in `timeZone`. */
export function zonedMidnightUtc(isoDate: string, timeZone: string): number {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const base = Date.UTC(y, mo - 1, d);
  let ts = base;
  for (let i = 0; i < 2; i++) ts = base - zoneOffsetMs(ts, timeZone);
  return ts;
}

/** Vor `effectiveFrom` gilt kein Peak (Vorlaufzeit). */
export function isBeforeEffectiveFrom(rule: PeakRule, nowMs: number): boolean {
  return typeof rule.effectiveFrom === "string" && nowMs < Date.parse(rule.effectiveFrom);
}

function inPeakWindow(rule: PeakRule, nowMs: number): boolean {
  const hour = new Date(nowMs).getUTCHours();
  return rule.peak.windowsUtc.some(([start, end]) => hour >= start && hour < end);
}

/**
 * Ist `nowMs` gemäß `rule` Peak?
 * 1. Feiertag (in `rule.timezone`) → Off-Peak
 * 2. Wochentag ∈ `peak.days` UND UTC-Stunde ∈ einem Fenster → Peak
 * 3. sonst Off-Peak (inkl. „vor `effectiveFrom`")
 */
export function isPeakAt(rule: PeakRule, calendar: HolidayCalendar | null | undefined, nowMs: number): boolean {
  if (!rule) return false;
  if (isBeforeEffectiveFrom(rule, nowMs)) return false;
  const localDay = localIsoDate(nowMs, rule.timezone);
  // Optional: nur aktiv, wenn die Quelle Feiertage nennt (`rule.holidays` +
  // Kalender). In dieser Repo-Familie liefert die Quelle keine → inert.
  if (rule.holidays?.policy === "off-peak" && calendar?.dates.includes(localDay)) return false;
  if (!rule.peak.days.includes(isoWeekday(localDay))) return false;
  return inPeakWindow(rule, nowMs);
}

/**
 * Nächster Zeitpunkt, an dem sich der Peak-Zustand ändert (oder `null`).
 *
 * Kandidaten sind die einzigen möglichen Übergänge: UTC-Fenstergrenzen,
 * lokale Mitternachten der Regel-Zone (Wochentagswechsel) sowie Anfang/Ende
 * eines Feiertags. Fenstergrenzen an Off-Peak-Tagen erzeugen keinen Wechsel
 * und werden herausgefiltert.
 */
export function nextTransition(
  rule: PeakRule,
  calendar: HolidayCalendar | null | undefined,
  nowMs: number,
  horizonDays = 9,
): number | null {
  if (!rule) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const candidates = new Set<number>();
  const d = new Date(nowMs);
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (let day = 0; day <= horizonDays; day++) {
    for (const [start, end] of rule.peak.windowsUtc) {
      candidates.add(utcMidnight + day * DAY_MS + start * HOUR_MS);
      candidates.add(utcMidnight + day * DAY_MS + end * HOUR_MS);
    }
  }
  const localToday = localIsoDate(nowMs, rule.timezone);
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDaysIso(localToday, i);
    candidates.add(zonedMidnightUtc(day, rule.timezone));
    if (rule.holidays?.policy === "off-peak" && calendar?.dates.includes(day)) {
      candidates.add(zonedMidnightUtc(addDaysIso(day, 1), rule.timezone));
    }
  }
  if (typeof rule.effectiveFrom === "string") {
    const eff = Date.parse(rule.effectiveFrom);
    if (Number.isFinite(eff)) candidates.add(eff);
  }
  const current = isPeakAt(rule, calendar, nowMs);
  const sorted = [...candidates].filter((t) => t > nowMs).sort((a, b) => a - b);
  for (const t of sorted) {
    if (isPeakAt(rule, calendar, t) !== current) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Labels — generiert aus den Daten, keine hartkodierte Prosa
// ---------------------------------------------------------------------------

export const WEEKDAY_SHORT: Record<"de" | "en", readonly string[]> = {
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

const TIMEZONE_LABELS: Record<string, { de: string; en: string }> = {
  "Asia/Shanghai": { de: "Peking-Zeit", en: "Beijing time" },
  "Asia/Singapore": { de: "Singapur-Zeit", en: "Singapore time" },
  UTC: { de: "UTC", en: "UTC" },
};

/** Bekannte Zonen bekommen einen Klartextnamen, unbekannte bleiben IANA. */
export function timezoneLabel(timeZone: string, lang: "de" | "en"): string {
  return TIMEZONE_LABELS[timeZone]?.[lang] ?? timeZone;
}

/** Kompakter Wochentags-Scope aus `days`: `Mo–Fr`, `Mo, Mi` oder `täglich`. */
export function formatDayScope(days: readonly number[], lang: "de" | "en"): string {
  const names = WEEKDAY_SHORT[lang];
  const sorted = [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);
  if (sorted.length === 7 || sorted.length === 0) return lang === "de" ? "täglich" : "daily";
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (contiguous) return `${names[sorted[0] - 1]}–${names[sorted[sorted.length - 1] - 1]}`;
  return sorted.map((d) => names[d - 1]).join(", ");
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** `01:00–04:00 + 06:00–10:00` — der „UTC"-Teil kommt als eigenes Label. */
export function formatUtcWindows(windows: Array<[number, number]>): string {
  return windows.map(([a, b]) => `${fmtHour(a)}–${fmtHour(b)}`).join(" + ");
}

/** Restzeit bis zum nächsten Wechsel: `HH:MM:SS`, ab 24 h mit Tagespräfix. */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const hoursTotal = Math.floor(seconds / 3600);
  const days = Math.floor(hoursTotal / 24);
  const hours = String(hoursTotal % 24).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return days > 0 ? `${days}d ${hours}:${minutes}:${rest}` : `${hours}:${minutes}:${rest}`;
}

// ---------------------------------------------------------------------------
// Peak-Fenster in der *Betrachter*-Zeitzone (nicht UTC, nicht Provider-Zone)
// ---------------------------------------------------------------------------

/**
 * Peak-Intervalle je **lokalem** Wochentag (ISO 1=Mo…7=So) in `timeZone`.
 *
 * Wichtig: das Muster wird aus `isPeakAt` **abgeleitet**, nicht durch Addition
 * eines Zonen-Offsets gerechnet. Grund: die Fenster der Quelle sind UTC-Stunden,
 * der Wochentags-Scope gilt in der *Provider*-Zone. Eine bloße Verschiebung
 * erzeugt an Tagesgrenzen die falsche Zuordnung (ein UTC-Fenster 22:00–24:00 ist
 * in UTC+2 lokal 00:00–02:00 des **Folgetags**). Deshalb wird jede volle Stunde
 * des lokalen Tages einzeln bewertet — inklusive der Mitternachtsgrenze und
 * DST-Tagen — und zu Intervallen zusammengefasst.
 *
 * Feiertage sind hier **nicht** eingerechnet: das Ergebnis ist das wiederkehrende
 * Wochenmuster. Für den Zustand *jetzt* bleibt `isPeakAt` (mit Feiertagszweig)
 * maßgeblich.
 */
export function localPeakByWeekday(
  rule: PeakRule,
  calendar: HolidayCalendar | null | undefined,
  timeZone: string,
  refIsoDate: string,
): Map<number, Array<[number, number]>> {
  const HOUR = 3_600_000;
  const byWeekday = new Map<number, Array<[number, number]>>();
  const startIso = addDaysIso(refIsoDate, -isoWeekday(refIsoDate) + 1); // lokaler Montag
  for (let offset = 0; offset < 7; offset += 1) {
    const isoDate = addDaysIso(startIso, offset);
    const weekday = isoWeekday(isoDate);
    const midnight = zonedMidnightUtc(isoDate, timeZone);
    const intervals: Array<[number, number]> = [];
    let openStart: number | null = null;
    for (let hour = 0; hour <= 24; hour += 1) {
      // Zellmitte bewerten: robust gegen Stunden-Grenzfälle und DST-Wechsel.
      const peakAt = hour < 24 && isPeakAt(rule, calendar, midnight + (hour * HOUR) + Math.floor(HOUR / 2));
      if (peakAt && openStart === null) openStart = hour;
      if (!peakAt && openStart !== null) {
        intervals.push([openStart, hour]);
        openStart = null;
      }
    }
    if (intervals.length > 0) byWeekday.set(weekday, intervals);
  }
  return byWeekday;
}

/**
 * Formatiert `localPeakByWeekday` als Scope: gleiche Intervalle an
 * aufeinanderfolgenden Wochentagen werden zusammengefasst
 * (`Mo–Fr 03:00–06:00 + 14:00–18:00`), abweichende einzeln (`Mo–Fr …, Sa …`).
 */
export function formatLocalScope(
  byWeekday: Map<number, Array<[number, number]>>,
  lang: "de" | "en",
): string {
  const names = WEEKDAY_SHORT[lang];
  const daily = lang === "de" ? "täglich" : "daily";
  const days = [...byWeekday.keys()].sort((a, b) => a - b);
  if (days.length === 0) return "";
  const signatureOf = (d: number) => JSON.stringify(byWeekday.get(d));
  const windowsOf = (d: number) => (byWeekday.get(d) ?? []).map(([a, b]) => `${fmtHour(a)}–${fmtHour(b)}`).join(" + ");
  // Alle sieben Tage gleich → „täglich", aber **mit** Fenstern (sonst ginge die
  // Uhrzeit verloren, und die Zeile wäre nicht mehr informativ).
  if (days.length === 7 && new Set(days.map(signatureOf)).size === 1) return `${daily} ${windowsOf(days[0])}`;

  const parts: string[] = [];
  let i = 0;
  while (i < days.length) {
    let j = i;
    while (j + 1 < days.length && days[j + 1] === days[j] + 1 && signatureOf(days[j + 1]) === signatureOf(days[i])) j += 1;
    const windows = windowsOf(days[i]);
    const dayLabel = i === j ? names[days[i] - 1] : `${names[days[i] - 1]}–${names[days[j] - 1]}`;
    parts.push(`${dayLabel} ${windows}`);
    i = j + 1;
  }
  return parts.join(lang === "de" ? ", " : ", ");
}
