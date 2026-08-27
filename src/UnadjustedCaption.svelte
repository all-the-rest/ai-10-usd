<script lang="ts">
  let { raw, label, tip }: { raw: string; label: string; tip: string } = $props();

  let button = $state<HTMLButtonElement | null>(null);
  let bubble = $state<HTMLElement | null>(null);
  let open = $state(false);
  let pos = $state<{ top: number; left: number }>({ top: 0, left: 0 });

  // Action-based portal: moves the bubble to <body> so it escapes the
  // overflow-x-auto scroll container and is never clipped on mobile.
  // (<svelte:portal> does not exist in Svelte 5.56.)
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  function position() {
    if (!button || !bubble) return;
    const w = bubble.offsetWidth;
    const h = bubble.offsetHeight;
    if (w === 0 || h === 0) return;
    const r = button.getBoundingClientRect();
    const pad = 8;
    const left = clamp(r.left + r.width / 2 - w / 2, pad, window.innerWidth - w - pad);
    let top = r.top - h - pad; // prefer above (tooltip-top)
    if (top < pad) top = r.bottom + pad; // flip below when no room above
    // Clamp fully within the viewport (covers the bottom edge too).
    const maxTop = window.innerHeight - h - pad;
    pos = { top: clamp(top, pad, Math.max(pad, maxTop)), left };
  }

  function toggle() {
    open = !open;
  }

  function closeOnOutsideTap(event: PointerEvent) {
    if (!open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (button && button.contains(target)) return;
    if (bubble && bubble.contains(target)) return;
    open = false;
  }

  $effect(() => {
    if (open && bubble) {
      const raf = requestAnimationFrame(position);
      window.addEventListener("resize", position);
      window.addEventListener("scroll", position, true);
      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", position);
        window.removeEventListener("scroll", position, true);
      };
    }
  });
</script>

<svelte:window onpointerdown={closeOnOutsideTap} />

<button
  bind:this={button}
  type="button"
  class="cursor-help border-0 bg-transparent p-0 text-left whitespace-nowrap text-xs font-normal text-base-content/35"
  aria-label={tip}
  aria-expanded={open}
  onclick={toggle}
>
  ≈ {raw} {label}
  <span class="icon-[material-symbols--info] ml-0.5 inline-block h-3 w-3 align-middle opacity-70" aria-hidden="true"></span>
</button>

{#if open}
  <div
    use:portal
    bind:this={bubble}
    role="tooltip"
    class="pointer-events-none fixed z-50 max-w-xs rounded-md border border-base-300 bg-base-200 px-3 py-2 text-xs text-base-content shadow-lg"
    style={`top:${pos.top}px;left:${pos.left}px`}
  >
    {tip}
  </div>
{/if}
