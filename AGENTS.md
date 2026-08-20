# AGENTS.md

## Projektüberblick

„AI for $10“ — Vergleich der beiden ~$10-Pläne: **OpenCode Go** ($10/Monat) vs.
**Command Code GOAT** (paid, $10.77/Monat), Modell für Modell anhand der
durchschnittlichen Anfragen pro Monat, normalisiert auf eine **$10-Basis**.
Datenquellen sind die beiden Preis-Tracker (`https://ocgo-pricing.all-the.rest/data/latest.json`,
`https://cc-pricing.all-the.rest/data/latest.json` — beide liefern
`access-control-allow-origin: *`). Der Generator kombiniert sie in
`public/data/latest.json`; die statische Svelte-5-Seite liegt unter
`https://ai-10-usd.all-the.rest`. Updates kommen per `repository_dispatch`
(`source-updated`) aus den Tracker-Repos — **kein eigenes Cron**.

- Repo (remote): `all-the-rest/ai-10-usd`
- GitHub Pages Custom Domain: `ai-10-usd.all-the.rest` (CNAME)

## Stack

- Svelte 5 + Vite 8 + TypeScript (`svelte-check --tsconfig ./tsconfig.json`);
  `typescript` ist auf `~6.0.3` gepinnt (svelte-check 4.x akzeptiert TS 7 nicht)
- Tailwind CSS 4 + daisyUI 5 — lokal gebündelt, keine externen Fonts/Libs
- Generator: Node ≥ 22, `scripts/build-comparison.mjs` (keine Runtime-Deps)
- Paketmanager: pnpm — Version in `package.json` (`packageManager`) ist maßgeblich
- Deployment: GitHub Pages (`upload-pages-artifact` + `deploy-pages`), CNAME in `public/`

## Befehle

```bash
pnpm install          # Lockfile versioniert (lockfileVersion 9)
pnpm generate         # holt beide Tracker → public/data/latest.json
pnpm test             # Generator-Unit-Tests (node --test)
pnpm dev              # Dev-Server
pnpm build            # generate + svelte-check + vite build → dist/
pnpm preview          # dist/ lokal serven
pnpm typecheck        # nur svelte-check
```

## Generator-Regeln (`scripts/build-comparison.mjs`)

- **Konstanten:** `COMMAND_CODE_PAID_PRICE = 10.77` (vom Nutzer bestätigter
  bezahlter Monatspreis; Quelle: `https://cc-pricing.all-the.rest/?sort=requests:desc`).
  Normalisierung Command Code: `requests × 10 / paidPrice`. OpenCode Go ist
  bereits $10 → keine Skalierung.
- **Token-Statistik** (durchschnittliche Anfragen pro Monat je Modell):
  - OpenCode Go: `requests = monthlyCredit × 1000 / (pattern-basierte Kosten pro Anfrage)`
    mit dem **pro-Modell-`pattern`** aus dessen `latest.json` (`input`/`cachedRead`/`output`
    Tokens pro Anfrage; Kosten = 5% Input-Preis + 95% Cached-Write-Preis für Input,
    Cached-Read-Preis für Cached, Output-Preis für Output). Models ohne `pattern`:
    Fallback `AVERAGE_MESSAGE_PATTERN = 800/50000/162` (Command-Code-Messwert).
  - Command Code: `requests = monthlyAllowance / effectivePricePerMillTokenMess`,
    Allowance aus `allowances.goat → plan.defaultAllowance → plan.creditsMonthly`,
    Preise aus `model.pricing` (cached = 0.1 × input); `AVERAGE_MESSAGE_PATTERN`
    für alle Modelle.
- **`$10`-normalisierte Requests** je Modell (`normalizedRequestsPer10`) sind die
  Vergleichsbasis der Tabelle.
- **Draw-Regel:** relative Differenz < 10% (`DRAW_THRESHOLD_PERCENT = 10`) →
  `winner: "draw"`. `normalizedDifference` ist **immer positiv** (= „wie viel
  besser das bessere Angebot ist“), `advantagePercent` relativ zum schlechteren Plan.
- **Varianten:** Peak/Off-Peak (DeepSeek V4 Pro/Flash) bleiben **getrennte Zeilen**
  (`variantKind`/`variantTitle`, `· Off-Peak`/`· Peak`); weitere Varianten werden
  pro Familie gemittelt (`averageFamilyRequests`), `variantCount` dokumentiert die
  Zahl der gemittelten Einträge.
