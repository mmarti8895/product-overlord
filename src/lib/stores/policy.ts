import { writable, derived, get } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';
import { effectiveRole } from '$lib/stores/session';
import type { Role } from '$lib/stores/session';

// ─── Store ────────────────────────────────────────────────────────────────────

function createPolicyStore() {
  const { subscribe, set } = writable<UIState<Role>>(loading());

  async function refresh() {
    set(loading());
    const result = await invoke<Role>('cmd_get_current_role');
    if (result.status === 'success') {
      const role = result.data;
      set(success(role));
    } else if (result.status === 'error') {
      set(err(result.message));
    } else if (result.status === 'permission_denied') {
      set({ status: 'permission_denied', message: result.message });
    } else {
      set(empty());
    }
  }

  return { subscribe, refresh };
}

export const policyState = createPolicyStore();

// Derived: is RBAC enforced (session unlocked and role confirmed from backend)?
export const rbacEnforced = derived(
  [policyState, effectiveRole],
  ([$policy, $role]) => $policy.status === 'success' && $role !== 'read_only',
);
