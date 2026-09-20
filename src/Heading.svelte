<script lang="ts">
  import { onMount, type Snippet } from "svelte";

  let {
    anchor,
    class: cls = "text-lg font-bold tracking-tight",
    children,
    copyLabel = "Direktlink zu diesem Abschnitt (inkl. aller Filter)",
    copyTitle = "Direktlink kopieren",
  }: {
    anchor: string;
    class?: string;
    children: Snippet;
    copyLabel?: string;
    copyTitle?: string;
  } = $props();

  // Hydration-safe deep link: SSR has no `window`, so the prerendered markup
  // carries the bare `#id`. The first client render must match it exactly —
  // the full `pathname + search + #id` form is only applied in onMount
  // (after hydration), keeping SSR and client output identical.
  let fullHref = $state<string | null>(null);

  onMount(() => {
    fullHref = window.location.pathname + window.location.search + "#" + anchor;
  });

  function fullUrl(): string {
    if (typeof window === "undefined") return "#" + anchor;
    return window.location.pathname + window.location.search + "#" + anchor;
  }

  // Dauerhaft sichtbarer `#`-Anker (Mobile hat kein Hover!): kopiert den
  // Direktlink inkl. aller Query-Parameter, aktualisiert die Adresszeile und
  // scrollt zum Abschnitt. writeText lehnt asynchron ab — Promise fangen.
  // Keine eigene Schriftgröße/-gewichtung: erbt vom umgebenden <h2>.
  function onClick(e: MouseEvent) {
    e.preventDefault();
    const url = fullUrl();
    navigator.clipboard?.writeText(url).catch(() => {});
    window.history.replaceState(null, "", url);
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>

<h2 class={cls}>
  {@render children()}
  <a
    href={fullHref ?? "#" + anchor}
    onclick={onClick}
    aria-label={copyLabel}
    title={copyTitle}
    class="select-none p-1 text-base-content/40 transition-colors hover:text-primary focus:text-primary"
  >#</a>
</h2>
