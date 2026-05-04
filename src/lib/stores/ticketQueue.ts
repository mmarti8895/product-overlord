import { writable, get } from 'svelte/store';
import { stubTicketProvider } from '$lib/providers/ticketQueue';
import type { TicketSummary } from '$lib/providers/ticketQueue';
import { type UIState, loading, success, err, empty } from '$lib/tauri/invoke';

// ─── Store ────────────────────────────────────────────────────────────────────

function createTicketQueueStore() {
  const list = writable<UIState<TicketSummary[]>>(loading());
  const activeKey = writable<string | null>(null);

  async function refresh() {
    list.set(loading());
    try {
      const tickets = await stubTicketProvider.list();
      if (tickets.length === 0) {
        list.set(empty());
        activeKey.set(null);
      } else {
        list.set(success(tickets));
        // Select first ticket by default if nothing is selected.
        if (get(activeKey) === null) {
          activeKey.set(tickets[0].key);
        }
      }
    } catch (e) {
      list.set(err(String(e)));
    }
  }

  function select(key: string) {
    activeKey.set(key);
  }

  return { list, activeKey, refresh, select };
}

export const ticketQueue = createTicketQueueStore();
