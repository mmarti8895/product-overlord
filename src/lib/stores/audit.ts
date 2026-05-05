import { writable } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';

export interface AuditIntegrityReport {
  ok: boolean;
  total_entries: number;
  chained_entries: number;
  first_invalid_line: number | null;
  reason: string | null;
}

export interface AuditVerificationEvent {
  checkedAt: string;
  status: 'ok' | 'degraded' | 'error' | 'permission_denied';
  summary: string;
}

const TIMELINE_LIMIT = 20;

function createAuditStore() {
  const report = writable<UIState<AuditIntegrityReport>>(empty());
  const timeline = writable<AuditVerificationEvent[]>([]);

  function pushEvent(event: AuditVerificationEvent) {
    timeline.update((items) => [event, ...items].slice(0, TIMELINE_LIMIT));
  }

  async function verify() {
    report.set(loading());
    const result = await invoke<AuditIntegrityReport>('cmd_verify_audit_integrity');

    if (result.status === 'success') {
      report.set(success(result.data));
      pushEvent({
        checkedAt: new Date().toISOString(),
        status: result.data.ok ? 'ok' : 'degraded',
        summary: result.data.ok
          ? `Integrity verified (${result.data.chained_entries}/${result.data.total_entries} chained).`
          : `Integrity degraded: ${result.data.reason ?? 'unknown reason'}`,
      });
    } else if (result.status === 'permission_denied') {
      report.set({ status: 'permission_denied', message: result.message });
      pushEvent({
        checkedAt: new Date().toISOString(),
        status: 'permission_denied',
        summary: result.message,
      });
    } else if (result.status === 'error') {
      report.set(err(result.message));
      pushEvent({
        checkedAt: new Date().toISOString(),
        status: 'error',
        summary: result.message,
      });
    } else {
      report.set(empty());
    }

    return result;
  }

  return { report, timeline, verify };
}

export const auditStore = createAuditStore();
