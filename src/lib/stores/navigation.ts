import { get, writable } from 'svelte/store';
import { hub, type HubTab } from '$lib/stores/hub';
import { ticketQueue } from '$lib/stores/ticketQueue';
import { credentials } from '$lib/stores/credentials';
import { indexHealth } from '$lib/stores/indexHealth';
import { policyState } from '$lib/stores/policy';
import { auditStore } from '$lib/stores/audit';

export type ShellSurface = 'command' | 'tickets' | 'scaffolds' | 'integrations' | 'audit';

export interface ActivationResult {
  surface: ShellSurface;
  status: 'success' | 'error' | 'permission_denied';
  message: string;
}

function createNavigationCoordinator() {
  const activeSurface = writable<ShellSurface>('command');
  const lastActivation = writable<ActivationResult | null>(null);

  async function activate(surface: ShellSurface): Promise<ActivationResult> {
    activeSurface.set(surface);

    switch (surface) {
      case 'command': {
        hub.close();
        await Promise.all([indexHealth.refresh(), policyState.refresh(), credentials.refresh()]);
        const result = {
          surface,
          status: 'success' as const,
          message: 'Command deck refreshed.',
        };
        lastActivation.set(result);
        return result;
      }

      case 'tickets': {
        hub.close();
        await ticketQueue.refresh();
        const result = {
          surface,
          status: 'success' as const,
          message: 'Ticket queue loaded.',
        };
        lastActivation.set(result);
        return result;
      }

      case 'scaffolds': {
        hub.close();
        if (get(ticketQueue.list).status !== 'success') {
          await ticketQueue.refresh();
        }
        const result = {
          surface,
          status: 'success' as const,
          message: 'Scaffold workspace prepared.',
        };
        lastActivation.set(result);
        return result;
      }

      case 'integrations': {
        const defaultTab: HubTab = 'llm';
        hub.open(defaultTab);
        const result = {
          surface,
          status: 'success' as const,
          message: 'Integration hub opened.',
        };
        lastActivation.set(result);
        return result;
      }

      case 'audit': {
        hub.close();
        const report = await auditStore.verify();
        if (report.status === 'success') {
          const message = report.data.ok
            ? `Audit integrity verified (${report.data.chained_entries}/${report.data.total_entries} chained entries).`
            : `Audit integrity degraded: ${report.data.reason ?? 'unknown reason'}`;
          const result = { surface, status: 'success' as const, message };
          lastActivation.set(result);
          return result;
        }

        const result = {
          surface,
          status: report.status === 'permission_denied' ? ('permission_denied' as const) : ('error' as const),
          message: report.status === 'permission_denied' || report.status === 'error'
            ? report.message
            : 'Unable to verify audit integrity.',
        };
        lastActivation.set(result);
        return result;
      }
    }
  }

  return { activeSurface, lastActivation, activate };
}

export const navigation = createNavigationCoordinator();
