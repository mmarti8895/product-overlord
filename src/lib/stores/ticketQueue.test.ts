import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { TicketSummary } from '$lib/providers/ticketQueue';

let ticketsFixture: TicketSummary[] = [
  { key: 'PROJ-1', summary: 'A', priority: 'high', dorCompletionRatio: 0.5 },
  { key: 'PROJ-2', summary: 'B', priority: 'medium', dorCompletionRatio: 0.1 },
];

vi.mock('$lib/providers/ticketQueue', () => ({
  stubTicketProvider: {
    list: vi.fn(async () => ticketsFixture),
  },
}));

import { ticketQueue } from './ticketQueue';

describe('ticketQueue store', () => {
  beforeEach(async () => {
    ticketsFixture = [
      { key: 'PROJ-1', summary: 'A', priority: 'high', dorCompletionRatio: 0.5 },
      { key: 'PROJ-2', summary: 'B', priority: 'medium', dorCompletionRatio: 0.1 },
    ];
    await ticketQueue.refresh();
  });

  it('selects first ticket by default on refresh', async () => {
    ticketQueue.select('PROJ-2');
    // force no selected key to simulate cold workflow open
    ticketQueue.activeKey.set(null);

    await ticketQueue.refresh();

    expect(get(ticketQueue.activeKey)).toBe('PROJ-1');
  });

  it('preserves selected ticket when it still exists', async () => {
    ticketQueue.select('PROJ-2');
    await ticketQueue.refresh();

    expect(get(ticketQueue.activeKey)).toBe('PROJ-2');
  });

  it('falls back to first ticket when previous selection no longer exists', async () => {
    ticketQueue.select('PROJ-2');
    ticketsFixture = [{ key: 'PROJ-9', summary: 'C', priority: 'critical', dorCompletionRatio: 0.8 }];

    await ticketQueue.refresh();

    expect(get(ticketQueue.activeKey)).toBe('PROJ-9');
  });

  it('ignores select requests for unknown ticket keys', async () => {
    const before = get(ticketQueue.activeKey);

    ticketQueue.select('UNKNOWN-1');

    expect(get(ticketQueue.activeKey)).toBe(before);
  });
});
