# AI for $10 — OpenCode Go vs Command Code GOAT

Which of the two ~$10 plans gives you more model requests per month? This site
compares them model by model and publishes the result as a static page plus a
machine-readable JSON API.

**Site:** https://ai-10-usd.all-the.rest · **Data:** https://ai-10-usd.all-the.rest/data/latest.json

## What it does

1. Fetches both price trackers:
   - OpenCode Go → `https://ocgo-pricing.all-the.rest/data/latest.json`
   - Command Code → `https://cc-pricing.all-the.rest/data/latest.json`
2. Computes **average requests per model per month** from each tracker's own
   allowance/pricing data (per-provider rules, see `AGENTS.md`).
3. Normalizes both plans to a **$10 base**: Command Code GOAT costs
   `$10.77` paid per month (`COMMAND_CODE_PAID_PRICE` in
   `scripts/build-comparison.mjs`), so its request counts scale by `10 / 10.77`.
4. Matches models via canonical aliases (`data/model-map.json`), merges variants
   per family (peak/off-peak rows stay separate), and decides a winner per model:
   more requests per $10 wins — a relative difference below **10%** counts as a
   **Draw**.
5. Renders the comparison (Svelte 5 UI) and serves the combined payload at
   `/data/latest.json` for API consumers (no credentials needed).

## Stack

- **Svelte 5** + Vite 8 + TypeScript (`svelte-check`)
- **Tailwind CSS 4** + **daisyUI 5** — bundled locally, no external fonts/libs
- Generator: plain Node ≥ 22 (`scripts/build-comparison.mjs`, no runtime deps)
- Tests: `node --test` (generator) + `svelte-check` (UI)
- Package manager: pnpm — the `packageManager` version in `package.json` is
  authoritative (CI reads it)

## Commands

```bash
pnpm install          # lockfile is versioned (lockfileVersion 9)
pnpm generate         # fetch both trackers → public/data/latest.json
pnpm test             # generator unit tests (tests/comparison.test.mjs)
pnpm dev              # dev server
pnpm build            # generate + svelte-check + vite build → dist/
pnpm preview          # serve dist/ locally
pnpm typecheck        # svelte-check only
```

## Data model (`public/data/latest.json`)

```json
{
  "generatedAt": "2026-08-17T10:00:00.000Z",
  "sources": {
    "openCodeGo": { "url": "https://ocgo-pricing.all-the.rest/data/latest.json", "fetchedAt": "…" },
    "commandCode": { "url": "https://cc-pricing.all-the.rest/data/latest.json", "fetchedAt": "…" }
  },
  "plans": {
    "openCodeGo": { "name": "OpenCode Go", "monthlyCost": 10, "monthlyCredit": 60 },
    "commandCode": { "name": "Command Code GOAT", "monthlyCost": 10.77, "paidPrice": 10.77 }
  },
  "statistics": {
    "matched": 22,
    "winners": { "openCodeGo": 11, "commandCode": 8, "draw": 3 },
    "biggestDifferences": [ "full rows, sorted by advantagePercent" ]
  },
  "rows": [
    {
      "id": "deepseek-v4-flash-offpeak",
      "canonicalName": "deepseek-v4-flash",
      "displayName": "DeepSeek V4 Flash · Off-Peak",
      "status": "matched",
      "comparison": {
        "winner": "openCodeGo",
        "normalizedDifference": 80893,
        "advantagePercent": 110.2
      },
      "openCodeGo": { "name": "deepseek-v4-flash", "normalizedRequestsPer10": 153693, "usage": 15, "variantCount": 2 },
      "commandCode": { "name": "deepseek:flash", "normalizedRequestsPer10": 72800, "allowance": 20, "variantCount": 1 }
    }
  ]
}
```

- `comparison.winner`: `"openCodeGo" | "commandCode" | "draw"` for matched rows,
  `null` for models only available on one plan.
- `comparison.normalizedDifference`: always positive — how many more requests per
  $10 the better plan delivers. `advantagePercent` is relative to the worse plan.
- `normalizedRequestsPer10` = requests per month at the $10 base.

## Deployment

GitHub Pages (`upload-pages-artifact` + `deploy-pages`), CNAME in `public/`.

Triggered by:
- `push` to `main`
- `workflow_dispatch` (manual)
- `repository_dispatch` type `source-updated` — fired by both price trackers
  after every deploy that committed data changes.

Generated `public/data/latest.json` is committed by the CI bot only when it
differs from HEAD; the site is deployed on every run either way.

### Dispatch wiring (one-time, needs a token)

Both tracker workflows (`ocgo-price-tracker` / `cc-price-tracker`,
`.github/workflows/price-tracker.yml`) POST to this repo's dispatches endpoint.
They read the secret `AI10USD_DISPATCH_TOKEN` — create it in **both tracker
repos** (Settings → Secrets and variables → Actions):

- Classic PAT with `repo` scope, or a fine-grained PAT with access to
  `ai-10-usd` (Contents: read/write).
- The default `GITHUB_TOKEN` cannot dispatch cross-repo — a PAT or GitHub App
  token is required.
- If the secret is missing the dispatch step is skipped (trackers stay green).

## License

Project code: MIT. Scraped prices are the property of their respective providers.