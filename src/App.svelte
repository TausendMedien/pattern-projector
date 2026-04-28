<script lang="ts">
  import { onMount } from "svelte";
  import { createRenderer, type RendererHandle } from "./lib/renderer";
  import { attachKeyboard } from "./lib/keyboard";
  import { patterns } from "./lib/patterns";
  import * as fs from "./lib/fullscreen";

  type AppState = "overview" | "active" | "preview";

  let canvas: HTMLCanvasElement;
  let handle: RendererHandle | null = null;
  let appState = $state<AppState>("overview");
  let index = $state(0);
  let focusedIndex = $state(0);
  let hudVisible = $state(true);
  let hudTimer: ReturnType<typeof setTimeout> | null = null;

  function poke() {
    hudVisible = true;
    if (hudTimer) clearTimeout(hudTimer);
    hudTimer = setTimeout(() => (hudVisible = false), 2000);
  }

  function switchTo(n: number): number {
    const i = ((n % patterns.length) + patterns.length) % patterns.length;
    handle?.setPattern(patterns[i]);
    return i;
  }

  function activatePattern(n: number) {
    index = switchTo(n);
    focusedIndex = index;
    appState = "active";
    poke();
  }

  function activateFullscreen(n: number) {
    activatePattern(n);
    fs.enter(document.documentElement);
  }

  onMount(() => {
    handle = createRenderer(canvas, patterns[0]);

    const detach = attachKeyboard((action) => {
      if (appState === "overview") {
        switch (action.type) {
          case "next":
            focusedIndex = (focusedIndex + 1) % patterns.length;
            switchTo(focusedIndex);
            break;
          case "prev":
            focusedIndex = (focusedIndex - 1 + patterns.length) % patterns.length;
            switchTo(focusedIndex);
            break;
          case "jump":
            if (action.index < patterns.length) {
              focusedIndex = action.index;
              switchTo(focusedIndex);
            }
            break;
          case "enter":
            activatePattern(focusedIndex);
            break;
          case "fullscreen":
            activateFullscreen(focusedIndex);
            break;
        }
      } else if (appState === "active") {
        switch (action.type) {
          case "next":
            index = switchTo(index + 1);
            focusedIndex = index;
            poke();
            break;
          case "prev":
            index = switchTo(index - 1);
            focusedIndex = index;
            poke();
            break;
          case "jump":
            if (action.index < patterns.length) {
              index = switchTo(action.index);
              focusedIndex = index;
              poke();
            }
            break;
          case "fullscreen":
            fs.toggle(document.documentElement);
            poke();
            break;
          case "escape":
            if (fs.isFullscreen()) fs.exit();
            appState = "preview";
            poke();
            break;
        }
      } else {
        // preview
        switch (action.type) {
          case "next":
            index = switchTo(index + 1);
            focusedIndex = index;
            poke();
            break;
          case "prev":
            index = switchTo(index - 1);
            focusedIndex = index;
            poke();
            break;
          case "jump":
            if (action.index < patterns.length) {
              index = switchTo(action.index);
              focusedIndex = index;
              poke();
            }
            break;
          case "fullscreen":
            fs.enter(document.documentElement);
            appState = "active";
            poke();
            break;
          case "escape":
            focusedIndex = index;
            appState = "overview";
            break;
        }
      }
    });

    function onFsChange() {
      if (!fs.isFullscreen() && appState === "active") {
        appState = "preview";
        poke();
      }
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    window.addEventListener("mousemove", poke);

    return () => {
      detach();
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
      window.removeEventListener("mousemove", poke);
      if (hudTimer) clearTimeout(hudTimer);
      handle?.dispose();
      handle = null;
    };
  });
</script>

<canvas bind:this={canvas} class="block w-full h-full"></canvas>

<!-- ─── Overview overlay ──────────────────────────────────────────────── -->
{#if appState === "overview"}
  <div class="fixed inset-0 z-20 flex flex-col items-center justify-center gap-10 bg-black/70 backdrop-blur-sm">

    <div class="text-center">
      <p class="text-xs uppercase tracking-[0.35em] text-white/35">Pattern Projector</p>
    </div>

    <div class="grid grid-cols-3 gap-3 px-10">
      {#each patterns as p, i}
        <button
          class="relative flex flex-col gap-1.5 rounded-xl border px-7 py-5 text-left transition-all duration-150 cursor-pointer
            {focusedIndex === i
              ? 'border-white bg-white/10 shadow-[0_0_28px_rgba(255,255,255,0.12)]'
              : 'border-white/15 bg-white/[0.04] hover:border-white/40 hover:bg-white/[0.07]'}"
          onclick={() => activatePattern(i)}
          onmouseenter={() => { focusedIndex = i; switchTo(i); }}
        >
          <span class="text-[11px] font-mono text-white/35">{i + 1}</span>
          <span class="text-[15px] font-semibold leading-snug text-white">{p.name}</span>
          {#if focusedIndex === i}
            <span class="absolute right-3.5 top-3.5 h-1.5 w-1.5 rounded-full bg-white"></span>
          {/if}
        </button>
      {/each}
    </div>

    <div class="flex gap-5 text-[11px] text-white/30">
      <span><kbd class="rounded bg-white/10 px-1.5 py-0.5 font-mono">← →</kbd> browse</span>
      <span><kbd class="rounded bg-white/10 px-1.5 py-0.5 font-mono">Enter</kbd> select</span>
      <span><kbd class="rounded bg-white/10 px-1.5 py-0.5 font-mono">F</kbd> fullscreen</span>
      <span><kbd class="rounded bg-white/10 px-1.5 py-0.5 font-mono">1–{patterns.length}</kbd> jump</span>
    </div>

  </div>
{/if}

<!-- ─── HUD (active + preview) ────────────────────────────────────────── -->
{#if appState !== "overview"}
  <div
    class="pointer-events-none fixed top-4 left-4 z-10 select-none transition-opacity duration-500"
    class:opacity-0={!hudVisible}
    class:opacity-100={hudVisible}
  >
    <div class="rounded-md border border-white/10 bg-black/60 px-4 py-3 text-white backdrop-blur-sm">
      <div class="text-xs uppercase tracking-widest text-white/50">Pattern</div>
      <div class="text-lg font-semibold">{patterns[index].name}</div>
      <div class="mt-1 text-xs text-white/40">{index + 1} / {patterns.length}</div>
      <div class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-white/70">
        <kbd class="rounded bg-white/10 px-1.5 font-mono">F</kbd>
        <span>fullscreen</span>
        <kbd class="rounded bg-white/10 px-1.5 font-mono">→ ↓</kbd>
        <span>next</span>
        <kbd class="rounded bg-white/10 px-1.5 font-mono">← ↑</kbd>
        <span>previous</span>
        <kbd class="rounded bg-white/10 px-1.5 font-mono">1–{patterns.length}</kbd>
        <span>jump</span>
        <kbd class="rounded bg-white/10 px-1.5 font-mono">Esc</kbd>
        <span>{appState === "preview" ? "overview" : "preview"}</span>
      </div>
    </div>
  </div>
{/if}
