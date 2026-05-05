import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const { unlockMock } = vi.hoisted(() => ({
  unlockMock: vi.fn().mockResolvedValue({ status: 'success' as const, data: {} }),
}));

vi.mock('$lib/stores/session', () => ({
  session: {
    unlock: unlockMock,
  },
}));

import UnlockModal from './UnlockModal.svelte';

function keydown(target: EventTarget, key: string, shiftKey = false) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true }));
}

describe('UnlockModal focus behavior', () => {
  it('focuses principal id on mount', async () => {
    render(UnlockModal, { props: { onclose: vi.fn() } });

    const principal = document.getElementById('principal-id') as HTMLInputElement | null;
    expect(principal).toBeTruthy();
    expect(document.activeElement).toBe(principal);
  });

  it('traps forward tab from last focusable back to first', async () => {
    render(UnlockModal, { props: { onclose: vi.fn() } });

    const principal = document.getElementById('principal-id') as HTMLInputElement;
    const cancel = document.querySelector('.unlock-modal__actions button:last-child') as HTMLButtonElement;
    expect(principal).toBeTruthy();
    expect(cancel).toBeTruthy();

    cancel.focus();
    keydown(cancel, 'Tab');

    expect(document.activeElement).toBe(principal);
  });

  it('traps reverse tab from first focusable to last', async () => {
    render(UnlockModal, { props: { onclose: vi.fn() } });

    const principal = document.getElementById('principal-id') as HTMLInputElement;
    const cancel = document.querySelector('.unlock-modal__actions button:last-child') as HTMLButtonElement;

    principal.focus();
    keydown(principal, 'Tab', true);

    expect(document.activeElement).toBe(cancel);
  });

  it('invokes onclose on Escape', async () => {
    const onclose = vi.fn();
    render(UnlockModal, { props: { onclose } });

    const principal = document.getElementById('principal-id') as HTMLInputElement;
    keydown(principal, 'Escape');

    expect(onclose).toHaveBeenCalledTimes(1);
  });
});
