<script lang="ts">
  import { onMount } from "svelte";
  import { loadComparison } from "./lib/data";
  import { compact, money, number, percent } from "./lib/format";
  import { sortRows } from "./lib/sort";
  import { i18n, type Lang } from "./i18n";
  import type { ComparisonData, ComparisonRow, SortKey } from "./types";
  import Heading from "./Heading.svelte";

  let data = $state<ComparisonData | null>(null);
  let error = $state("");
  let search = $state("");
  let matchedOnly = $state(true);
  let sortKey = $state<SortKey>("maxRequests");
  let sortDirection = $state<"asc" | "desc">("desc");

  let defaultLang: Lang = ((): Lang => {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("lang");
      if (stored === "de" || stored === "en") return stored;
    }
    return navigator.language.startsWith("de") ? "de" : "en";
  })();

  let lang = $state<Lang>(defaultLang);
  let dark = $state(false);

  const t = $derived(i18n[lang]);

  function setLang(next: Lang) {
    lang = next;
    syncUrl();
  }

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

    const requestedSort = params.get("sort");
    if (requestedSort && isSortKey(requestedSort)) sortKey = requestedSort;

    const requestedDir = params.get("dir");
    if (requestedDir === "asc" || requestedDir === "desc") sortDirection = requestedDir;

    const requestedMatch = params.get("match");
    if (requestedMatch === "0") matchedOnly = false;

    const requestedLang = params.get("lang");
    if (requestedLang === "de" || requestedLang === "en") {
      lang = requestedLang;
      defaultLang = requestedLang;
    }

    dark = params.get("theme") === "dark" || (typeof localStorage !== "undefined" && localStorage.getItem("theme") === "dark");

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
    if (search) params.set("q", search); else params.delete("q");
    if (sortKey === "maxRequests" && sortDirection === "desc") { params.delete("sort"); } else { params.set("sort", sortKey); }
    if (sortDirection === "desc") params.delete("dir"); else params.set("dir", sortDirection);
    if (!matchedOnly) params.set("match", "0"); else params.delete("match");
    if (lang !== defaultLang) params.set("lang", lang); else params.delete("lang");
    if (dark) params.set("theme", "dark"); else params.delete("theme");
    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function winnerLabel(row: ComparisonRow) {
    if (row.comparison.winner === "openCodeGo") return t.winnerGo;
    if (row.comparison.winner === "commandCode") return t.winnerCc;
    if (row.comparison.winner === "draw") return t.winnerDraw;
    return t.winnerNone;
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

  $effect(() => {
    if (typeof document === "undefined") return;
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("theme", dark ? "dark" : "light");
    }
  });

  $effect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("lang", lang);
    }
  });
</script>

