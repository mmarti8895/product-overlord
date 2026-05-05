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
        const selected = get(activeKey);
        const selectedIsStillPresent = selected !== null && tickets.some((t) => t.key === selected);
        // Queue-first deterministic fallback: if prior selection is missing, select first.
        activeKey.set(selectedIsStillPresent ? selected : tickets[0].key);
      }
    } catch (e) {
      list.set(err(String(e)));
    }
  }

  function select(key: string) {
    const state = get(list);
    if (state.status !== 'success') return;
    if (!state.data.some((t) => t.key === key)) return;
    activeKey.set(key);
  }

  return { list, activeKey, refresh, select };
}

export const ticketQueue = createTicketQueueStore();
