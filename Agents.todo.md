# Agents.todo.md

Offene Punkte / Blockaden aus Dependency- und Migrations-Arbeiten.

## 2026-08-23
- typescript 6→7: blockiert durch svelte-check 4.x (peer ^5||^6), erst nach
  svelte-check@5 mit TS7-Support. Kein Upgrade durchgeführt.

## Share-Cards (Portrait-Regel)
- [ ] Portrait-Karten (IG 4:5 1080×1350, Story 9:16 1080×1920) füllen die Höhe mit **Constraints statt
  uninteressanten Modellen**: TopN bescheiden (5–8), pro Zeile max. eine Constraint-Zeile
  (Peak-/Off-Peak-Badge aus `variantKind`), kompakter Constraints-Block unter der Liste
  (Peak-/Off-Peak-Regeln + Stand + Domain-Quelle `ai-10-usd.all-the.rest`).
- [ ] Landscape (OG 1200×630, Twitter 1200×675): Top 5, Requests + Preis, keine Constraints.
- [ ] Zeilen-Details: Rank + Name + Requests + Preis (Breite 1080px begrenzt keine weiteren Felder).

## Browser-Konsolen-Test (Playwright, Follow-up zum Smoke-Test)
- [ ] Playwright-Test, der die Seite im echten Browser lädt und Konsolen-Fehler/pageerrors
  als Fehler wertet (fängt JS-Laufzeitfehler, die Build + `pnpm smoke` nicht sehen).
  Eigene Suite/config (nicht in die Screenshot-Suite — die bleibt assertion-frei),
  in CI nach dem Smoke-Step. Browser via Container-Image oder `playwright install`.

## Peak-Datenform `peakRules` / `holidayCalendars` (2026-10-02)
Spec: `peak-spec.md §1`/`§5` (Single Source of Truth für `ocgo-price-tracker`,
`cc-price-tracker`, `ai-10-usd`, `provider-plans`). `ai-10-usd` ist der Consumer.
- [x] **Provider-Dimension:** `peakRules`/`peakWindows`/`holidayCalendars` sind im
  Ausgabe-JSON `{ openCodeGo, commandCode }` — jede Spalte zeigt die Zeiten ihres
  Anbieters. `buildComparison` re-keyt über `capturePeakForProvider` auf den
  UI-Key (`peakKeyOf(prettyName(name))`); leere Seite → `null`.
- [x] **Dual-Toleranz:** `scripts/normalize.mjs` reicht `peakHours` (Legacy),
  `peakRules` und `holidayCalendars` verbatim durch (`?? null`). **Keine**
  Umrechnung von Legacy-Fenstern auf Wochentage (wäre geraten).
- [x] `src/types.ts`: `PeakRule`/`HolidayCalendar` exakt nach Spec §1,
  `ProviderPeakData<T>` für die beiden Provider-Dimensionen; `peakWindows`
  (`@deprecated`) bleibt für ältere Deploys.
- [x] **Auswertung an einer Stelle** (`src/lib/peak.ts`): `resolvePeak`,
  `isPeakAt`, `isBeforeEffectiveFrom`, `nextTransition`, `localPeakByWeekday`,
  `formatLocalScope`/`formatDayScope`/`formatUtcWindows`/`timezoneLabel`.
  Semantik identisch zu `ocgo-`/`cc-price-tracker`. **Kein 调休/`isWorkday`.**
- [x] `src/PeakCell.svelte` **in** der Provider-Zelle: Chip „jetzt Peak“ nur bei
  aktivem Peak, Countdown, Scope-Angabe; lokale Zeitzone ersetzt nach der
  Hydration die UTC-Zeile (abgeleitet via `localPeakByWeekday`, nicht per Offset).
