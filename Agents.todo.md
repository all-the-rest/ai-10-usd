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