- **Matching:** kanonische Aliase in `data/model-map.json` (inkl. `hy3`/`tencenthy3`);
  `normalizeName`, `canonicalName` und `displayNameOf` in `scripts/model-map.mjs`
  (exportiert, unit-getestet). **Pro-Quelle-Überschreibungen** (`sourceAliases`)
  gewinnen vor den globalen `aliases` — nötig, wenn Quellen denselben Namen für
  unterschiedliche Modelle nutzen: OpenCode Go nennt den Contributor-Tier schlicht
  „Muse Spark 1.2" (`musespark12` → `muse-spark-1.2-contributor`), Command Code führt
  Contributor UND das teure Basis-Modell separat (`musespark12contributor` →
  dasselbe Kanonische; Basis-„Muse Spark 1.2" bleibt ungemappt → `commandCodeOnly`).
  `prettyNames` liefert das Anzeige-Label abweichend vom Quellnamen
  („Muse Spark 1.2 Contributor"). Ausgeschlossen: Free-/Deal-Modelle und
  Goat-unverfügbare CC-Modelle (`ignoredNames`). CC-Modelle ohne OpenCode-
  Pendant + OpenCode-only-Modelle bleiben als `status: "openCodeGoOnly" "/ "commandCodeOnly"`
  mit `comparison: null` in den Daten (die UI blendet sie per Default aus).
- Ausgabe `public/data/latest.json`: `generatedAt`, `sources` (URL + `fetchedAt`),
  `plans`, `statistics` (`matched`, `winners`, `biggestDifferences` — volle Rows,
  sortiert nach `advantagePercent` desc), `rows`. Fehlerhafter Fetch eines Trackers
  → `process.exit(1)` → CI rot.

## UI-Regeln (daisyUI 5 / Tailwind 4)

- Nur daisyUI- und Tailwind-Klassen; Semantic-Colors (`base-*`, `primary`,
  `badge-success/-info/-ghost/-warning/-error`); kein `dark:`-Präfix. Kein
  `tailwind.config.js` — Tailwind 4 braucht nur `@import "tailwindcss";` +
  `@plugin "daisyui";` in `src/app.css`.
- **Farbcodierung (immer mit Legende):** `badge-success` = OpenCode Go gewinnt,
  `badge-info` = Command Code gewinnt, `badge-ghost` = Draw (<10%),
  `badge-warning` = „big gap“ (≥35% Vorsprung) bzw. „Not comparable“.
  Legenden-Badges haben Einheitsbreite (`min-w-28 justify-center whitespace-nowrap`).
- **Alle Badges** im Table: `whitespace-nowrap` — mehrzeilige Badges sind verboten.
  Winner-Badge in der Tabelle ebenfalls `min-w-28 justify-center`.
- **Defaults:** `matchedOnly = true` („Both plans only“) und Sortierung
  `maxRequests desc` (hohes Anfragevolumen = günstige Modelle oben).
- **Spalten:** Modell (Name + `big gap`-Badge), OpenCode Go /$10 (fett + grün wenn
  Sieger, Sub-Caption `$Nutzung usage`), Command Code /$10 (fett + info wenn
  Sieger, Sub-Caption `$Allowance allowance` — **kein doppeltes `$`**, `money()`
  formatiert bereits mit Währung), Difference (Inline-Segment-Bar Go/CC + 
  `+Anzahl (Pct)`, immer positiv), Max / $10 (`max(go, cc)`, sortierbar), Better
  value (Winner-Badge). Fehlende Werte: `-`. Sortieren ausschließlich über
  Spalten-Header-Buttons (keine Sortier-Zeile).
- **Header-Links** zu den Trackern: „OpenCode Go [price tracker] ↗“ /
  „Command Code [price tracker] ↗“ — die Links müssen als Preis-Tracker-Seiten
  erkennbar sein.
- **Abschnitte:** Stats (Cards + Legende darunter, inkl. „Big gap ≥ 35%“) →
  Preistabelle → Plan prices → Changelog-artige? Nein: Statistik-Cards
  „Biggest relative differences“ (Sortierung nach %, Zeilen zeigen
  `+Anzahl · Pct`) und „Biggest absolute differences“ (Sortierung nach
  `normalizedDifference`, gleiche Badge-Darstellung) — beide mit Legende +
  Winner-Badge-Darstellung. **Kein** Outliers-Abschnitt in der UI.
- **Query-Params:** `sort=…`, `dir=…`, `match=1`, `q=…` werden beim Laden gelesen
  und via `history.replaceState` geschrieben.

## CI/CD (`.github/workflows/pages.yml`)

- Trigger: `push` auf `main`, `workflow_dispatch`, `repository_dispatch` Typ
  `source-updated`.
- Pipeline: install (`--frozen-lockfile`) → `pnpm test` → `pnpm build` (generiert
  `public/data/latest.json`) → Commit-Step: **nur bei semantischer Änderung**
  (`scripts/has-semantic-change.mjs` vergleicht gegen `HEAD`, ignoriert den
  volatilen `generatedAt`-Stempel — verhindert Commit-Schleifen; bot-Commit
  pusht → ein zusätzlicher No-Op-Lauf, keine Schleife) →
  `upload-pages-artifact` (dist) + `upload-artifact` (Zip) → `deploy-pages`.
- Die **Tracker-Repos** feuern den Dispatch nach dem Deploy **nur wenn ihre Daten
  geändert wurden** (`needs.build.outputs.changed == 'true'`) mit Secret
  `AI10USD_DISPATCH_TOKEN` (PAT, cross-repo nötig — `GITHUB_TOKEN` reicht nicht).
  Fehlt das Secret → Step wird übersprungen (Tracker bleiben grün).

## Tests

- `pnpm test` = Generator-Unit-Tests (`tests/comparison.test.mjs`): Normalisierung
  (×10/10.77), Draw-Schwelle (<10% → draw), positive Differenz (abs), 
  Pattern-Fallback, Varianten-Mittelung, Matching/Aliase.
- `pnpm build` läuft zusätzlich `svelte-check` (0 errors/warnings Pflicht).

## Verifikation

Nach jeder Umsetzung prüft ein unabhängiger Agent:
`pnpm generate` (exit 0, korrekte Daten — vor Commit/Push verpflichtend),
`pnpm test` grün, `pnpm build` grün, `dist/` enthält `data/latest.json` + `CNAME`,
Workflow-YAML valide, `pnpm preview` liefert 200 und der JSON-Endpunkt
`/data/latest.json` antwortet (Schema vollständig). Außerdem aktuelle
Tool-Versionen (`pnpm outdated` ohne ungewollte Abweichungen, Node ≥ 22, pnpm aus
`packageManager`). Nach Push wird die CI bis zum grünen Lauf beobachtet.