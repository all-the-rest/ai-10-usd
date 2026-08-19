<script lang="ts">
  import { onMount } from "svelte";
  import { loadComparison } from "./lib/data";
  import { compact, money, number, percent } from "./lib/format";
  import { sortRows } from "./lib/sort";
  import type { ComparisonData, ComparisonRow, SortKey } from "./types";

  let data = $state<ComparisonData | null>(null);
  let error = $state("");
  let search = $state("");
  let matchedOnly = $state(true);
  let sortKey = $state<SortKey>("maxRequests");
  let sortDirection = $state<"asc" | "desc">("desc");

  const filteredRows = $derived.by(() => {
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    const rows = data.rows.filter((row) => {
      if (matchedOnly && row.status !== "matched") return false;
      if (!needle) return true;
      return [row.displayName, row.canonicalModel, row.openCodeGo?.sourceName, row.commandCode?.sourceName]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(needle));
    });
    return sortRows(rows, sortKey, sortDirection);
  });

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    search = params.get("q") ?? "";
    const requestedSort = params.get("sort")?.split(":");
    if (requestedSort?.[0] && isSortKey(requestedSort[0])) sortKey = requestedSort[0];
    if (requestedSort?.[1] === "asc" || requestedSort?.[1] === "desc") sortDirection = requestedSort[1];

    loadComparison()
      .then((loaded) => (data = loaded))
      .catch((reason: unknown) => {
        error = reason instanceof Error ? reason.message : "The comparison data could not be loaded.";
      });
  });

  function isSortKey(value: string): value is SortKey {
    return ["model", "openCodeRequests", "commandCodeRequests", "maxRequests", "normalizedDifference", "advantage"].includes(value);
  }

  function setSort(next: SortKey) {
    if (sortKey === next) sortDirection = sortDirection === "asc" ? "desc" : "asc";
    else {
      sortKey = next;
      sortDirection = next === "model" ? "asc" : "desc";
    }
    syncUrl();
  }

  function syncUrl() {
    const params = new URLSearchParams(window.location.search);
    if (search) params.set("q", search);
    else params.delete("q");
    params.set("sort", `${sortKey}:${sortDirection}`);
    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function winnerLabel(row: ComparisonRow) {
    if (row.comparison.winner === "openCodeGo") return "OpenCode Go";
    if (row.comparison.winner === "commandCode") return "Command Code";
    if (row.comparison.winner === "draw") return "Draw";
    return "Not comparable";
  }

  function winnerClass(row: ComparisonRow) {
    if (row.comparison.winner === "openCodeGo") return "badge-success";
    if (row.comparison.winner === "commandCode") return "badge-info";
    if (row.comparison.winner === "draw") return "badge-ghost";
    return "badge-warning";
  }

  function rowClass(row: ComparisonRow) {
    if (row.comparison.winner === "openCodeGo") return "bg-success/5";
    if (row.comparison.winner === "commandCode") return "bg-info/5";
    return "";
  }

  function bigGap(row: ComparisonRow) {
    return row.comparison.winner !== "draw" && (row.comparison.advantagePercent ?? 0) >= 35;
  }

  function maxRequestsOf(row: ComparisonRow): number | null {
    const go = row.openCodeGo?.normalizedRequestsPer10 ?? null;
    const cc = row.commandCode?.normalizedRequestsPer10 ?? null;
    if (go === null && cc === null) return null;
    return Math.max(go ?? -Infinity, cc ?? -Infinity);
  }

  const biggestAbsolute = $derived(
    (data?.rows ?? [])
      .filter((row) => row.status === "matched")
      .sort((a, b) => (b.comparison.normalizedDifference ?? 0) - (a.comparison.normalizedDifference ?? 0))
      .slice(0, 6)
  );

  function arrow(key: SortKey) {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }
</script>

<div class="min-h-screen text-base-content">
  <header class="navbar border-b border-base-300 bg-base-100/90 px-4 backdrop-blur sm:px-8">
    <div class="navbar-start">
      <a class="text-lg font-black tracking-tight" href="./">AI plans at <span class="text-primary">$10</span></a>
    </div>
    <div class="navbar-end gap-3 text-sm text-base-content/70">
      <a class="link link-hover" href="https://ocgo-pricing.all-the.rest/" target="_blank" rel="noreferrer">OpenCode Go <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a>
      <a class="link link-hover" href="https://cc-pricing.all-the.rest/" target="_blank" rel="noreferrer">Command Code <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:py-16">
    <section class="hero rounded-box border border-base-300 bg-base-200/60 px-5 py-10 shadow-sm sm:px-10">
      <div class="hero-content w-full max-w-none justify-start p-0">
        <div class="max-w-3xl">
          <p class="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-primary">Paid-price comparison</p>
          <h1 class="text-4xl font-black tracking-tight sm:text-6xl">How much AI work does $10 buy?</h1>
          <p class="mt-5 max-w-2xl text-lg leading-relaxed text-base-content/75">
            OpenCode Go and Command Code GOAT are compared by the average number of model requests possible each month.
            Command Code's current paid price of <strong>{money(data?.sources.commandCode.paidMonthly)}</strong> is normalized to the same $10 base.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a class="btn" href="#comparison">See model comparison</a>
            <a class="btn btn-ghost" href="#method">How it works</a>
          </div>
        </div>
      </div>
    </section>

    {#if error}
      <div role="alert" class="alert alert-error mt-8">
        <span>{error}</span>
        <button class="btn btn-sm" onclick={() => location.reload()}>Retry</button>
      </div>
    {:else if !data}
      <div class="mt-8 grid gap-4 sm:grid-cols-3">
        {#each Array(3) as _}
          <div class="card border border-base-300 bg-base-100">
            <div class="card-body gap-3"><div class="skeleton h-4 w-24"></div><div class="skeleton h-9 w-32"></div><div class="skeleton h-4 w-40"></div></div>
          </div>
        {/each}
      </div>
    {:else}
      <section class="mt-8 grid gap-4 sm:grid-cols-3">
        <div class="stats stats-vertical border border-base-300 bg-base-100 shadow-sm sm:stats-horizontal sm:col-span-3">
          <div class="stat">
            <div class="stat-title">Matched model families</div>
            <div class="stat-value number">{data.statistics.matchedModels}</div>
            <div class="stat-desc">of {data.statistics.totalModels} tracked families</div>
          </div>
          <div class="stat">
            <div class="stat-title">Winner split</div>
            <div class="stat-value text-lg number !normal-case">Go {data.statistics.winnerCounts.openCodeGo} · CC {data.statistics.winnerCounts.commandCode}</div>
            <div class="stat-desc">{data.statistics.winnerCounts.draw} draws (within 10%)</div>
          </div>
          <div class="stat">
            <div class="stat-title">Mean requests per $10</div>
            <div class="stat-value number">{compact(data.statistics.requestsPer10.openCodeGo.mean)}</div>
            <div class="stat-desc">Go · Command Code: {compact(data.statistics.requestsPer10.commandCode.mean)}</div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-base-content/70">
          <span class="inline-flex items-center gap-2"><span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">OpenCode Go</span> more requests</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">Command Code</span> more requests</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">Draw</span> within 10%</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-warning badge-sm min-w-28 justify-center whitespace-nowrap">Big gap</span> ≥ 35%</span>
        </div>
      </section>

      <section class="mt-8 grid gap-4 lg:grid-cols-2">
        <div class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title">Plan prices</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead><tr><th>Plan</th><th>Paid monthly</th><th>Credit basis</th></tr></thead>
                <tbody>
                  <tr><th>OpenCode Go</th><td class="number">{money(data.sources.openCodeGo.paidMonthly)}</td><td class="number">{money(data.sources.openCodeGo.monthlyCredit, 0)}</td></tr>
                  <tr><th>Command Code GOAT</th><td class="number">{money(data.sources.commandCode.paidMonthly)}</td><td class="number">{money(data.sources.commandCode.creditsMonthly, 0)}</td></tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-sm text-base-content/65">Both providers are evaluated at exactly $10 by scaling their possible request count by paid price.</p>
          </div>
        </div>
        <div class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title">Average value</h2>
            <div class="mt-2 grid grid-cols-2 gap-4">
              <div class="rounded-box bg-success/10 p-4"><p class="text-sm text-base-content/65">OpenCode Go</p><p class="mt-1 text-2xl font-bold number">{number(data.statistics.requestsPer10.openCodeGo.mean)}</p><p class="text-sm text-base-content/65">requests / $10</p></div>
              <div class="rounded-box bg-info/10 p-4"><p class="text-sm text-base-content/65">Command Code</p><p class="mt-1 text-2xl font-bold number">{number(data.statistics.requestsPer10.commandCode.mean)}</p><p class="text-sm text-base-content/65">requests / $10</p></div>
            </div>
            <p class="mt-3 text-sm text-base-content/65">Median values: {number(data.statistics.requestsPer10.openCodeGo.median)} versus {number(data.statistics.requestsPer10.commandCode.median)} requests.</p>
          </div>
        </div>
      </section>

      {#if data.warnings.length}
        <div role="alert" class="alert alert-warning mt-8">
          <div><strong>Data notes</strong><ul class="mt-1 list-inside list-disc">{#each data.warnings as warning}<li>{warning}</li>{/each}</ul></div>
        </div>
      {/if}

      <section id="comparison" class="mt-14 scroll-mt-24">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">Model-by-model</p><h2 class="mt-2 text-3xl font-black tracking-tight">Average requests per normalized $10</h2><p class="mt-2 max-w-2xl text-base-content/70">Bold is the better value. Peak/off-peak models are compared as separate rows; a difference below 10% counts as a draw.</p></div>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label class="input w-full sm:w-64"><span class="text-base-content/50">⌕</span><input type="search" placeholder="Search model" bind:value={search} oninput={syncUrl} /></label>
            <label class="flex items-center gap-2 text-sm whitespace-nowrap text-base-content/70"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={matchedOnly} />Both plans only</label>
            <span class="text-sm text-base-content/50">Showing {filteredRows.length} of {data.rows.length}</span>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
          <table class="table table-zebra table-pin-rows min-w-[900px]">
            <thead>
              <tr>
                <th><button class="btn btn-ghost btn-xs" onclick={() => setSort("model")}>Model {arrow("model")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("openCodeRequests")}>OpenCode Go / $10 {arrow("openCodeRequests")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("commandCodeRequests")}>Command Code / $10 {arrow("commandCodeRequests")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("normalizedDifference")}>Difference {arrow("normalizedDifference")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("maxRequests")}>Max / $10 {arrow("maxRequests")}</button></th>
                <th>Better value</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredRows as row}
                <tr class={rowClass(row)}>
                  <th><div class="flex items-center gap-2"><span class="font-semibold whitespace-nowrap">{row.displayName}</span>{#if bigGap(row)}<span class="badge badge-warning badge-xs whitespace-nowrap">big gap</span>{/if}</div></th>
                  <td class="text-right number">{#if row.openCodeGo}<div><span class:font-bold={row.comparison.winner === "openCodeGo"} class:text-success={row.comparison.winner === "openCodeGo"}>{compact(row.openCodeGo.normalizedRequestsPer10)}</span><div class="text-xs font-normal text-base-content/45">{money(row.openCodeGo.averageAllowance, 0)} allowance</div></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right number">{#if row.commandCode}<div><span class:font-bold={row.comparison.winner === "commandCode"} class:text-info={row.comparison.winner === "commandCode"}>{compact(row.commandCode.normalizedRequestsPer10)}</span><div class="text-xs font-normal text-base-content/45">{money(row.commandCode.averageAllowance, 0)} allowance</div></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right">{#if row.comparison.normalizedDifference !== null}{@const go = row.openCodeGo!.normalizedRequestsPer10}{@const cc = row.commandCode!.normalizedRequestsPer10}{@const goShare = (go / (go + cc)) * 100}<div class="flex items-center justify-end gap-2"><div class="h-1.5 w-20 overflow-hidden rounded-full bg-base-300 sm:w-28"><div class="flex h-full"><div class="h-full bg-success" style:width={String(goShare.toFixed(1)) + "%"} title={"OpenCode Go " + compact(go)}></div><div class="h-full bg-info" style:width={String((100 - goShare).toFixed(1)) + "%"} title={"Command Code " + compact(cc)}></div></div></div><span class="number text-sm font-semibold {row.comparison.winner === "draw" ? "text-base-content/60" : row.comparison.winner === "openCodeGo" ? "text-success" : "text-info"}">+{number(row.comparison.normalizedDifference)} ({percent(row.comparison.advantagePercent)})</span></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right number">{#if maxRequestsOf(row) !== null}<span class="font-semibold text-base-content/80">{compact(maxRequestsOf(row))}</span>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td>{#if row.comparison.winner}<span class="badge {winnerClass(row)} badge-sm min-w-28 justify-center whitespace-nowrap">{winnerLabel(row)}</span>{:else}<span class="badge badge-warning badge-sm min-w-28 justify-center whitespace-nowrap">Not comparable</span>{/if}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="py-10 text-center text-base-content/60">No model matches your filters.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-14 grid gap-6 lg:grid-cols-2">
        <div class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title">Biggest relative differences</h2>
            <p class="text-sm text-base-content/65">Largest gaps in percent — relative to the worse plan.</p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
              <span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">OpenCode Go</span>
              <span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">Command Code</span>
              <span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">Draw</span>
            </div>
            <div class="mt-4 space-y-3">
              {#each data.statistics.biggestDifferences.slice(0, 6) as row}
                <div class="flex items-center justify-between gap-4 border-b border-base-200 pb-3 last:border-0">
                  <div><p class="font-semibold">{row.displayName}</p><p class="text-sm text-base-content/60">{winnerLabel(row)}</p></div>
                  <span class="badge {winnerClass(row)} number whitespace-nowrap">+{number(row.comparison.normalizedDifference)} · {percent(row.comparison.advantagePercent)}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
        <div class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <h2 class="card-title">Biggest absolute differences</h2>
            <p class="text-sm text-base-content/65">Largest gaps in requests per normalized $10 — regardless of percentage.</p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
              <span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">OpenCode Go</span>
              <span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">Command Code</span>
              <span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">Draw</span>
            </div>
            <div class="mt-4 space-y-3">
              {#each biggestAbsolute as row}
                <div class="flex items-center justify-between gap-4 border-b border-base-200 pb-3 last:border-0">
                  <div><p class="font-semibold">{row.displayName}</p><p class="text-sm text-base-content/60">{winnerLabel(row)}</p></div>
                  <span class="badge {winnerClass(row)} number whitespace-nowrap">+{number(row.comparison.normalizedDifference)} · {percent(row.comparison.advantagePercent)}</span>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </section>

      <section id="method" class="mt-14 scroll-mt-24">
        <div class="card border border-base-300 bg-base-200/50">
          <div class="card-body">
            <h2 class="card-title">Methodology</h2>
            <div class="grid gap-4 text-sm leading-relaxed text-base-content/75 md:grid-cols-3">
              <p><strong>Paid price:</strong> Command Code GOAT uses the current paid checkout amount of {money(data.sources.commandCode.paidMonthly)}. OpenCode Go uses its monthly paid price of {money(data.sources.openCodeGo.paidMonthly)}.</p>
              <p><strong>Fair base:</strong> each model's requests per month are multiplied by $10 divided by its paid plan price. This makes both providers directly comparable despite GOAT costing slightly more.</p>
              <p><strong>Token statistics:</strong> OpenCode Go's per-model token statistics are used for both providers when the model exists in OpenCode; Command Code's average message profile is the fallback. A difference under 10% is a draw; peak/off-peak variants are compared separately.</p>
            </div>
            <div class="divider"></div>
            <p class="text-sm text-base-content/65">Fallback workload (Command Code average message): {number(data.methodology.workload.input)} input · {number(data.methodology.workload.cachedRead)} cached-read · {number(data.methodology.workload.output)} output tokens per request. Generated {new Date(data.generatedAt).toLocaleString("en-US")}.</p>
          </div>
        </div>
      </section>
    {/if}
  </main>

  <footer class="footer footer-center border-t border-base-300 bg-base-200 px-4 py-8 text-base-content/65">
    <aside class="text-sm">
      <p>AI plans at $10 · Open data comparison</p>
      {#if data}<p>Source snapshots: {new Date(data.sources.openCodeGo.fetchedAt).toLocaleDateString("en-US")} and {new Date(data.sources.commandCode.fetchedAt).toLocaleDateString("en-US")}</p>{/if}
      <p><a class="link link-hover" href="https://github.com/reisi007/ai-10-usd" target="_blank" rel="noreferrer">Source code</a> · <a class="link link-hover" href="https://ai-10-usd.all-the.rest/data/latest.json">JSON API</a></p>
    </aside>
  </footer>
</div>