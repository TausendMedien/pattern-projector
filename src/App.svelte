<script lang="ts">
  import { onMount } from "svelte";
  import { createRenderer, type RendererHandle } from "./lib/renderer";
  import { attachKeyboard } from "./lib/keyboard";
  import { patterns } from "./lib/patterns";
  import * as fs from "./lib/fullscreen";

  let canvas: HTMLCanvasElement;
  let index = $state(0);
  let hudVisible = $state(true);
  let hudTimer: ReturnType<typeof setTimeout> | null = null;

  function poke() {
    hudVisible = true;
    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(() => (hudVisible = false), 2000);
  }

  onMount(() => {
    const handle: RendererHandle = createRenderer(canvas, patterns[0]);

    function go(next: number) {
      const n = ((next % patterns.length) + patterns.length) % patterns.length;
      index = n;
      handle.setPattern(patterns[n]);
      poke();
    }

    const detach = attachKeyboard((action) => {
      switch (action.type) {
        case "next":
          go(index + 1);
          break;
        case "prev":
          go(index - 1);
          break;
        case "jump":
          if (action.index < patterns.length) go(action.index);
          break;
        case "fullscreen":
          fs.toggle(document.documentElement);
          poke();
          break;
      }
    });

    poke();
    window.addEventListener("mousemove", poke);

    return () => {
      detach();
      window.removeEventListener("mousemove", poke);
      if (hudTimer) clearTimeout(hudTimer);
      handle.dispose();
    };
  });
</script>

<canvas bind:this={canvas} class="block w-full h-full"></canvas>

<div
  class="pointer-events-none fixed top-4 left-4 z-10 select-none transition-opacity duration-500"
  class:opacity-0={!hudVisible}
  class:opacity-100={hudVisible}
>
  <div class="rounded-md bg-black/60 px-4 py-3 text-white backdrop-blur-sm border border-white/10">
    <div class="text-xs uppercase tracking-widest text-white/50">Pattern</div>
    <div class="text-lg font-semibold">{patterns[index].name}</div>
    <div class="mt-1 text-xs text-white/40">
      {index + 1} / {patterns.length}
    </div>
    <div class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-white/70">
      <kbd class="rounded bg-white/10 px-1.5 font-mono">F</kbd>
      <span>fullscreen</span>
      <kbd class="rounded bg-white/10 px-1.5 font-mono">→ ↓</kbd>
      <span>next</span>
      <kbd class="rounded bg-white/10 px-1.5 font-mono">← ↑</kbd>
      <span>previous</span>
      <kbd class="rounded bg-white/10 px-1.5 font-mono">1–{patterns.length}</kbd>
      <span>jump</span>
    </div>
  </div>
</div>