- [x] **Zeilen-Dimmung ocgo-analog** (`src/App.svelte` `rowTierInactive` +
  `rowClass`): `opacity-50` auf der **ganzen `<tr>`**, wenn die Zeilen-Stufe gerade
  **nicht** wirksam ist (Peak-Zeile im Off-Peak, Off-Peak-Zeile im Peak) — wie
  `isTierActive` im OpenCode-Go-Projekt. Basis-Zeilen/Zeilen ohne Regel nie
  gedimmt; bei mehreren Providern zählt die Zeile als wirksam, sobald **einer**
  wirkt (Nutzerentscheid 2026-10-02).
- [x] **Hydration-sichere Uhr/Stempel:** `src/lib/clock.svelte.ts` +
  `src/lib/buildInfo.ts` (Build-Stempel → `Date.now()` erst in `onMount`).
- [x] **Share-Card zurückgenommen** auf HEAD: nur die UTC-Fensterzeile
  (Portrait-Badge + Constraints), `peakWindowsOf` provider-aggregierend und mit
  Fallback auf `peakRules[..].peak.windowsUtc` (sonst fiele die Zeile nach der
  Migration weg); **keine** Wochentage/Feiertage auf der Karte
  (Nutzerentscheid 2026-10-02).
- [x] Tests: `tests/peak.test.mjs` (Auswertung, feste Zeitstempel),
  `tests/comparison.test.mjs` (Provider-Dimension + Re-Keying + Legacy-Pfad),
  `tests/share.test.mjs` (direkt via Node-Type-Stripping, daher explizite
  `.ts`-Specifier in `share.ts`). `pnpm test` 73/73, `svelte-check` 0.
- [x] **Lokale Verifikation im Browser** (fixierte Uhr via Playwright): Peak
  (02:00 UTC) → `(Peak)`-Zeilen hell, `(Off-Peak)`-Zeilen `opacity-50`; Off-Peak
  (15:00 UTC) → umgekehrt; nach der Hydration lokal
  `Mon–Fri 03:00–06:00 + 08:00–12:00 (Europe/Vienna)`.
- [ ] **Legacy-Pfad entfernen**, sobald `ocgo-price-tracker` die neue Form
  **dauerhaft** ausliefert (das zuletzt deployte Quell-JSON enthält `peakRules`
  und **kein** `peakHours` mehr). Dann löschen: `peakHours`/`peakWindows`-
  Durchreichung (`normalize.mjs`, `comparison-core.mjs`, `types.ts`),
  `constraintsWindows`/`constraintsCoverage`-Labels (`share.ts`) und die
  Legacy-Zweige in `tests/share.test.mjs`. **Nicht vorher doppelt bauen.**

## Verworfen
- **Legacy-`peakHours`-Stunden auf Wochentage umrechnen** (2026-09-30):
  abgelehnt — die alte Form nennt keinen Wochentags-Scope, jede Zuordnung wäre
  geraten (Hausregel: lieber sichtbar „unbekannt“ als falsch). Deshalb bleibt der
  Legacy-Pfad ein reiner Durchreich-/Anzeigepfad, bis die Quelle die neue Form
  dauerhaft liefert (offener Punkt oben).
- **Wochentags-/Feiertags-Anzeige auf der Share-Card** (2026-10-02): ausgebaut
  (Wochentags-Scope aus `peak.days`, `resolvePeakScope`, `fmtDays`, `offPeakBadge`,
  eigener Playwright-Test `share-peak-rules-*`) und **noch am selben Tag wieder
  zurückgenommen** — für diese $10-Vergleichsseite nicht relevant. `src/lib/share.ts`
  steht byte-nah auf HEAD; **nicht** erneut einführen.
- **`调休`/`isWorkday` (Ausgleichs-Wochentage)** (2026-10-02): verworfen — DeepSeek
  sagt wörtlich „Monday through Friday“; ein 调休-Samstag bleibt Off-Peak.
- **Feiertagsdaten (Peak-/Off-Peak) über einen Kalender/Override** (2026-10-02):
  verworfen — die Tracker-Quelle nennt an der Peak-Notiz **keine** Feiertage (live
  verifiziert, de **und** en). `holidays`/`holidayCalendars` bleiben in allen
  Tracker-Daten leer; der optionale Feiertagszweig in `isPeakAt` ist inert.

