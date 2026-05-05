import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const invokeMock = vi.fn();

vi.mock('$lib/tauri/invoke', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
  loading: () => ({ status: 'loading' as const }),
  empty: () => ({ status: 'empty' as const }),
  success: <T>(data: T) => ({ status: 'success' as const, data }),
  err: (message: string) => ({ status: 'error' as const, message }),
}));

import { credentials } from './credentials';

describe('credentials store', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('stores metadata only after addCredential and never leaks secret to state', async () => {
    const secret = 'llm-super-secret-token';

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'cmd_add_credential') {
        return {
          status: 'success',
          data: {
            id: 'cred-1',
            provider: 'open_ai',
            label: 'prod-openai',
            base_url: 'https://api.openai.com',
            created_at: '2026-05-04T00:00:00Z',
            updated_at: '2026-05-04T00:00:00Z',
          },
        };
      }
      return { status: 'error', message: `unexpected command ${command}` };
    });

    const result = await credentials.addCredential(
      'open_ai',
      'prod-openai',
      secret,
      'https://api.openai.com',
    );

    expect(result.status).toBe('success');

    const state = get(credentials);
    expect(state.status).toBe('success');
    expect(JSON.stringify(state)).not.toContain(secret);
    expect(state.status === 'success' && state.data[0].credential.label).toBe('prod-openai');
  });

  it('updates health state deterministically when checkHealth succeeds', async () => {
    invokeMock.mockImplementation(async (command: string, args?: Record<string, unknown>) => {
      if (command === 'cmd_add_credential') {
        return {
          status: 'success',
          data: {
            id: 'cred-health',
            provider: 'open_ai',
            label: 'health-check',
            base_url: null,
            created_at: '2026-05-04T00:00:00Z',
            updated_at: '2026-05-04T00:00:00Z',
          },
        };
      }
      if (command === 'cmd_check_credential_health') {
        return { status: 'success', data: args?.id === 'cred-health' };
      }
      return { status: 'error', message: `unexpected command ${command}` };
    });

    await credentials.addCredential('open_ai', 'health-check', 'token');
    await credentials.checkHealth('cred-health');

    const state = get(credentials);
    expect(state.status).toBe('success');
    if (state.status === 'success') {
      const item = state.data.find((v) => v.credential.id === 'cred-health');
      expect(item?.health).toBe('healthy');
    }
  });
});
