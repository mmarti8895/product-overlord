import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { createRawSnippet } from 'svelte';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock('../lib/stores/hub', () => ({
  hub: {
    subscribe: writable({ open: false, activeTab: 'llm' }).subscribe,
    open: vi.fn(),
    close: vi.fn(),
    setTab: vi.fn(),
  },
}));

vi.mock('../lib/stores/session', () => {
  const sessionState = writable({
    unlocked: false,
    principal_id: null,
    role: null,
    issued_at: null,
    expires_at: null,
    expired: true,
  });

  return {
    session: {
      subscribe: sessionState.subscribe,
      refresh: vi.fn().mockResolvedValue(undefined),
      onExpired: vi.fn(),
      lock: vi.fn().mockResolvedValue(undefined),
      unlock: vi.fn().mockResolvedValue({ status: 'success', data: {} }),
    },
    effectiveRole: writable('read_only'),
    secondsRemaining: writable(null),
  };
});

vi.mock('../lib/stores/indexHealth', () => {
  const state = writable({ status: 'empty' });
  return {
    indexHealth: {
      subscribe: state.subscribe,
      refresh: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../lib/stores/policy', () => {
  const state = writable({ status: 'success', data: 'read_only' });
  return {
    policyState: {
      subscribe: state.subscribe,
      refresh: vi.fn().mockResolvedValue(undefined),
    },
    rbacEnforced: writable(false),
  };
});

vi.mock('../lib/stores/credentials', () => {
  const state = writable({ status: 'success', data: [] });
  return {
    credentials: {
      subscribe: state.subscribe,
      refresh: vi.fn().mockResolvedValue(undefined),
      checkHealth: vi.fn().mockResolvedValue({ status: 'success' }),
      addCredential: vi.fn().mockResolvedValue({ status: 'success', data: { id: 'c1' } }),
      deleteCredential: vi.fn().mockResolvedValue({ status: 'success' }),
    },
    credentialSummary: writable({ healthy: 0, total: 0 }),
  };
});

vi.mock('../lib/stores/navigation', () => ({
  navigation: {
    activeSurface: writable('command'),
    activate: vi.fn().mockResolvedValue({
      surface: 'command',
      status: 'success',
      message: 'ok',
    }),
  },
}));

vi.mock('../lib/tauri/invoke', () => ({
  loading: () => ({ status: 'loading' as const }),
  empty: () => ({ status: 'empty' as const }),
  success: <T>(data: T) => ({ status: 'success' as const, data }),
  err: (message: string) => ({ status: 'error' as const, message }),
  registerErrorNotifier: vi.fn(),
  invoke: vi.fn().mockResolvedValue({ status: 'empty' }),
}));

import Layout from './+layout.svelte';

const emptySnippet = createRawSnippet(() => ({
  render: () => '<div data-testid="layout-child"></div>',
}));

describe('+layout unlock focus restore', () => {
  it('returns focus to the session button after closing unlock modal', async () => {
    render(Layout, {
      props: {
        children: emptySnippet,
      },
    });

    const sessionButton = document.querySelector('.session-btn') as HTMLButtonElement;
    expect(sessionButton).toBeTruthy();

    sessionButton.focus();
    expect(document.activeElement).toBe(sessionButton);

    await fireEvent.click(sessionButton);

    const cancelButton = await screen.findByRole('button', { name: 'Cancel' });
    await fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Unlock Session' })).toBeNull();
    });
    expect(document.activeElement).toBe(sessionButton);
  });

  it('returns focus to the session button after Escape closes unlock modal', async () => {
    render(Layout, {
      props: {
        children: emptySnippet,
      },
    });

    const sessionButton = document.querySelector('.session-btn') as HTMLButtonElement;
    expect(sessionButton).toBeTruthy();

    sessionButton.focus();
    expect(document.activeElement).toBe(sessionButton);

    await fireEvent.click(sessionButton);

    const dialog = await screen.findByRole('dialog', { name: 'Unlock Session' });
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Unlock Session' })).toBeNull();
    });
    expect(document.activeElement).toBe(sessionButton);
  });
});