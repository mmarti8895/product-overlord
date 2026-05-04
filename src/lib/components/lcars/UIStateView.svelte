<script lang="ts">
  import type { UIState } from '$lib/tauri/invoke';
  import type { Snippet } from 'svelte';

  interface Props<T> {
    state: UIState<T>;
    children: Snippet<[T]>;
    emptyMessage?: string;
    disabledReason?: string;
  }

  let {
    state,
    children,
    emptyMessage = 'No data available.',
    disabledReason,
  }: Props<unknown> = $props();
</script>

{#if state.status === 'loading'}
  <div class="ui-state ui-state--loading" aria-busy="true">
    <span class="lcars-label">Loading…</span>
    <div class="lcars-scan-line"></div>
  </div>
{:else if state.status === 'empty'}
  <div class="ui-state ui-state--empty">
    <span class="lcars-label">{emptyMessage}</span>
  </div>
{:else if state.status === 'error'}
  <div class="ui-state ui-state--error" role="alert">
    <span class="lcars-label">Error</span>
    <p>{state.message}</p>
  </div>
{:else if state.status === 'permission_denied'}
  <div class="ui-state ui-state--permission-denied" role="alert">
    <span class="lcars-label">Access Denied</span>
    <p>{state.message}</p>
  </div>
{:else if state.status === 'suggest_only'}
  <div class="ui-state ui-state--suggest-only" role="status">
    <span class="lcars-label">Suggest-Only Mode</span>
    <p>{state.message}</p>
  </div>
{:else if state.status === 'disabled'}
  <div class="ui-state ui-state--disabled" aria-disabled="true">
    <span class="lcars-label">Unavailable</span>
    <p>{state.reason}</p>
  </div>
{:else if state.status === 'success'}
  {@render children(state.data)}
{/if}

<style>
  .ui-state {
    padding: var(--space-3) var(--space-4);
    border-left: 3px solid;
  }

  .ui-state--loading {
    border-color: var(--lcars-cyan, #99ccff);
    opacity: 0.7;
  }

  .ui-state--empty {
    border-color: var(--lcars-gold, #ffcc66);
  }

  .ui-state--error {
    border-color: var(--lcars-red, #cc3333);
  }

  .ui-state--permission-denied {
    border-color: var(--lcars-orange, #ff9900);
  }

  .ui-state--suggest-only {
    border-color: var(--lcars-cyan, #99ccff);
  }

  .ui-state--disabled {
    border-color: var(--lcars-gold, #ffcc66);
    opacity: 0.5;
  }

  .ui-state p {
    margin-top: var(--space-1);
    font-size: var(--text-sm, 0.875rem);
  }
</style>