<div class="min-h-screen text-base-content">
  <header class="sticky top-0 z-10 bg-base-200 shadow-sm">
    <div class="navbar mx-auto max-w-7xl px-4 sm:px-8">
    <div class="navbar-start">
      <a class="flex items-center gap-2 text-lg font-black tracking-tight" href="./">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary h-5 w-5" aria-hidden="true"><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
        {@html t.brand}
      </a>
    </div>
    <div class="navbar-end gap-2 text-sm text-base-content/70 sm:gap-3">
      <!-- Desktop (≥ md): Cross-Links inline -->
      <div class="hidden items-center gap-3 md:flex">
        <a class="link link-hover" href="https://ocgo-pricing.all-the.rest/" target="_blank" rel="noreferrer">OpenCode Go <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a>
        <a class="link link-hover" href="https://cc-pricing.all-the.rest/" target="_blank" rel="noreferrer">Command Code <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a>
      </div>
      <!-- Mobile (< md): Burger-Dropdown mit denselben Links -->
      <div class="dropdown dropdown-end md:hidden">
        <div tabindex="0" role="button" class="btn btn-ghost btn-circle btn-sm" aria-label={lang === "de" ? "Weitere Links" : "More links"}>
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </div>
        <ul class="menu dropdown-content z-20 mt-2 w-72 rounded-box bg-base-100 p-2 shadow-lg">
          <li><a href="https://ocgo-pricing.all-the.rest/" target="_blank" rel="noreferrer" class="whitespace-nowrap">OpenCode Go <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a></li>
          <li><a href="https://cc-pricing.all-the.rest/" target="_blank" rel="noreferrer" class="whitespace-nowrap">Command Code <span class="badge badge-ghost badge-xs whitespace-nowrap">price tracker</span> <span aria-hidden="true">↗</span></a></li>
        </ul>
      </div>
      <!-- …existing DE/EN join + theme swap stay here, unchanged… -->
      <div class="join">
        <button class="join-item btn btn-sm" class:btn-active={lang === "de"} onclick={() => setLang("de")}>DE</button>
        <button class="join-item btn btn-sm" class:btn-active={lang === "en"} onclick={() => setLang("en")}>EN</button>
      </div>
      <label class="swap swap-rotate">
        <input type="checkbox" class="theme-controller" value="dark" checked={dark} onchange={() => { dark = !dark; syncUrl(); }} />
        <svg class="swap-off h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5.64 17l-.71.71a1 1 0 0 0 0 1.41 1 1 0 0 0 1.41 0l.71-.71A1 1 0 0 0 5.64 17ZM5 12a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h1a1 1 0 0 0 1-1Zm.64 5-.71.71a1 1 0 0 0 0 1.41 1 1 0 0 0 1.41 0l.71-.71A1 1 0 0 0 5.64 17ZM12 5a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v1a1 1 0 0 0 1 1Zm5.66 2.34a1 1 0 0 0 .7-.29l.71-.71a1 1 0 1 0-1.41-1.41l-.66.71a1 1 0 0 0 0 1.41 1 1 0 0 0 .66.29Zm-12-.29a1 1 0 0 0 1.41 0 1 1 0 0 0 0-1.41l-.71-.71a1.004 1.004 0 1 0-1.43 1.41l.73.71ZM21 11h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2Zm-2.64 6A1 1 0 0 0 17 18.36l.71.71a1 1 0 0 0 1.41 0 1 1 0 0 0 0-1.41l-.76-.66ZM12 6.5a5.5 5.5 0 1 0 5.5 5.5A5.51 5.51 0 0 0 12 6.5Zm0 9a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm0 3.5a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1Z"/></svg>
        <svg class="swap-on h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.64 13a1 1 0 0 0-1.05-.14 8.049 8.049 0 0 1-3.37.73 8.15 8.15 0 0 1-8.14-8.1 8.59 8.59 0 0 1 .25-2A1 1 0 0 0 8 2.36a10.14 10.14 0 1 0 14 11.69 1 1 0 0 0-.36-1.05Zm-9.5 6.69A8.14 8.14 0 0 1 7.08 5.22v.27a10.15 10.15 0 0 0 10.14 10.14 9.784 9.784 0 0 0 2.1-.22 8.11 8.11 0 0 1-7.18 4.32v-.04Z"/></svg>
      </label>
    </div>
    </div>
  </header>

  <main class="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:py-16">
    <section class="hero rounded-box border border-base-300 bg-base-200/60 px-5 py-10 shadow-sm sm:px-10">
      <div class="hero-content w-full max-w-none justify-start p-0">
        <div class="max-w-3xl">
          <p class="mb-3 text-sm font-bold uppercase tracking-[0.2em] text-primary">{t.heroLabel}</p>
          <h1 class="text-4xl font-black tracking-tight sm:text-6xl">{t.heroTitle}</h1>
          <p class="mt-5 max-w-2xl text-lg leading-relaxed text-base-content/75">
            {@html t.heroIntro.replace("{price}", money(data?.sources.commandCode.paidMonthly))}
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a class="btn btn-primary" href="#comparison">{t.btnComparison}</a>
            <a class="btn btn-outline" href="#method">{t.btnMethod}</a>
          </div>
        </div>
      </div>
    </section>

    {#if error}
      <div role="alert" class="alert alert-error mt-8">
        <span>{error}</span>
        <button class="btn btn-sm" onclick={() => location.reload()}>{t.retry}</button>
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
            <div class="stat-title">{t.statMatched}</div>
            <div class="stat-value number">{data.statistics.matchedModels}</div>
            <div class="stat-desc">{t.statMatchedDesc.replace("{total}", String(data.statistics.totalModels))}</div>
          </div>
          <div class="stat">
            <div class="stat-title">{t.statWinner}</div>
            <div class="stat-value text-lg number !normal-case">Go {data.statistics.winnerCounts.openCodeGo} · CC {data.statistics.winnerCounts.commandCode}</div>
            <div class="stat-desc">{t.statWinnerDesc.replace("{draws}", String(data.statistics.winnerCounts.draw))}</div>
          </div>
          <div class="stat">
            <div class="stat-title">{t.statMean}</div>
            <div class="stat-value number">{compact(data.statistics.requestsPer10.openCodeGo.mean)}</div>
            <div class="stat-desc">{t.statMeanDesc} {compact(data.statistics.requestsPer10.commandCode.mean)}</div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-base-content/70">
          <span class="inline-flex items-center gap-2"><span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerGo}</span> {t.legendMoreGo}</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerCc}</span> {t.legendMoreCC}</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerDraw}</span> {t.legendDraw}</span>
          <span class="inline-flex items-center gap-2"><span class="badge badge-warning badge-sm min-w-28 justify-center whitespace-nowrap">{t.bigGap}</span> {t.legendBigGap}</span>
        </div>
      </section>

      <section class="mt-8 grid gap-4 lg:grid-cols-2">
        <div id="plan-prices" class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <Heading anchor="plan-prices" class="card-title">{t.planPrices}</Heading>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead><tr><th>{t.planTh}</th><th>{t.paidMonthly}</th><th>{t.creditBasis}</th></tr></thead>
                <tbody>
                  <tr><th>OpenCode Go</th><td class="number">{money(data.sources.openCodeGo.paidMonthly)}</td><td class="number">{money(data.sources.openCodeGo.monthlyCredit, 0)}</td></tr>
                  <tr><th>Command Code GOAT</th><td class="number">{money(data.sources.commandCode.paidMonthly)}</td><td class="number">{money(data.sources.commandCode.creditsMonthly, 0)}</td></tr>
                </tbody>
              </table>
            </div>
            <p class="mt-2 text-sm text-base-content/65">{t.planPricesNote}</p>
          </div>
        </div>
        <div id="avg-value" class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <Heading anchor="avg-value" class="card-title">{t.avgValue}</Heading>
            <div class="mt-2 grid grid-cols-2 gap-4">
              <div class="rounded-box bg-success/10 p-4"><p class="text-sm text-base-content/65">{t.winnerGo}</p><p class="mt-1 text-2xl font-bold number">{number(data.statistics.requestsPer10.openCodeGo.mean)}</p><p class="text-sm text-base-content/65">{t.requestsPer10}</p></div>
              <div class="rounded-box bg-info/10 p-4"><p class="text-sm text-base-content/65">{t.winnerCc}</p><p class="mt-1 text-2xl font-bold number">{number(data.statistics.requestsPer10.commandCode.mean)}</p><p class="text-sm text-base-content/65">{t.requestsPer10}</p></div>
            </div>
            <p class="mt-3 text-sm text-base-content/65">{t.medianValues.replace("{go}", number(data.statistics.requestsPer10.openCodeGo.median)).replace("{cc}", number(data.statistics.requestsPer10.commandCode.median))}</p>
          </div>
        </div>
      </section>

      <div class="mt-8 rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
        <p class="text-sm text-base-content/70">{t.referralText}</p>
        <div class="mt-2 flex items-center gap-2">
          <a class="btn btn-primary btn-sm" href="https://opencode.ai/go?ref=PKTZTZE0P0" target="_blank" rel="noopener noreferrer">{t.referralCta}</a>
          <span class="text-xs text-base-content/45">{t.referralHint}</span>
        </div>
      </div>

      <section id="comparison" class="mt-14 scroll-mt-24">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><p class="text-sm font-bold uppercase tracking-[0.2em] text-primary">{t.modelByModel}</p><Heading anchor="comparison" class="mt-2 text-3xl font-black tracking-tight">{t.comparisonTitle}</Heading><p class="mt-2 max-w-2xl text-base-content/70">{t.comparisonDesc}</p></div>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label class="input w-full sm:w-64"><span class="text-base-content/50">⌕</span><input type="search" placeholder={t.searchPlaceholder} bind:value={search} oninput={syncUrl} /></label>
            <label class="flex items-center gap-2 text-sm whitespace-nowrap text-base-content/70"><input type="checkbox" class="checkbox checkbox-sm" bind:checked={matchedOnly} onchange={syncUrl} />{t.matchedOnly}</label>
            <span class="text-sm text-base-content/50">{t.showing.replace("{show}", String(filteredRows.length)).replace("{total}", String(data.rows.length))}</span>
          </div>
        </div>

        <div class="mt-4 overflow-x-auto rounded-box border border-base-300 bg-base-100 shadow-sm">
          <table class="table table-zebra table-pin-rows min-w-[900px]">
            <thead>
              <tr>
                <th><button class="btn btn-ghost btn-xs" onclick={() => setSort("model")}>{t.colModel} {arrow("model")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("openCodeRequests")}>{t.colGo} {arrow("openCodeRequests")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("commandCodeRequests")}>{t.colCc} {arrow("commandCodeRequests")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("normalizedDifference")}>{t.colDiff} {arrow("normalizedDifference")}</button></th>
                <th class="text-right"><button class="btn btn-ghost btn-xs" onclick={() => setSort("maxRequests")}>{t.colMax} {arrow("maxRequests")}</button></th>
                <th>{t.colBetter}</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredRows as row}
                <tr class={rowClass(row)}>
                  <th><div class="flex items-center gap-2"><span class="font-semibold whitespace-nowrap">{row.displayName}</span>{#if bigGap(row)}<span class="badge badge-warning badge-xs whitespace-nowrap">{t.bigGap}</span>{/if}</div></th>
                  <td class="text-right number">{#if row.openCodeGo}<div><span class:font-bold={row.comparison.winner === "openCodeGo"} class:text-success={row.comparison.winner === "openCodeGo"}>{compact(row.openCodeGo.normalizedRequestsPer10)}</span><div class="text-xs font-normal text-base-content/45">{money(row.openCodeGo.averageAllowance, 0)} {t.allowance}</div></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right number">{#if row.commandCode}<div><span class:font-bold={row.comparison.winner === "commandCode"} class:text-info={row.comparison.winner === "commandCode"}>{compact(row.commandCode.normalizedRequestsPer10)}</span><div class="text-xs font-normal text-base-content/45">{money(row.commandCode.averageAllowance, 0)} {t.allowance}</div></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right">{#if row.comparison.normalizedDifference !== null}{@const go = row.openCodeGo!.normalizedRequestsPer10}{@const cc = row.commandCode!.normalizedRequestsPer10}{@const goShare = (go / (go + cc)) * 100}<div class="flex items-center justify-end gap-2"><div class="h-1.5 w-20 overflow-hidden rounded-full bg-base-300 sm:w-28"><div class="flex h-full"><div class="h-full bg-success" style:width={String(goShare.toFixed(1)) + "%"} title={"OpenCode Go " + compact(go)}></div><div class="h-full bg-info" style:width={String((100 - goShare).toFixed(1)) + "%"} title={"Command Code " + compact(cc)}></div></div></div><span class="number text-sm font-semibold {row.comparison.winner === "draw" ? "text-base-content/60" : row.comparison.winner === "openCodeGo" ? "text-success" : "text-info"}">+{number(row.comparison.normalizedDifference)} ({percent(row.comparison.advantagePercent)})</span></div>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td class="text-right number">{#if maxRequestsOf(row) !== null}<span class="font-semibold text-base-content/80">{compact(maxRequestsOf(row))}</span>{:else}<span class="text-base-content/35">-</span>{/if}</td>
                  <td>{#if row.comparison.winner}<span class="badge {winnerClass(row)} badge-sm min-w-28 justify-center whitespace-nowrap">{winnerLabel(row)}</span>{:else}<span class="badge badge-warning badge-sm min-w-28 justify-center whitespace-nowrap">{t.notComparable}</span>{/if}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="py-10 text-center text-base-content/60">{t.noMatch}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <section class="mt-14 grid gap-6 lg:grid-cols-2">
        <div id="biggest-rel" class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <Heading anchor="biggest-rel" class="card-title">{t.biggestRel}</Heading>
            <p class="text-sm text-base-content/65">{t.biggestRelDesc}</p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
              <span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerGo}</span>
              <span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerCc}</span>
              <span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerDraw}</span>
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
        <div id="biggest-abs" class="card border border-base-300 bg-base-100 shadow-sm">
          <div class="card-body">
            <Heading anchor="biggest-abs" class="card-title">{t.biggestAbs}</Heading>
            <p class="text-sm text-base-content/65">{t.biggestAbsDesc}</p>
            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-base-content/70">
              <span class="badge badge-success badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerGo}</span>
              <span class="badge badge-info badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerCc}</span>
              <span class="badge badge-ghost badge-sm min-w-28 justify-center whitespace-nowrap">{t.winnerDraw}</span>
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
            <Heading anchor="method" class="card-title">{t.methodTitle}</Heading>
            <div class="grid gap-4 text-sm leading-relaxed text-base-content/75 md:grid-cols-3">
              <p><strong>{t.methodPaid}</strong> {t.methodPaidBody.replace("{cc}", money(data.sources.commandCode.paidMonthly)).replace("{go}", money(data.sources.openCodeGo.paidMonthly))}</p>
              <p><strong>{t.methodFair}</strong> {t.methodFairBody}</p>
              <p><strong>{t.methodTokens}</strong> {t.methodTokensBody}</p>
            </div>
            <div class="divider"></div>
            <p class="text-sm text-base-content/65">{t.methodFallback.replace("{input}", number(data.methodology.workload.input)).replace("{cached}", number(data.methodology.workload.cachedRead)).replace("{output}", number(data.methodology.workload.output)).replace("{date}", new Date(data.generatedAt).toLocaleString(lang === "de" ? "de-DE" : "en-US"))}</p>
          </div>
        </div>
      </section>
    {/if}
  </main>

  <footer class="footer footer-center border-t border-base-300 bg-base-200 px-4 py-8 text-base-content/65">
    <aside class="text-sm">
      <p>{t.footerText}</p>
      {#if data}<p>{t.footerSnapshots} {new Date(data.sources.openCodeGo.fetchedAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")} {new Date(data.sources.commandCode.fetchedAt).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}</p>{/if}
      <p><a class="link link-hover" href="https://github.com/all-the-rest/ai-10-usd" target="_blank" rel="noreferrer">{t.footerSource}</a> · <a class="link link-hover" href="https://ai-10-usd.all-the.rest/data/latest.json">{t.footerApi}</a></p>
    </aside>
  </footer>
</div>
