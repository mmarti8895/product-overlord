import { describe, expect, it, vi } from 'vitest';
import { createRoutineStore } from './routines';

describe('routines store', () => {
  it('daily review executes deterministic step order', async () => {
    const calls: string[] = [];

    const store = createRoutineStore({
      activate: async (surface) => {
        calls.push(`activate:${surface}`);
        return { surface, status: 'success', message: `${surface} ok` };
      },
      getActiveTicket: () => 'PROJ-101',
      loadScaffold: async (ticket) => {
        calls.push(`loadScaffold:${ticket}`);
      },
      getScaffoldState: () => ({ status: 'success', data: { ticketKey: 'PROJ-101' } } as any),
      createScaffold: async () => ({ status: 'success', data: {} }),
      listScaffolds: async () => {
        calls.push('listScaffolds');
      },
      refreshCredentials: async () => {
        calls.push('refreshCredentials');
      },
      getCredentialsState: () => ({
        status: 'success',
        data: [
          { credential: { id: 'c1' } },
          { credential: { id: 'c2' } },
        ],
      } as any),
      checkCredentialHealth: async (id) => {
        calls.push(`checkHealth:${id}`);
      },
    });

    const run = await store.runDailyReview();

    expect(run.status).toBe('success');
    expect(run.steps.map((s) => s.name)).toEqual([
      'open_ticket_queue',
      'ensure_scaffold_exists',
      'refresh_scaffold_index',
      'integration_health_snapshot',
      'return_to_command_deck',
    ]);

    expect(calls).toEqual([
      'activate:tickets',
      'loadScaffold:PROJ-101',
      'listScaffolds',
      'refreshCredentials',
      'checkHealth:c1',
      'checkHealth:c2',
      'activate:command',
    ]);
  });

  it('planning readiness reports permission_denied when audit checkpoint is denied', async () => {
    const store = createRoutineStore({
      activate: async (surface) => {
        if (surface === 'audit') {
          return { surface, status: 'permission_denied', message: 'denied' };
        }
        return { surface, status: 'success', message: `${surface} ok` };
      },
      getActiveTicket: () => null,
      loadScaffold: async () => {},
      getScaffoldState: () => ({ status: 'empty' } as any),
      createScaffold: async () => ({ status: 'success', data: {} }),
      listScaffolds: async () => {},
      refreshCredentials: async () => {},
      getCredentialsState: () => ({ status: 'empty' } as any),
      checkCredentialHealth: async () => {},
    });

    const run = await store.runPlanningReadiness();

    expect(run.status).toBe('permission_denied');
    const checkpoint = run.steps.find((s) => s.name === 'audit_checkpoint');
    expect(checkpoint?.status).toBe('permission_denied');
  });
});
