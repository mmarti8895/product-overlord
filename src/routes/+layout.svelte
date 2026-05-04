<script lang="ts">
  import { onMount } from 'svelte';
  import '../lib/styles/global.css';
  import '../lib/styles/lcars.css';
  import AppShell from '../lib/components/lcars/AppShell.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let now = $state(new Date());

  const navItems = [
    { label: 'Command', value: 'overview' },
    { label: 'Tickets', value: 'tickets' },
    { label: 'Scaffolds', value: 'scaffolds' },
    { label: 'Integrations', value: 'integrations' },
    { label: 'Audit', value: 'audit' }
  ];

  onMount(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 1000);

    return () => clearInterval(timer);
  });
</script>

{#snippet top()}
  <div class="rail-top">
    <div class="rail-top__left lcars-elbow">
      <span class="lcars-label">Product Overlord</span>
      <h1>Autonomous AI PM</h1>
    </div>
    <div class="rail-top__center">
      <div class="lcars-pill is-orange">Suggest-Only Mode</div>
      <div class="lcars-pill is-cyan">Phase 1J</div>
      <div class="lcars-pill is-green">All Systems Nominal</div>
    </div>
    <div class="rail-top__right">
      <p class="lcars-label">UTC Chronometer</p>
      <p class="chrono">{now.toISOString().slice(11, 19)}</p>
    </div>
  </div>
{/snippet}

{#snippet nav()}
  <div class="rail-nav">
    <p class="lcars-label rail-nav__header">Navigation</p>
    {#each navItems as item}
      <button class="rail-nav__item" type="button">
        <span>{item.label}</span>
        <small>{item.value}</small>
      </button>
    {/each}
  </div>
{/snippet}

{#snippet telemetry()}
  <div class="rail-telemetry">
    <section class="telemetry-card">
      <p class="lcars-label">Credential Health</p>
      <p class="telemetry-value">5 / 5</p>
      <div class="lcars-glow-line"></div>
    </section>
    <section class="telemetry-card">
      <p class="lcars-label">Index Store</p>
      <p class="telemetry-value">Reachable</p>
      <small>lancedb path configured</small>
    </section>
    <section class="telemetry-card">
      <p class="lcars-label">Policy</p>
      <p class="telemetry-value">RBAC Enforced</p>
      <small>Server-side permission checks active</small>
    </section>
  </div>
{/snippet}

{#snippet bottom()}
  <div class="rail-bottom">
    <span class="lcars-pill is-purple">Role: Admin</span>
    <span class="lcars-pill is-amber">LLM: Stub Runtime</span>
    <span class="rail-bottom__spacer"></span>
    <p>Build train: 1A-1J foundation</p>
  </div>
{/snippet}

<AppShell {top} {nav} {telemetry} {bottom}>
  {@render children()}
</AppShell>

<style>
  .rail-top {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 1.2fr minmax(180px, 0.8fr);
    width: 100%;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    align-items: center;
  }

  .rail-top__left {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-3) var(--space-4);
    min-height: 72px;
    box-shadow: var(--shadow-inset);
  }

  .rail-top__left h1 {
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
  }

  .rail-top__center {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }

  .rail-top__right {
    text-align: right;
  }

  .chrono {
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    letter-spacing: 0.08em;
  }

  .is-orange { background: var(--color-lcars-orange); color: var(--color-text-inverse); }
  .is-cyan { background: var(--color-lcars-cyan); color: var(--color-text-inverse); }
  .is-green { background: var(--color-lcars-green); color: var(--color-text-inverse); }
  .is-purple { background: var(--color-lcars-purple); color: var(--color-text-inverse); }
  .is-amber { background: var(--color-lcars-amber); color: var(--color-text-inverse); }

  .rail-nav {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
  }

  .rail-nav__header {
    margin-bottom: var(--space-2);
  }

  .rail-nav__item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--color-lcars-tan), var(--color-lcars-orange));
    color: var(--color-text-inverse);
    cursor: default;
    box-shadow: var(--shadow-panel);
  }

  .rail-nav__item small {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.8;
  }

  .rail-telemetry {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .telemetry-card {
    border: 1px solid var(--color-border-default);
    border-radius: var(--radius-lg);
    background: var(--color-bg-panel);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    box-shadow: var(--shadow-panel);
  }

  .telemetry-value {
    font-family: var(--font-display);
    font-size: var(--text-lg);
  }

  .rail-bottom {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: 0 var(--space-4);
  }

  .rail-bottom__spacer {
    flex: 1;
  }

  @media (max-width: 1200px) {
    .rail-top {
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    .rail-top__right {
      text-align: left;
    }

    .rail-bottom {
      flex-wrap: wrap;
      padding: var(--space-2) var(--space-3);
    }
  }
</style>
