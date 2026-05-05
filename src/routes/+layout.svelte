<script lang="ts">
  import { onMount } from 'svelte';
  import '../lib/styles/global.css';
  import '../lib/styles/lcars.css';
  import AppShell from '../lib/components/lcars/AppShell.svelte';
  import UnlockModal from '../lib/components/lcars/UnlockModal.svelte';
  import IntegrationHub from '../lib/components/lcars/IntegrationHub.svelte';
  import { hub } from '../lib/stores/hub';
  import { session, effectiveRole, secondsRemaining } from '../lib/stores/session';
  import { indexHealth } from '../lib/stores/indexHealth';
  import { policyState, rbacEnforced } from '../lib/stores/policy';
  import { credentials, credentialSummary } from '../lib/stores/credentials';
  import { registerErrorNotifier } from '../lib/tauri/invoke';
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  let now = $state(new Date());
  let showUnlock = $state(false);
  let notification = $state<{ type: string; message: string } | null>(null);
  let notificationTimer: ReturnType<typeof setTimeout> | null = null;

  const navItems = [
    { label: 'Command', value: 'overview' },
    { label: 'Tickets', value: 'tickets' },
    { label: 'Scaffolds', value: 'scaffolds' },
    { label: 'Integrations', value: 'integrations' },
    { label: 'Audit', value: 'audit' }
  ];

  function showNotification(type: string, message: string) {
    notification = { type, message };
    if (notificationTimer) clearTimeout(notificationTimer);
    notificationTimer = setTimeout(() => { notification = null; }, 6000);
  }

  function dismissNotification() {
    notification = null;
    if (notificationTimer) clearTimeout(notificationTimer);
  }

  // Wire global error notifier (Slice 3 hook, active from Slice 1).
  registerErrorNotifier((state) => {
    if (state.status === 'permission_denied') {
      showNotification('permission_denied', state.message);
      if (state.message.includes('expired') || state.message.includes('locked')) {
        showUnlock = true;
      }
    } else if (state.status === 'suggest_only') {
      showNotification('suggest_only', state.message);
    } else if (state.status === 'error') {
      showNotification('error', state.message);
    }
  });

  // Wire session-expiry into unlock prompt.
  session.onExpired(() => {
    showNotification('permission_denied', 'Session expired. Please re-authenticate.');
    showUnlock = true;
  });

  function roleLabel(role: string | null): string {
    if (role === 'admin') return 'Admin';
    if (role === 'operator') return 'Operator';
    return 'Read Only';
  }

  function formatTtl(secs: number | null): string {
    if (secs === null) return '';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  onMount(() => {
    session.refresh();
    indexHealth.refresh();
    policyState.refresh();
    credentials.refresh();

    const timer = setInterval(() => {
      now = new Date();
    }, 1000);

    return () => clearInterval(timer);
  });
</script>

{#snippet top()}
  <div class="rail-top">
    <div class="rail-top__left lcars-elbow">
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
      <button
        class="rail-nav__item"
        type="button"
        onclick={() => { if (item.value === 'integrations') hub.open('llm'); }}
      >
        <span>{item.label}</span>
      </button>
    {/each}
  </div>
{/snippet}

{#snippet telemetry()}
  <div class="rail-telemetry">
    <section class="telemetry-card">
      <p class="lcars-label">Credential Health</p>
      {#if $credentials.status === 'loading'}
        <p class="telemetry-value">…</p>
      {:else if $credentials.status === 'empty'}
        <p class="telemetry-value">0 configured</p>
      {:else if $credentials.status === 'success'}
        <p class="telemetry-value status-ok">
          {$credentialSummary.healthy} / {$credentialSummary.total}
        </p>
        <small>{$credentialSummary.total} credential{$credentialSummary.total !== 1 ? 's' : ''} configured</small>
      {:else if $credentials.status === 'error'}
        <p class="telemetry-value status-err">Error</p>
        <small>{$credentials.message}</small>
      {:else if $credentials.status === 'permission_denied'}
        <p class="telemetry-value">—</p>
        <small>Insufficient permissions</small>
      {/if}
      <div class="lcars-glow-line"></div>
    </section>

    <section class="telemetry-card">
      <p class="lcars-label">Index Store</p>
      {#if $indexHealth.status === 'loading'}
        <p class="telemetry-value">…</p>
      {:else if $indexHealth.status === 'success'}
        {@const view = $indexHealth.data}
        <p class="telemetry-value
          {view.reachability === 'reachable' ? 'status-ok' :
           view.reachability === 'not_initialized' ? 'status-warn' : 'status-err'}">
          {view.reachability === 'reachable' ? 'Reachable' :
           view.reachability === 'not_initialized' ? 'Not Initialized' :
           view.reachability === 'not_configured' ? 'Not Configured' : 'Unreachable'}
        </p>
        {#if view.path}
          <small title={view.path}>{view.path.split('/').slice(-2).join('/')}</small>
        {/if}
        {#if view.last_error}
          <small class="status-err">{view.last_error}</small>
        {/if}
      {:else if $indexHealth.status === 'error'}
        <p class="telemetry-value status-err">Error</p>
        <small>{$indexHealth.message}</small>
      {:else}
        <p class="telemetry-value">—</p>
      {/if}
    </section>

    <section class="telemetry-card">
      <p class="lcars-label">Policy</p>
      {#if $policyState.status === 'loading'}
        <p class="telemetry-value">…</p>
      {:else if $policyState.status === 'success'}
        <p class="telemetry-value status-ok">RBAC Enforced</p>
        <small>Role: {$policyState.data}</small>
      {:else if $policyState.status === 'error'}
        <p class="telemetry-value status-err">Unavailable</p>
        <small>{$policyState.message}</small>
      {:else}
        <p class="telemetry-value">—</p>
      {/if}
    </section>
  </div>
{/snippet}

{#snippet bottom()}
  <div class="rail-bottom">
    <button
      class="lcars-pill is-purple session-btn"
      type="button"
      onclick={() => (showUnlock = true)}
      title={$session.unlocked ? 'Click to manage session' : 'Click to unlock session'}
    >
      Role: {roleLabel($effectiveRole)}
      {#if $session.unlocked && $secondsRemaining !== null}
        <span class="ttl-badge">{formatTtl($secondsRemaining)}</span>
      {:else if !$session.unlocked}
        <span class="ttl-badge locked">LOCKED</span>
      {/if}
    </button>
    <span class="lcars-pill is-amber">LLM: Stub Runtime</span>
    <span class="rail-bottom__spacer"></span>
    <p>Build train: 1A-1J foundation</p>
  </div>
{/snippet}

{#if notification}
  <div class="notification notification--{notification.type}" role="alert">
    <span>{notification.message}</span>
    <button type="button" onclick={dismissNotification} aria-label="Dismiss">✕</button>
  </div>
{/if}

{#if showUnlock}
  <UnlockModal onclose={() => (showUnlock = false)} />
{/if}

<AppShell {top} {nav} {telemetry} {bottom}>
  {@render children()}
</AppShell>

<IntegrationHub />

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

  .status-ok { color: var(--color-lcars-green, #66cc66); }
  .status-warn { color: var(--color-lcars-amber, #ffcc00); }
  .status-err { color: var(--color-lcars-red, #cc3333); }

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

  .session-btn {
    cursor: pointer;
    border: none;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ttl-badge {
    font-size: var(--text-xs, 0.75rem);
    background: rgba(0, 0, 0, 0.25);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .ttl-badge.locked {
    background: var(--lcars-red, #cc3333);
    color: #fff;
  }

  .notification {
    position: fixed;
    bottom: var(--space-6, 1.5rem);
    right: var(--space-6, 1.5rem);
    z-index: 300;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    max-width: 480px;
    font-size: var(--text-sm, 0.875rem);
    border-left: 4px solid;
    background: var(--color-surface, #1a1a2e);
  }

  .notification--error { border-color: var(--lcars-red, #cc3333); }
  .notification--permission_denied { border-color: var(--lcars-orange, #ff9900); }
  .notification--suggest_only { border-color: var(--lcars-cyan, #99ccff); }

  .notification button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0 var(--space-1);
    opacity: 0.7;
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
