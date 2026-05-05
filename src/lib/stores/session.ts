import { writable, derived, get } from 'svelte/store';
import { invoke, registerExpiredCallback } from '$lib/tauri/invoke';
import type { Success } from '$lib/tauri/invoke';

// ─── Types mirroring Rust SessionStatus ──────────────────────────────────────

export type Role = 'read_only' | 'operator' | 'admin';

export interface SessionStatus {
  unlocked: boolean;
  principal_id: string | null;
  role: Role | null;
  issued_at: string | null;
  expires_at: string | null;
  expired: boolean;
}

// ─── Locked state sentinel ────────────────────────────────────────────────────

const LOCKED_STATUS: SessionStatus = {
  unlocked: false,
  principal_id: null,
  role: null,
  issued_at: null,
  expires_at: null,
  expired: true,
};

// ─── Store ────────────────────────────────────────────────────────────────────

function createSessionStore() {
  const { subscribe, set } = writable<SessionStatus>(LOCKED_STATUS);

  // TTL ticker — updates every second while session is active.
  let ticker: ReturnType<typeof setInterval> | null = null;

  function stopTicker() {
    if (ticker !== null) {
      clearInterval(ticker);
      ticker = null;
    }
  }

  function startTicker() {
    stopTicker();
    ticker = setInterval(() => {
      const current = get({ subscribe });
      if (!current.unlocked || !current.expires_at) {
        stopTicker();
        return;
      }
      if (new Date() >= new Date(current.expires_at)) {
        // Session expired client-side: lock the store.
        set(LOCKED_STATUS);
        stopTicker();
        _expiredListeners.forEach((fn) => fn());
      }
    }, 1000);
  }

  // ─── Expired listeners ──────────────────────────────────────────────────

  const _expiredListeners: Array<() => void> = [];

  function onExpired(fn: () => void) {
    _expiredListeners.push(fn);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────

  async function refresh() {
    const result = await invoke<SessionStatus>('cmd_get_session_status');
    if (result.status === 'success') {
      set(result.data);
      if (result.data.unlocked && !result.data.expired) {
        startTicker();
      }
    }
  }

  async function unlock(principalId: string, role: Role, ttlMinutes?: number) {
    const result = await invoke<SessionStatus>('cmd_unlock_session', {
      principalId,
      role,
      ttlMinutes: ttlMinutes ?? 60,
    });
    if (result.status === 'success') {
      set(result.data);
      startTicker();
    }
    return result;
  }

  async function lock() {
    const result = await invoke<SessionStatus>('cmd_lock_session');
    set(LOCKED_STATUS);
    stopTicker();
    return result;
  }

  return { subscribe, refresh, unlock, lock, onExpired };
}

export const session = createSessionStore();

// Wire session-expired callback into the invoke helper.
registerExpiredCallback(() => {
  // Force lock state into the store when backend signals expiry.
  session.lock();
});

// ─── Derived helpers ──────────────────────────────────────────────────────────

export const effectiveRole = derived(
  session,
  ($s): Role => ($s.unlocked && !$s.expired ? ($s.role ?? 'read_only') : 'read_only'),
);

export const secondsRemaining = derived(session, ($s): number | null => {
  if (!$s.unlocked || !$s.expires_at) return null;
  const diff = Math.floor((new Date($s.expires_at).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
});
