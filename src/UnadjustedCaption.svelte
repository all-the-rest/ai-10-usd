<script lang="ts">
  let { raw, label, tip }: { raw: string; label: string; tip: string } = $props();

  let button = $state<HTMLButtonElement | null>(null);
  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function closeOnOutsideTap(event: PointerEvent) {
    if (!open) return;
    if (event.target instanceof Node && button && !button.contains(event.target)) open = false;
  }
</script>

<svelte:window onpointerdown={closeOnOutsideTap} />

<button
  bind:this={button}
  type="button"
  class="tap-tooltip tooltip cursor-help border-0 bg-transparent p-0 text-left whitespace-nowrap text-xs font-normal text-base-content/35"
  class:tooltip-open={open}
  data-tip={tip}
  aria-label={tip}
  onclick={toggle}
>
  ≈ {raw} {label}
  <span class="icon-[material-symbols--info] ml-0.5 inline-block h-3 w-3 align-middle opacity-70" aria-hidden="true"></span>
</button>
