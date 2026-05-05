import { describe, expect, it } from 'vitest';
import { createOpsVerifierStore } from './opsVerifier';

describe('opsVerifier', () => {
  it('reports success when surfaces, routines, and admin superset checks pass', async () => {
    const calls: string[] = [];
    const store = createOpsVerifierStore({
      activate: async (surface) => {
        calls.push(`activate:${surface}`);
        return { status: 'success', message: 'ok' };
      },
      runDailyReview: async () => ({
        routine: 'daily_review',
        startedAt: '2026-05-04T00:00:00Z',
        completedAt: '2026-05-04T00:00:01Z',
        status: 'success',
        steps: [],
      }),
      runPlanningReadiness: async () => ({
        routine: 'planning_readiness',
        startedAt: '2026-05-04T00:00:02Z',
        completedAt: '2026-05-04T00:00:03Z',
        status: 'success',
        steps: [],
      }),
      adminHasPermission: () => true,
      operatorPermissions: () => new Set(['invoke_llm', 'request_ticket_review']),
    });

    const run = await store.runVerification();

    expect(run.status).toBe('success');
    expect(run.steps.map((s) => s.name)).toEqual([
      'surface:command',
      'surface:tickets',
      'surface:scaffolds',
      'surface:audit',
      'surface:integrations',
      'surface:command',
      'routine:daily_review',
      'routine:planning_readiness',
      'admin_superset',
    ]);
    expect(calls).toEqual([
      'activate:command',
      'activate:tickets',
      'activate:scaffolds',
      'activate:audit',
      'activate:integrations',
      'activate:command',
    ]);
  });

  it('reports degraded/error for denied surfaces and admin superset regressions', async () => {
    const store = createOpsVerifierStore({
      activate: async (surface) => {
        if (surface === 'audit') return { status: 'permission_denied', message: 'denied' };
        return { status: 'success', message: 'ok' };
      },
      runDailyReview: async () => ({
        routine: 'daily_review',
        startedAt: '2026-05-04T00:00:00Z',
        completedAt: '2026-05-04T00:00:01Z',
        status: 'degraded',
        steps: [],
      }),
      runPlanningReadiness: async () => ({
        routine: 'planning_readiness',
        startedAt: '2026-05-04T00:00:02Z',
        completedAt: '2026-05-04T00:00:03Z',
        status: 'success',
        steps: [],
      }),
      adminHasPermission: (permission) => permission !== 'request_ticket_review',
      operatorPermissions: () => new Set(['invoke_llm', 'request_ticket_review']),
    });

    const run = await store.runVerification();

    expect(run.status).toBe('error');
    expect(run.steps.find((s) => s.name === 'surface:audit')?.status).toBe('degraded');
    expect(run.steps.find((s) => s.name === 'admin_superset')?.status).toBe('error');
  });
});
