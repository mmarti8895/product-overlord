import { writable, get } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';

// ─── Types mirroring Rust IndexStoreHealth ───────────────────────────────────

export type IndexReachability = 'reachable' | 'not_reachable' | 'not_configured' | 'not_initialized';

export interface IndexStoreHealth {
  db_uri: string;
  initialized: boolean;
  reachable: boolean;
  last_checked_at: string;
  last_error: string | null;
}

export interface IndexHealthView {
  reachability: IndexReachability;
  path: string | null;
  last_initialized_at: string | null;
  last_error: string | null;
}

function toView(raw: IndexStoreHealth): IndexHealthView {
  let reachability: IndexReachability;
  if (!raw.db_uri) {
    reachability = 'not_configured';
  } else if (!raw.initialized) {
    reachability = 'not_initialized';
  } else if (raw.reachable) {
    reachability = 'reachable';
  } else {
    reachability = 'not_reachable';
  }

  return {
    reachability,
    path: raw.db_uri || null,
    last_initialized_at: raw.initialized ? raw.last_checked_at : null,
    last_error: raw.last_error ?? null,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createIndexHealthStore() {
  const { subscribe, set } = writable<UIState<IndexHealthView>>(loading());

  async function refresh() {
    set(loading());
    const result = await invoke<IndexStoreHealth>('cmd_get_index_store_health');
    if (result.status === 'success') {
      set(success(toView(result.data)));
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

export const indexHealth = createIndexHealthStore();
