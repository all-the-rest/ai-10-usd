declare const __BUILD_TIME_ISO__: string | undefined;

/**
 * Gemeinsamer Build-Zeitstempel für Client **und** Prerender/SSR.
 *
 * Kommt per Vite-`define` aus `vite.config.ts` (`process.env.BUILD_STAMP`), das
 * `scripts/prerender.mjs` einmal für beide Builds setzt. Server und Client
 * rendern dadurch exakt denselben Wert — Voraussetzung dafür, dass der
 * Peak-Live-Status und der Countdown der Provider-Zelle hydration-stabil sind
 * (kein `new Date()` im Renderpfad!).
 *
 * Außerhalb eines Vite-Builds (Node-Tests) ist die Konstante nicht definiert;
 * der Epoch-Fallback hält den Wert deterministisch, statt still auf
 * `Date.now()` umzuschalten.
 */
export const BUILD_TIME_ISO: string =
  typeof __BUILD_TIME_ISO__ === "string" && __BUILD_TIME_ISO__
    ? __BUILD_TIME_ISO__
    : "1970-01-01T00:00:00.000Z";

/** `BUILD_TIME_ISO` als Millisekunden (Startwert der Peak-Uhr). */
export const BUILD_TIME_MS: number = Date.parse(BUILD_TIME_ISO);
