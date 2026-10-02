import { BUILD_TIME_MS } from "./buildInfo";

/**
 * Eine Uhr für **alle** Peak-Zellen der Vergleichstabelle.
 *
 * Hydration-Sicherheit: der Startwert ist der Build-Stempel
 * (`BUILD_TIME_MS`), den Prerender und Client identisch rendern — der erste
 * Client-Render ist damit zeichengleich mit dem Server-HTML (kein
 * `Date.now()` im Renderpfad, sonstMismatch beim Hydrieren des Countdowns).
 *
 * Erst `startPeakClock()` (aus `onMount`) schaltet auf die echte Uhr um und
 * startet das Ticken; das ist per Definition clientseitig.
 */

let now = $state(BUILD_TIME_MS);
let timer: ReturnType<typeof setInterval> | null = null;

/** Aktueller Zeitpunkt in ms (Build-Stempel bis `startPeakClock`). */
export function peakNow(): number {
  return now;
}

/**
 * Übernimmt die echte Uhr und tickt im Sekundentakt. Mehrfachaufrufe sind
 * harmlos (kein zweiter Timer), und ein unsichtbarer Tab pausiert die Updates
 * (der nächste Tick bzw. `visibilitychange` holt sofort nach).
 */
export function startPeakClock(intervalMs = 1000): void {
  if (typeof window === "undefined" || timer !== null) return;
  const tick = () => {
    if (typeof document !== "undefined" && document.hidden) return;
    now = Date.now();
  };
  tick();
  document.addEventListener("visibilitychange", tick);
  timer = setInterval(tick, intervalMs);
}

/** Nur für Tests: Uhrzeit der Peak-Zellen fest setzen. */
export function __setPeakNow(ms: number): void {
  now = ms;
}
