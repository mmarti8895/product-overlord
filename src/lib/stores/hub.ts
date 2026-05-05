import { writable } from 'svelte/store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HubTab = 'llm' | 'jira' | 'github';

export interface HubState {
  open: boolean;
  activeTab: HubTab;
}

// ─── Store ────────────────────────────────────────────────────────────────────

function createHubStore() {
  const { subscribe, set, update } = writable<HubState>({ open: false, activeTab: 'llm' });

  function open(tab: HubTab = 'llm') {
    set({ open: true, activeTab: tab });
  }

  function close() {
    update((s) => ({ ...s, open: false }));
  }

  function setTab(tab: HubTab) {
    update((s) => ({ ...s, activeTab: tab }));
  }

  return { subscribe, open, close, setTab };
}

export const hub = createHubStore();
