import { create } from "zustand";

export interface EvidenceRun {
  runId: string;
  issueKey: string;
  verdict: string;
  score: number;
  timestamp: string;
}

interface EvidenceState {
  runs: EvidenceRun[];
  selectedRunId: string | null;
  bundleJson: unknown;
  setRuns: (runs: EvidenceRun[]) => void;
  selectRun: (runId: string, bundle: unknown) => void;
  clearSelection: () => void;
}

export const useEvidenceStore = create<EvidenceState>((set) => ({
  runs: [],
  selectedRunId: null,
  bundleJson: null,
  setRuns: (runs) => set({ runs }),
  selectRun: (runId, bundleJson) => set({ selectedRunId: runId, bundleJson }),
  clearSelection: () => set({ selectedRunId: null, bundleJson: null }),
}));
