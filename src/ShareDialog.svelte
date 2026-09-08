<script lang="ts">
  import {
    DEFAULT_SHARE_CONFIG,
    SHARE_I18N,
    SHARE_PRESETS,
    SHARE_TOPN_OPTIONS,
    buildShareSvg,
    effectiveTopN,
    selectTopRows,
    shareQuery,
    type ShareConfig,
    type ShareLang,
    type SharePreset,
    type ShareStatusKey,
    type ShareTheme,
    type ShareWinnerFilter,
  } from "./lib/share";
  import type { ComparisonData } from "./types";

  let { data, config = $bindable({ ...DEFAULT_SHARE_CONFIG }), dialogId = "share-dialog" } = $props<{
    data: ComparisonData | null;
    config: ShareConfig;
    dialogId?: string;
  }>();

  let statusKey = $state<ShareStatusKey | null>(null);
  let statusVars = $state<Record<string, string>>({});
  let statusRaw = $state<string | null>(null);
  let pngBusy = $state(false);

  const s = $derived(SHARE_I18N[config.shareLang as ShareLang]);
  const svg = $derived(data ? buildShareSvg(data, config) : "");
  const previewRows = $derived(data ? selectTopRows(data, config).length : 0);
  const presetSize = $derived(SHARE_PRESETS[config.preset as SharePreset]);
  const fileBase = $derived(`ai-10-usd-top${effectiveTopN(config)}-${config.metric}-${config.preset}`);
  const themeName = $derived(config.theme === "light" ? s.themeLight : s.themeDark);
  const statusText = $derived.by(() => {
    if (statusRaw !== null) return statusRaw;
    if (!statusKey) return "";
    return Object.entries(statusVars).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, v),
      s[statusKey] as string,
    );
  });

  function setStatus(key: ShareStatusKey, vars: Record<string, string> = {}) {
    statusKey = key;
    statusVars = vars;
    statusRaw = null;
  }

  function svgBlob(): Blob {
    return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  }

  function download(href: string, name: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function downloadSvg() {
    const url = URL.createObjectURL(svgBlob());
    download(url, `${fileBase}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus("statusSvgDownloaded");
  }

  async function copySvg() {
    try {
      await navigator.clipboard.writeText(svg);
      setStatus("statusSvgCopied");
    } catch {
      setStatus("statusCopyFailed");
    }
  }

  async function downloadPng() {
    if (!data) return;
    pngBusy = true;
    statusKey = null;
    statusRaw = null;
    try {
      const url = URL.createObjectURL(svgBlob());
      try {
        const img = new Image();
        img.decoding = "sync";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("SVG render failed"));
          img.src = url;
        });
        const canvas = document.createElement("canvas");
        canvas.width = presetSize.width;
        canvas.height = presetSize.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("PNG encode failed");
        const pngUrl = URL.createObjectURL(blob);
        download(pngUrl, `${fileBase}.png`);
        setTimeout(() => URL.revokeObjectURL(pngUrl), 5000);
        setStatus("statusPngDownloaded", { w: String(canvas.width), h: String(canvas.height) });
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch {
      setStatus("statusPngFailed");
    } finally {
      pngBusy = false;
    }
  }

  async function copyLink() {
    const link = `${location.origin}${location.pathname}?${shareQuery(config)}`;
    try {
      await navigator.clipboard.writeText(link);
      setStatus("statusLinkCopied");
    } catch {
      statusKey = null;
      statusVars = {};
      statusRaw = link;
    }
  }

  function close() {
    (document.getElementById(dialogId) as HTMLDialogElement | null)?.close();
  }
</script>

<dialog id={dialogId} class="modal" aria-labelledby={dialogId + "-title"}>
  <div class="modal-box relative max-w-4xl">
    <button
      class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
      aria-label={s.close}
      onclick={close}
    ><span class="icon-[material-symbols--close] h-4 w-4" aria-hidden="true"></span></button>
    <h3 id={dialogId + "-title"} class="text-lg font-bold">{s.title}</h3>
    <p class="py-2 text-sm text-base-content/70">
      {s.subtitle}
    </p>

    <div class="grid gap-4 md:grid-cols-[280px_1fr]">
      <div class="flex flex-col gap-3">
        <fieldset>
          <legend class="label"><span class="label-text font-semibold">{s.language}</span></legend>
          <div class="join" role="radiogroup" aria-label={s.language}>
            <button
              type="button"
              role="radio"
              aria-checked={config.shareLang === "de"}
              class="join-item btn btn-sm"
              class:btn-active={config.shareLang === "de"}
              onclick={() => (config.shareLang = "de" as ShareLang)}
            >DE</button>
            <button
              type="button"
              role="radio"
              aria-checked={config.shareLang === "en"}
              class="join-item btn btn-sm"
              class:btn-active={config.shareLang === "en"}
              onclick={() => (config.shareLang = "en" as ShareLang)}
            >EN</button>
          </div>
        </fieldset>

        <label class="form-control">
          <span class="label"><span class="label-text font-semibold">{s.preset}</span></span>
          <select class="select select-bordered select-sm" bind:value={config.preset} aria-label={s.preset}>
            {#each Object.entries(SHARE_PRESETS) as [key, preset]}
              <option value={key as SharePreset}>{preset.label}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label"><span class="label-text font-semibold">{s.topN}</span></span>
          <select
            class="select select-bordered select-sm"
            aria-label={s.topN}
            bind:value={config.topN}
            onchange={(e) => (config.topN = Number(e.currentTarget.value))}
          >
            {#each SHARE_TOPN_OPTIONS as n}
              <option value={n}>Top {n}</option>
            {/each}
          </select>
        </label>

        <label class="form-control">
          <span class="label"><span class="label-text font-semibold">{s.winner}</span></span>
          <select
            class="select select-bordered select-sm"
            aria-label={s.winner}
            bind:value={config.winner}
            onchange={(e) => (config.winner = e.currentTarget.value as ShareWinnerFilter)}
          >
            <option value="all">{s.winnerAll}</option>
            <option value="openCodeGo">{s.winnerGo}</option>
            <option value="commandCode">{s.winnerCc}</option>
          </select>
        </label>

        <fieldset>
          <legend class="label"><span class="label-text font-semibold">{s.theme}</span></legend>
          <div class="join" role="radiogroup" aria-label={s.theme}>
            <button
              type="button"
              role="radio"
              aria-checked={config.theme === "light"}
              class="join-item btn btn-sm"
              class:btn-active={config.theme === "light"}
              onclick={() => (config.theme = "light" as ShareTheme)}
            >{s.themeLight}</button>
            <button
              type="button"
              role="radio"
              aria-checked={config.theme === "dark"}
              class="join-item btn btn-sm"
              class:btn-active={config.theme === "dark"}
              onclick={() => (config.theme = "dark" as ShareTheme)}
            >{s.themeDark}</button>
          </div>
        </fieldset>

        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={config.matchedOnly} />
          {s.matchedOnly}
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={config.brand} />
          {s.brand}
        </label>
        <label class="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" class="checkbox checkbox-sm" bind:checked={config.timestamp} />
          {s.timestamp}
        </label>
      </div>

      <div>
        <p class="mb-2 text-sm text-base-content/60" aria-live="polite">
          {previewRows} {s.rowsUnit} · {presetSize.width}×{presetSize.height}px · {themeName}
        </p>
        {#if svg}
          <div class="max-h-[70vh] overflow-auto rounded-box border border-base-300 bg-base-200 p-2 [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-full">
            {@html svg}
          </div>
        {:else}
          <div class="skeleton h-48 w-full"></div>
        {/if}
        {#if statusText}
          <p class="mt-2 break-all text-sm text-base-content/70" role="status">{statusText}</p>
        {/if}
      </div>
    </div>

    <div class="modal-action flex flex-wrap gap-2">
      <button class="btn btn-sm btn-outline" onclick={copySvg}>{s.copySvg}</button>
      <button class="btn btn-sm btn-outline" onclick={downloadSvg}>{s.downloadSvg}</button>
      <button class="btn btn-sm btn-outline" onclick={downloadPng} disabled={pngBusy}>
        {#if pngBusy}<span class="loading loading-spinner loading-xs"></span>{/if} {s.downloadPng}
      </button>
      <button class="btn btn-sm btn-primary" onclick={copyLink}>{s.copyLink}</button>
      <button class="btn btn-sm" onclick={close}>{s.close}</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label={s.closeDialog}>close</button></form>
</dialog>
