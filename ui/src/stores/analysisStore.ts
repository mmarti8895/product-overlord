import { create } from "zustand";

export type Verdict = "ready" | "needs_clarification" | "blocked" | "degraded" | "ok" | null;

interface Dimension {
  name: string;
  weight: number;
  pass: boolean;
  score: number;
}

interface MissingItem {
  field: string;
  reason: string;
  source: "llm" | "rule";
}

interface ClarificationQuestion {
  role: "PM" | "Engineer" | "QA";
  question: string;
}

interface AnalysisState {
  runId: string | null;
  verdict: Verdict;
  score: number;
  dimensions: Dimension[];
  missingItems: MissingItem[];
  questions: ClarificationQuestion[];
  loading: boolean;
  setResult: (result: Partial<AnalysisState>) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  runId: null,
  verdict: null,
  score: 0,
  dimensions: [],
  missingItems: [],
  questions: [],
  loading: false,
  setResult: (result) => set(result),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ runId: null, verdict: null, score: 0, dimensions: [], missingItems: [], questions: [], loading: false }),
}));
