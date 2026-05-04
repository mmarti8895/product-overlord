import { writable, derived, get } from 'svelte/store';
import { invoke, type UIState, loading, success, err, empty } from '$lib/tauri/invoke';
import { ticketQueue } from '$lib/stores/ticketQueue';

// ─── Types mirroring Rust domain ─────────────────────────────────────────────

export interface DorChecklistItem {
  id: string;
  title: string;
  required: boolean;
  done: boolean;
}

export interface TicketScaffold {
  ticket_key: string;
  definition_of_ready: DorChecklistItem[];
  acceptance_criteria: string[];
  effort_estimate: unknown | null;
  updated_at: string;
}

// ─── DoR tri-state ─────────────────────────────────────────────────────────

/**
 * Domain invariant:
 *   Complete  = item.done is explicitly true AND field is present
 *   Incomplete = item.done is explicitly false AND field is present
 *   Unknown   = field absent, null, or data missing — NEVER assumed Complete
 */
export type DorItemState = 'complete' | 'incomplete' | 'unknown';

export interface DorItemView {
  id: string;
  title: string;
  required: boolean;
  state: DorItemState;
}

export interface ScaffoldView {
  ticketKey: string;
  dorItems: DorItemView[];
  acceptanceCriteria: string[];
  /** Ratio of required items in Complete state. */
  completionRatio: number;
}

function toDorState(item: DorChecklistItem): DorItemState {
  // title is the presence indicator — an empty title means malformed data → Unknown.
  if (!item.title || item.title.trim() === '') return 'unknown';
  if (item.done === true) return 'complete';
  if (item.done === false) return 'incomplete';
  return 'unknown';
}

function sanitise(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function toScaffoldView(raw: TicketScaffold): ScaffoldView {
  const dorItems: DorItemView[] = raw.definition_of_ready.map((item) => ({
    id: item.id,
    title: sanitise(item.title),
    required: item.required,
    state: toDorState(item),
  }));

  const required = dorItems.filter((i) => i.required);
  const completionRatio =
    required.length === 0
      ? 1
      : required.filter((i) => i.state === 'complete').length / required.length;

  return {
    ticketKey: raw.ticket_key,
    dorItems,
    acceptanceCriteria: raw.acceptance_criteria.map(sanitise),
    completionRatio,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createDorStore() {
  const scaffold = writable<UIState<ScaffoldView>>(empty());

  async function load(ticketKey: string) {
    scaffold.set(loading());
    const result = await invoke<TicketScaffold | null>('cmd_get_ticket_scaffold', {
      ticket_key: ticketKey,
    });
    if (result.status === 'success') {
      if (result.data === null) {
        scaffold.set(empty());
      } else {
        scaffold.set(success(toScaffoldView(result.data)));
      }
    } else if (result.status === 'error') {
      scaffold.set(err(result.message));
    } else if (result.status === 'permission_denied') {
      scaffold.set({ status: 'permission_denied', message: result.message });
    } else {
      scaffold.set(empty());
    }
  }

  async function setItemStatus(ticketKey: string, itemId: string, done: boolean) {
    const result = await invoke<TicketScaffold>('cmd_set_dor_item_status', {
      ticket_key: ticketKey,
      item_id: itemId,
      done,
    });
    // Update only on confirmed backend response — no optimistic update.
    if (result.status === 'success') {
      scaffold.set(success(toScaffoldView(result.data)));
    }
    return result;
  }

  return { scaffold, load, setItemStatus };
}

export const dorStore = createDorStore();

// Auto-load scaffold when active ticket changes.
ticketQueue.activeKey.subscribe((key) => {
  if (key !== null) {
    dorStore.load(key);
  } else {
    dorStore.scaffold.set(empty());
  }
});
