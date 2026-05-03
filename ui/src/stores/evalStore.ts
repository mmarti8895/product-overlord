import { create } from "zustand";

export interface GoldSetEntry {
  id: string;
  issueKey: string;
  expectedVerdict: string;
  tags: string[];
  bucket: string;
}

export interface EvalMetrics {
  agreementPct: number;
  precisionAt3: number;
  llmDegradedRate: number;
  ragP95LatencyMs: number;
}

export interface EvalRunResult {
  runId: string;
  timestamp: string;
  passed: boolean;
  metrics: EvalMetrics;
}

interface EvalState {
  goldSet: GoldSetEntry[];
  lastResult: EvalRunResult | null;
  running: boolean;
  setGoldSet: (entries: GoldSetEntry[]) => void;
  setResult: (result: EvalRunResult) => void;
  setRunning: (v: boolean) => void;
}

export const useEvalStore = create<EvalState>((set) => ({
  goldSet: [],
  lastResult: null,
  running: false,
  setGoldSet: (goldSet) => set({ goldSet }),
  setResult: (result) => set({ lastResult: result }),
  setRunning: (running) => set({ running }),
}));
