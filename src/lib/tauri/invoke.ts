import { invoke as tauriInvoke } from '@tauri-apps/api/core';

// ─── State shape ─────────────────────────────────────────────────────────────

export type Loading = { status: 'loading' };
export type Empty = { status: 'empty' };
export type Success<T> = { status: 'success'; data: T };
export type Err = { status: 'error'; message: string };
export type PermissionDenied = { status: 'permission_denied'; message: string };
export type SuggestOnly = { status: 'suggest_only'; message: string };
export type Disabled = { status: 'disabled'; reason: string };

export type UIState<T> =
  | Loading
  | Empty
  | Success<T>
  | Err
  | PermissionDenied
  | SuggestOnly
  | Disabled;

export const loading = (): Loading => ({ status: 'loading' });
export const empty = (): Empty => ({ status: 'empty' });
export const success = <T>(data: T): Success<T> => ({ status: 'success', data });
export const err = (message: string): Err => ({ status: 'error', message });
export const permissionDenied = (message: string): PermissionDenied => ({
  status: 'permission_denied',
  message,
});
export const suggestOnly = (message: string): SuggestOnly => ({
  status: 'suggest_only',
  message,
});
export const disabled = (reason: string): Disabled => ({ status: 'disabled', reason });

// ─── Suggest-only write commands (blocked in Phase 1) ────────────────────────

const SUGGEST_ONLY_COMMANDS = new Set<string>([
  'cmd_write_jira_ticket',
  'cmd_update_jira_ticket',
  'cmd_post_jira_comment',
]);

// ─── Error classifier ────────────────────────────────────────────────────────

function classifyError(raw: unknown): Err | PermissionDenied | SuggestOnly {
  const msg = typeof raw === 'string' ? raw : String(raw);
  if (msg.startsWith('permission denied:')) {
    return permissionDenied(msg);
  }
  return err(msg);
}

// ─── Notification callback (set by Permission Error Handler) ─────────────────

type ErrorNotifier = (state: PermissionDenied | SuggestOnly | Err) => void;
let _notifier: ErrorNotifier | null = null;

export function registerErrorNotifier(fn: ErrorNotifier): void {
  _notifier = fn;
}

function notify(state: PermissionDenied | SuggestOnly | Err): void {
  _notifier?.(state);
}

// ─── Session-expired callback (set by Session Store) ─────────────────────────

type ExpiredCallback = () => void;
let _onExpired: ExpiredCallback | null = null;

export function registerExpiredCallback(fn: ExpiredCallback): void {
  _onExpired = fn;
}

// ─── Core invoke wrapper ──────────────────────────────────────────────────────

export async function invoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<UIState<T>> {
  // Structural suggest-only enforcement — blocked before reaching Rust.
  if (SUGGEST_ONLY_COMMANDS.has(command)) {
    const s = suggestOnly(
      `'${command}' is not permitted in suggest-only mode (Phase 1). No changes were made.`,
    );
    notify(s);
    return s;
  }

  try {
    const data = await tauriInvoke<T>(command, args ?? {});
    return success(data);
  } catch (raw) {
    const msg = typeof raw === 'string' ? raw : String(raw);

    // Session expiry detected via backend message pattern.
    if (msg.includes('session') && (msg.includes('expired') || msg.includes('locked'))) {
      _onExpired?.();
      const s = permissionDenied('Your session has expired. Please unlock to continue.');
      notify(s);
      return s;
    }

    const classified = classifyError(raw);
    notify(classified);
    return classified;
  }
}
