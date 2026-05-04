<script lang="ts">
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

<!-- svelte-ignore a11y_click_outside -->
<div class="unlock-overlay" role="dialog" aria-modal="true" aria-label="Unlock Session">
  <div class="unlock-modal">
    <header>
      <p class="lcars-label">Session Authentication</p>
      <h2>Unlock Session</h2>
    </header>

    <label class="lcars-label" for="principal-id">Principal ID</label>
    <input
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
    color: inherit;
    border: 1px solid var(--lcars-cyan, #99ccff);
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
