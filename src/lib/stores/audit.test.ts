import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('$lib/tauri/invoke', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  loading: () => ({ status: 'loading' as const }),
  empty: () => ({ status: 'empty' as const }),
  success: <T>(data: T) => ({ status: 'success' as const, data }),
  err: (message: string) => ({ status: 'error' as const, message }),
}));

import { auditStore } from './audit';

describe('auditStore', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('verify stores success report and timeline event', async () => {
    invokeMock.mockResolvedValueOnce({
      status: 'success',
      data: {
        ok: true,
        total_entries: 5,
        chained_entries: 5,
        first_invalid_line: null,
        reason: null,
      },
    });

    const result = await auditStore.verify();
    expect(result.status).toBe('success');

    const state = get(auditStore.report);
    expect(state.status).toBe('success');

    const timeline = get(auditStore.timeline);
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline[0].status).toBe('ok');
  });

  it('verify stores degraded event when report is not ok', async () => {
    invokeMock.mockResolvedValueOnce({
      status: 'success',
      data: {
        ok: false,
        total_entries: 8,
        chained_entries: 7,
        first_invalid_line: 6,
        reason: 'hash mismatch',
      },
    });

    await auditStore.verify();

    const timeline = get(auditStore.timeline);
    expect(timeline[0].status).toBe('degraded');
    expect(timeline[0].summary).toContain('hash mismatch');
  });
});
