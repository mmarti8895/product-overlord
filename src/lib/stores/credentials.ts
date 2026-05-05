import { writable, derived } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';

// ─── Types mirroring Rust domain ─────────────────────────────────────────────

export type Provider =
  | 'jira'
  | 'git_hub'
  | 'open_ai'
  | 'anthropic'
  | 'ollama'
  | 'gemini'
  | 'atlassian_rovo';

export interface IntegrationCredential {
  id: string;
  provider: Provider;
  label: string;
  base_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CredentialHealthStatus = 'healthy' | 'invalid' | 'missing' | 'unchecked';

export interface CredentialView {
  credential: IntegrationCredential;
  health: CredentialHealthStatus;
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createCredentialStore() {
  const { subscribe, set, update } = writable<UIState<CredentialView[]>>(loading());

  async function refresh() {
    set(loading());
    const result = await invoke<IntegrationCredential[]>('cmd_list_credentials');
    if (result.status === 'success') {
      const views: CredentialView[] = result.data.map((c) => ({
        credential: c,
        health: 'unchecked',
      }));
      set(views.length > 0 ? success(views) : empty());
    } else if (result.status === 'error') {
      set(err(result.message));
    } else if (result.status === 'permission_denied') {
      set({ status: 'permission_denied', message: result.message });
    } else {
      set(empty());
    }
  }

  async function checkHealth(id: string) {
    const result = await invoke<boolean>('cmd_check_credential_health', { id });
    if (result.status === 'success') {
      update((state) => {
        if (state.status !== 'success') return state;
        return success(
          state.data.map((v) =>
            v.credential.id === id
              ? { ...v, health: result.data ? 'healthy' : 'invalid' }
              : v,
          ),
        );
      });
    }
  }

  async function deleteCredential(id: string) {
    const result = await invoke<void>('cmd_delete_credential', { id });
    if (result.status === 'success') {
      update((state) => {
        if (state.status !== 'success') return state;
        const remaining = state.data.filter((v) => v.credential.id !== id);
        return remaining.length > 0 ? success(remaining) : empty();
      });
    }
    return result;
  }

  async function addCredential(
    provider: Provider,
    label: string,
    secret: string,
    baseUrl?: string,
  ) {
    const result = await invoke<IntegrationCredential>('cmd_add_credential', {
      provider,
      label,
      secret,
      base_url: baseUrl ?? null,
    });
    if (result.status === 'success') {
      update((state) => {
        const newView: CredentialView = { credential: result.data, health: 'unchecked' };
        if (state.status === 'success') {
          return success([...state.data, newView]);
        }
        return success([newView]);
      });
    }
    return result;
  }

  return { subscribe, refresh, checkHealth, deleteCredential, addCredential };
}

export const credentials = createCredentialStore();

// Derived: summary count for the telemetry card.
export const credentialSummary = derived(credentials, ($c) => {
  if ($c.status !== 'success') return { total: 0, healthy: 0 };
  const total = $c.data.length;
  const healthy = $c.data.filter((v) => v.health === 'healthy').length;
  return { total, healthy };
});
