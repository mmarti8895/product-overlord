<!--
  AppShell — LCARS primary layout grid

  Provides the full-window 5-region grid:
    ┌───────────────────────────────────────────┐
    │          top rail (96px)                  │
    ├──────────┬──────────────────┬─────────────┤
    │ nav rail │   main content   │  telemetry  │
    │ (220px)  │  (1fr)           │   (320px)   │
    ├──────────┴──────────────────┴─────────────┤
    │          bottom rail (88px)               │
    └───────────────────────────────────────────┘

  Slots:
    top        — top rail content
    nav        — left navigation rail
    telemetry  — right telemetry rail
    bottom     — bottom status rail
    default    — main content area

  No business logic. No data fetching. Layout only.
  All colours via CSS variables from tokens.css.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    top?: Snippet;
    nav?: Snippet;
    telemetry?: Snippet;
    bottom?: Snippet;
    children?: Snippet;
  }

  let { top, nav, telemetry, bottom, children }: Props = $props();
</script>

<a href="#main-content" class="skip-to-content">Skip to content</a>

<div class="app-shell">
  <!-- Top Rail -->
  <header class="shell-top">
    {#if top}
      {@render top()}
    {:else}
      <div class="shell-top__default-elbow"></div>
      <div class="shell-top__default-bar"></div>
    {/if}
  </header>

  <!-- Left Nav Rail -->
  <nav class="shell-nav" aria-label="Primary navigation">
    {#if nav}
      {@render nav()}
    {/if}
  </nav>

  <!-- Main Content -->
  <main id="main-content" class="shell-main" tabindex="-1">
    {#if children}
      {@render children()}
    {/if}
  </main>

  <!-- Right Telemetry Rail -->
  <aside class="shell-telemetry" aria-label="Telemetry and status">
    {#if telemetry}
      {@render telemetry()}
    {/if}
  </aside>

  <!-- Bottom Rail -->
  <footer class="shell-bottom">
    {#if bottom}
      {@render bottom()}
    {:else}
      <div class="shell-bottom__default-bar"></div>
    {/if}
  </footer>
</div>

<style>
  /* Shell container — 5-region CSS Grid */
  .app-shell {
    display: grid;
    grid-template-columns:
      var(--shell-col-nav)
      var(--shell-col-main)
      var(--shell-col-telemetry);
    grid-template-rows:
      var(--shell-row-top)
      var(--shell-row-main)
      var(--shell-row-bottom);
    grid-template-areas:
      "top    top    top"
      "nav    main   telemetry"
      "bottom bottom bottom";
    min-height: 100vh;
    background-color: var(--color-bg);
    color: var(--color-text-primary);
  }

  /* Top Rail */
  .shell-top {
    grid-area: top;
    display: flex;
    align-items: stretch;
    background-color: var(--color-bg);
    border-bottom: 1px solid var(--color-border-subtle);
    overflow: hidden;
  }

  .shell-top__default-elbow {
    width: var(--shell-col-nav);
    flex-shrink: 0;
    border-radius: var(--radius-lcars-elbow) 0 0 0;
    background-color: var(--color-lcars-orange);
  }

  .shell-top__default-bar {
    flex: 1;
    margin: var(--space-4) var(--space-4) var(--space-4) 0;
    background-color: var(--color-lcars-tan);
    border-radius: var(--radius-sm);
  }

  /* Left Nav Rail */
  .shell-nav {
    grid-area: nav;
    background-color: var(--color-bg-elevated);
    border-right: 1px solid var(--color-border-subtle);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Main Content */
  .shell-main {
    grid-area: main;
    background-color: var(--color-bg);
    overflow-y: auto;
    /* Remove default focus ring — shell provides skip link */
    outline: none;
  }

  /* Right Telemetry Rail */
  .shell-telemetry {
    grid-area: telemetry;
    background-color: var(--color-bg-elevated);
    border-left: 1px solid var(--color-border-subtle);
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* Bottom Rail */
  .shell-bottom {
    grid-area: bottom;
    display: flex;
    align-items: center;
    background-color: var(--color-bg);
    border-top: 1px solid var(--color-border-subtle);
    overflow: hidden;
  }

  .shell-bottom__default-bar {
    flex: 1;
    height: var(--space-4);
    margin: 0 var(--space-4);
    background-color: var(--color-lcars-tan);
    border-radius: var(--radius-sm);
  }

  @media (max-width: 1200px) {
    .app-shell {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows:
        var(--shell-row-top)
        auto
        auto
        minmax(0, 1fr)
        auto
        var(--shell-row-bottom);
      grid-template-areas:
        "top"
        "nav"
        "telemetry"
        "main"
        "main"
        "bottom";
    }

    .shell-nav,
    .shell-telemetry {
      border: none;
      border-bottom: 1px solid var(--color-border-subtle);
    }
  }
</style>
