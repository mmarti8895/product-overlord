import { create } from "zustand";

export type FindingSeverity = "info" | "warn" | "critical";
export type FindingStatus = "open" | "acked" | "escalated";

export interface OrchestratorFinding {
  id: string;
  agent: string;
  run_id: string;
  severity: FindingSeverity;
  type: string;
  message: string;
  created_at: string;
  status: FindingStatus;
}

interface OrchestratorState {
  findings: OrchestratorFinding[];
  addOrUpdate: (f: OrchestratorFinding) => void;
  unreadCount: () => number;
}

export const useOrchestratorStore = create<OrchestratorState>((set, get) => ({
  findings: [],
  addOrUpdate: (f) =>
    set(s => {
      const idx = s.findings.findIndex(x => x.id === f.id);
      if (idx >= 0) {
        const next = [...s.findings];
        next[idx] = f;
        return { findings: next };
      }
      return { findings: [...s.findings, f] };
    }),
  unreadCount: () => get().findings.filter(f => f.status === "open").length,
}));
