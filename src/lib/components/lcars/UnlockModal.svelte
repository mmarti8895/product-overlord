<script lang="ts">
  import { onMount } from 'svelte';
  import { session } from '$lib/stores/session';
  import type { Role } from '$lib/stores/session';

  interface Props {
    onclose: () => void;
  }

  let { onclose }: Props = $props();

  let principalId = $state('');
  let role = $state<Role>('operator');
  let ttl = $state(60);
  let pending = $state(false);
  let errorMsg = $state('');
  let modalEl: HTMLDivElement | null = null;
  let principalInputEl: HTMLInputElement | null = null;

  onMount(() => {
    principalInputEl?.focus();
  });

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
      return;
    }

    if (e.key !== 'Tab' || !modalEl) return;

    const focusables = Array.from(
      modalEl.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (active === first || !modalEl.contains(active)) {
        e.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function submit() {
    if (!principalId.trim()) {
      errorMsg = 'Principal ID is required.';
      return;
    }
    pending = true;
    errorMsg = '';
    const result = await session.unlock(principalId.trim(), role, ttl);
    pending = false;
    if (result.status === 'success') {
      onclose();
    } else if (result.status === 'error' || result.status === 'permission_denied') {
      errorMsg = result.message;
    }
  }
</script>

<div
  class="unlock-overlay"
  role="presentation"
  onclick={(e) => {
    if (e.currentTarget === e.target) onclose();
  }}
  onkeydown={handleOverlayKeydown}
>
  <div
    class="unlock-modal"
    bind:this={modalEl}
    role="dialog"
    aria-modal="true"
    aria-label="Unlock Session"
    tabindex="-1"
  >
    <header>
      <p class="lcars-label">Session Authentication</p>
      <h2>Unlock Session</h2>
    </header>

    <label class="lcars-label" for="principal-id">Principal ID</label>
    <input
      bind:this={principalInputEl}
      id="principal-id"
      type="text"
      bind:value={principalId}
      placeholder="your-username"
      autocomplete="off"
    />

    <label class="lcars-label" for="role-select">Role</label>
    <select id="role-select" bind:value={role}>
      <option value="read_only">Read Only</option>
      <option value="operator">Operator</option>
      <option value="admin">Admin</option>
    </select>

    <label class="lcars-label" for="ttl">Session TTL (minutes)</label>
    <input id="ttl" type="number" bind:value={ttl} min="1" max="480" />

    {#if errorMsg}
      <p class="unlock-modal__error" role="alert">{errorMsg}</p>
    {/if}

    <div class="unlock-modal__actions">
      <button class="lcars-btn" type="button" onclick={submit} disabled={pending}>
        {pending ? 'Authenticating…' : 'Unlock'}
      </button>
      <button class="lcars-btn lcars-btn--secondary" type="button" onclick={onclose}>
        Cancel
      </button>
    </div>
  </div>
</div>

<style>
  .unlock-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .unlock-modal {
    background: var(--color-surface, #1a1a2e);
    border: 1px solid var(--lcars-cyan, #99ccff);
    padding: var(--space-6, 1.5rem);
    min-width: 340px;
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 0.75rem);
  }

  .unlock-modal input,
  .unlock-modal select {
    width: 100%;
    padding: var(--space-2, 0.5rem);
    background: var(--color-bg, #0d0d1a);
    color: var(--color-text-primary, #f6f2d8);
    border: 1px solid var(--lcars-cyan, #99ccff);
  }

  .unlock-modal select {
    padding-right: calc(var(--space-3, 0.75rem) * 2 + 12px);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23ff8a1c' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right var(--space-3, 0.75rem) center;
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }

  .unlock-modal__error {
    color: var(--lcars-red, #cc3333);
    font-size: var(--text-sm, 0.875rem);
  }

  .unlock-modal__actions {
    display: flex;
    gap: var(--space-3, 0.75rem);
    justify-content: flex-end;
  }

  .lcars-btn {
    padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
    background: var(--lcars-cyan, #99ccff);
    color: #000;
    border: none;
    cursor: pointer;
    font-family: inherit;
    font-size: var(--text-sm, 0.875rem);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .lcars-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .lcars-btn--secondary {
    background: transparent;
    color: var(--lcars-cyan, #99ccff);
    border: 1px solid var(--lcars-cyan, #99ccff);
  }
</style>
