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
  effort_estimate: EffortEstimate | null;
  updated_at: string;
}

export type EffortBand = 'trivial' | 'small' | 'medium' | 'large' | 'x_large';

export interface EffortEstimate {
  band: EffortBand;
  story_points: number | null;
  confidence: number;
  rationale: string | null;
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
  effortEstimate: EffortEstimate | null;
  updatedAt: string;
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
    effortEstimate: raw.effort_estimate,
    updatedAt: raw.updated_at,
    completionRatio,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createDorStore() {
  const scaffold = writable<UIState<ScaffoldView>>(empty());
  const scaffolds = writable<UIState<ScaffoldView[]>>(empty());
  let initialised = false;

  async function list() {
    scaffolds.set(loading());
    const result = await invoke<TicketScaffold[]>('cmd_list_ticket_scaffolds');
    if (result.status === 'success') {
      const items = result.data.map(toScaffoldView);
      scaffolds.set(items.length > 0 ? success(items) : empty());
    } else if (result.status === 'error') {
      scaffolds.set(err(result.message));
    } else if (result.status === 'permission_denied') {
      scaffolds.set({ status: 'permission_denied', message: result.message });
    } else {
      scaffolds.set(empty());
    }
  }

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
      await list();
    }
    return result;
  }

  async function create(ticketKey: string) {
    const result = await invoke<TicketScaffold>('cmd_create_ticket_scaffold', {
      ticket_key: ticketKey,
    });
    if (result.status === 'success') {
      scaffold.set(success(toScaffoldView(result.data)));
      await list();
    }
    return result;
  }

  async function setAcceptanceCriteria(ticketKey: string, criteria: string[]) {
    const result = await invoke<TicketScaffold>('cmd_set_acceptance_criteria', {
      ticket_key: ticketKey,
      criteria,
    });
    if (result.status === 'success') {
      scaffold.set(success(toScaffoldView(result.data)));
      await list();
    }
    return result;
  }

  async function setEffortEstimate(ticketKey: string, estimate: EffortEstimate) {
    const result = await invoke<TicketScaffold>('cmd_set_effort_estimate', {
      ticket_key: ticketKey,
      estimate,
    });
    if (result.status === 'success') {
      scaffold.set(success(toScaffoldView(result.data)));
      await list();
    }
    return result;
  }

  function init() {
    if (initialised) return;
    initialised = true;
    list();
  }

  return { scaffold, scaffolds, list, load, create, setItemStatus, setAcceptanceCriteria, setEffortEstimate, init };
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
