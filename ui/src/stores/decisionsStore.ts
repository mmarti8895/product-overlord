import { create } from "zustand";

export type DecisionStatus = "pending" | "approved" | "rejected" | "modified";

export interface Decision {
  id: string;
  agent: string;
  run_id: string;
  type: string;
  payload: unknown;
  requires_review: true;
  created_at: string;
  status: DecisionStatus;
  resolution?: { reason?: string; patch?: unknown; resolved_at: string };
}

interface DecisionsState {
  decisions: Decision[];
  addOrUpdate: (d: Decision) => void;
  pendingCount: () => number;
}

export const useDecisionsStore = create<DecisionsState>((set, get) => ({
  decisions: [],
  addOrUpdate: (d) =>
    set(s => {
      const idx = s.decisions.findIndex(x => x.id === d.id);
      if (idx >= 0) {
        const next = [...s.decisions];
        next[idx] = d;
        return { decisions: next };
      }
      return { decisions: [...s.decisions, d] };
    }),
  pendingCount: () => get().decisions.filter(d => d.status === "pending").length,
}));

export function useDecisionsPendingCount() {
  return useDecisionsStore(s => s.decisions.filter(d => d.status === "pending").length);
}
