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

// ─── Role → Permission mapping (mirrors Rust authz logic) ────────────────────

const ROLE_PERMISSIONS: Record<Role, Set<string>> = {
  read_only: new Set([
    'view_credential_list',
    'check_credential_health',
    'view_notification_rules',
    'view_repository_index',
    'view_jira_tickets',
    'view_audit_log',
    'view_system_config',
  ]),
  operator: new Set([
    'view_credential_list',
    'add_credential',
    'delete_credential',
    'check_credential_health',
    'view_notification_rules',
    'manage_notification_rules',
    'view_repository_index',
    'trigger_repository_index',
    'view_jira_tickets',
    'request_ticket_review',
    'configure_llm_provider',
    'invoke_llm',
    'view_audit_log',
    'view_system_config',
  ]),
  admin: new Set([
    'view_credential_list',
    'add_credential',
    'delete_credential',
    'check_credential_health',
    'view_notification_rules',
    'manage_notification_rules',
    'view_repository_index',
    'trigger_repository_index',
    'view_jira_tickets',
    'request_ticket_review',
    'configure_llm_provider',
    'invoke_llm',
    'view_audit_log',
    'export_audit_log',
    'assign_roles',
    'view_system_config',
    'change_system_config',
  ]),
};

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
      principal_id: principalId,
      role,
      ttl_minutes: ttlMinutes ?? 60,
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

export function hasPermission(role: Role, permission: string): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
