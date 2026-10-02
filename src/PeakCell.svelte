<script lang="ts">
  /**
   * Peak-Angabe **in** der Provider-Zelle der Vergleichstabelle (keine eigene
   * Spalte — Bindungsentscheidung des Nutzers). Jede Zelle zeigt die Zeiten
   * **ihres** Anbieters (`resolvePeak(data, provider, …)`); ohne Peak-Daten für
   * dieses Modell/Anbieter rendert die Komponente gar nichts (kein „-", kein
   * Platzhalter).
   *
   * Aufbau der Anzeige (alles generiert, `src/lib/peak.ts`):
   *   1. Badge „jetzt Peak" / „jetzt Off-Peak" + Countdown bis zum nächsten
   *      Wechsel — nur bei der neuen Regelform (`peakRules`), weil die
   *      Legacy-Form (`peakHours`) **keinen** Wochentags-Scope nennt.
   *   2. `Mo–Fr (Peking-Zeit) · 01:00–04:00 + 06:00–10:00 UTC` — generiert aus
   *      `peak.days`, `timezone` und `peak.windowsUtc`.
   *   3. Legacy: Hinweis „Wochentage lt. Quelle" statt Status/Countdown.
   *
   * Hydration: „Jetzt" kommt aus der geteilten Uhr (`lib/clock.svelte.ts`), die
   * mit dem Build-Stempel startet und erst nach der Hydration auf `Date.now()`
   * umschaltet — Server und erster Client-Render sind damit zeichengleich.
   */
  import {
    formatCountdown,
    formatDayScope,
    formatUtcWindows,
    isBeforeEffectiveFrom,
    isPeakAt,
    localIsoDate,
    localPeakByWeekday,
    formatLocalScope,
    nextTransition,
    resolvePeak,
    timezoneLabel,
    type PeakProvider,
  } from "./lib/peak";
  import { peakNow } from "./lib/clock.svelte";
  import type { ComparisonData, PeakRule } from "./types";
  import type { Lang, Translation } from "./i18n";

  let {
    data,
    provider,
    sourceName,
    lang,
    t,
  }: {
    data: ComparisonData;
    provider: PeakProvider;
    /** `ProviderModelValue.sourceName` — der Key, unter dem die Regel liegt. */
    sourceName: string | null | undefined;
    lang: Lang;
    t: Translation;
  } = $props();

  /** `null` = dieser Anbieter nennt für dieses Modell keine Peak-Daten. */
  const peak = $derived(resolvePeak(data, provider, sourceName));

  /**
   * `nextTransition` sucht ~10 Tage durch; das Ergebnis ändert sich nur, wenn der
   * Peak-Zustand kippt (oder ein alter Übergang vergangen ist). Deshalb wird
   * es pro Zelle einmal gecacht — die Zelle tickt sekündlich, nicht die Suche.
   */
  let cache: { rule: PeakRule; isPeak: boolean; next: number | null } | null = null;

  const live = $derived.by(() => {
    const rule = peak?.rule ?? null;
    // Legacy (`peakHours`) kennt keinen Wochentags-Scope → kein Live-Status,
    // kein Countdown (Wochentage zu erfinden wäre geraten).
    if (!peak || !rule) return null;
    const now = peakNow();
    const isPeak = isPeakAt(rule, peak.calendar, now);
    if (cache && cache.rule === rule && cache.isPeak === isPeak && (cache.next === null || cache.next > now)) {
      return { isPeak, next: cache.next, now };
    }
    const next = nextTransition(rule, peak.calendar, now);
    cache = { rule, isPeak, next };
    return { isPeak, next, now };
  });

  /** „Mo–Fr (Peking-Zeit) · 01:00–04:00 + 06:00–10:00 UTC" (Legacy: nur Fenster). */
  const utcScopeText = $derived.by(() => {
    const resolved = peak;
    if (!resolved) return "";
    const windows = `${formatUtcWindows(resolved.windows)} ${t.peakUtc}`;
    const rule = resolved.rule;
    if (!rule) return `${t.peakLabel} ${windows}`;
    const days = formatDayScope(rule.peak.days, lang);
    const daily = lang === "de" ? "täglich" : "daily";
    // Bei „täglich" ist die Zone redundant (der Scope gilt für alle Wochentage).
    const zone = days === daily ? "" : ` (${timezoneLabel(rule.timezone, lang)})`;
    return `${days}${zone} · ${windows}`;
  });

  /**
   * Browser-Zeitzone — **nur** clientseitig bekannt. Im prerenderten HTML ist sie
   * `null`, dort steht die UTC-Angabe; nach der Hydration ersetzt `localScopeText`
   * sie (Nutzerentscheid 2026-10-02).
   */
  let localZone = $state<string | null>(null);
  $effect(() => {
    if (localZone === null && typeof Intl !== "undefined") {
      localZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
    }
  });

  /**
   * Fenster in der Betrachter-Zeitzone. Aus `localPeakByWeekday` **abgeleitet**
   * statt per Offset gerechnet: die Fenster der Quelle sind UTC-Stunden, der
   * Wochentags-Scope gilt in der Provider-Zone — eine bloße Verschiebung käme an
   * der Tagesgrenze in die falsche Spalte.
   */
  const localScopeText = $derived.by(() => {
    if (!localZone || !peak?.rule) return "";
    const byWeekday = localPeakByWeekday(peak.rule, peak.calendar, localZone, localIsoDate(peakNow(), localZone));
    return formatLocalScope(byWeekday, lang);
  });

  /**
   * Nach der Hydration die lokalen Fenster, sonst die UTC-Angabe. `formatLocalScope`
   * bringt die (lokalen) Wochentage schon mit — deshalb **kein** Tagespräfix davor,
   * sonst stünde der Scope doppelt (`Mo–Fr · Mo–Fr …`). Vor der Hydration (keine
   * Browser-Zeitzone) bzw. im Legacy-Fall steht unverändert die UTC-Zeile.
   */
  const displayScopeText = $derived.by(() => {
    if (!peak?.rule) return utcScopeText;
    if (!localZone || !localScopeText) return utcScopeText;
    return `${localScopeText} (${timezoneLabel(localZone, lang)})`;
  });

  const countdownText = $derived(
    live && live.next !== null ? t.peakCountdown.replace("{time}", formatCountdown(live.next - live.now)) : "",
  );

  /** Tooltip (Desktop-Bonus, daisyUI rein per CSS): exakter Wechselzeitpunkt. */
  const tip = $derived.by(() => {
    const resolved = peak;
    if (!resolved) return "";
    const parts: string[] = [];
    if (live) {
      parts.push(live.isPeak ? t.peakNow : t.peakOffNow);
      if (live.next !== null) {
        parts.push(t.peakNext.replace("{time}", new Date(live.next).toISOString().slice(11, 16)).replace("{utc}", t.peakUtc));
      }
      if (resolved.rule?.effectiveFrom && isBeforeEffectiveFrom(resolved.rule, live.now)) {
        parts.push(t.peakPreEffective.replace("{date}", resolved.rule.effectiveFrom.slice(0, 10)));
      }
    }
    parts.push(displayScopeText);
    // Nach der Hydration: UTC/Provider-Angabe mit in den Tooltip, damit die
    // lokalen Fenster nachvollziehbar bleiben (ohne JS steht nur die UTC-Zeile).
    if (localZone && localScopeText && utcScopeText) parts.push(utcScopeText);
    return parts.join(" · ");
  });
</script>

{#if peak}
  <div
    class="tooltip mt-1 flex flex-col items-end gap-0.5 text-xs font-normal normal-case leading-tight"
    data-tip={tip}
    role="note"
  >
    {#if live}
      <div class="flex items-center justify-end gap-1 whitespace-nowrap">
        <!-- Chip nur im aktiven Zustand: im Off-Peak-Fall trägt die Gewichtung der
             Zeile den Zustand (Nutzerentscheid 2026-10-02), ein „jetzt Off-Peak"-
             Chip wäre redundant. -->
        {#if live.isPeak}
          <span class="badge badge-warning badge-xs whitespace-nowrap">{t.peakNow}</span>
        {/if}
        {#if countdownText}
          <span class="tabular-nums whitespace-nowrap text-base-content/70">{countdownText}</span>
        {/if}
      </div>
    {/if}
    <div class="max-w-[13rem] text-right text-base-content/60">{displayScopeText}</div>
    {#if peak.legacy}
      <div class="max-w-[13rem] text-right text-base-content/50">{t.peakDaysUnknown}</div>
    {/if}
  </div>
{/if}
