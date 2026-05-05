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

vi.mock('$lib/stores/ticketQueue', () => {
  const subscribe = (run: (value: string | null) => void) => {
    run(null);
    return () => {};
  };
  return {
    ticketQueue: {
      activeKey: { subscribe },
    },
  };
});

import { dorStore } from './dor';

describe('dor store scaffolds workflow', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('create() updates current scaffold from confirmed backend response', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'cmd_create_ticket_scaffold') {
        return {
          status: 'success',
          data: {
            ticket_key: 'PROJ-77',
            definition_of_ready: [],
            acceptance_criteria: [],
            effort_estimate: null,
            updated_at: '2026-05-04T00:00:00Z',
          },
        };
      }
      if (command === 'cmd_list_ticket_scaffolds') {
        return { status: 'success', data: [] };
      }
      return { status: 'error', message: `unexpected ${command}` };
    });

    const result = await dorStore.create('PROJ-77');
    expect(result.status).toBe('success');

    const state = get(dorStore.scaffold);
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      expect(state.data.ticketKey).toBe('PROJ-77');
    }
  });

  it('setAcceptanceCriteria() refreshes scaffold with sanitized content from backend', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'cmd_set_acceptance_criteria') {
        return {
          status: 'success',
          data: {
            ticket_key: 'PROJ-88',
            definition_of_ready: [],
            acceptance_criteria: ['<b>must pass</b>'],
            effort_estimate: null,
            updated_at: '2026-05-04T00:00:00Z',
          },
        };
      }
      if (command === 'cmd_list_ticket_scaffolds') {
        return { status: 'success', data: [] };
      }
      return { status: 'error', message: `unexpected ${command}` };
    });

    const result = await dorStore.setAcceptanceCriteria('PROJ-88', ['must pass']);
    expect(result.status).toBe('success');

    const state = get(dorStore.scaffold);
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      expect(state.data.acceptanceCriteria[0]).toBe('must pass');
    }
  });
});
