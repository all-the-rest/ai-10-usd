<script lang="ts">
  import type { Snippet } from "svelte";

  // Kanonische Direkt-URL zu einem Abschnitt: aktueller Pfad + komplette
  // Query-Parameter (Sprache, Theme, Sortierung, …) + `#id`.
  function directHref(id: string): string {
    if (typeof window === "undefined") return "#" + id;
    return window.location.pathname + window.location.search + "#" + id;
  }

  let {
    anchor,
    class: cls = "text-lg font-bold tracking-tight",
    children,
  }: {
    anchor: string;
    class?: string;
    children: Snippet;
  } = $props();

  // Dauerhaft sichtbarer `#`-Anker (Mobile hat kein Hover!): kopiert den
  // Direktlink inkl. aller Query-Parameter, aktualisiert die Adresszeile und
  // scrollt zum Abschnitt. writeText lehnt asynchron ab — Promise fangen.
  // Keine eigene Schriftgröße/-gewichtung: erbt vom umgebenden <h2>.
  function onClick(e: MouseEvent) {
    e.preventDefault();
    const url = directHref(anchor);
    navigator.clipboard?.writeText(url).catch(() => {});
    window.history.replaceState(null, "", url);
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
</script>

<h2 class={cls}>
  {@render children()}
  <a
    href={directHref(anchor)}
    onclick={onClick}
    aria-label="Direktlink zu diesem Abschnitt (inkl. aller Filter)"
    title="Direktlink kopieren"
    class="select-none p-1 text-base-content/40 transition-colors hover:text-primary focus:text-primary"
  >#</a>
</h2>
