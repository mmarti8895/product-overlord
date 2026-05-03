import { create } from "zustand";

export type Provider = "jira" | "openai" | "github";

export interface TestResult {
  ok: boolean;
  latency_ms: number;
  error?: string;
  tested_at: string;
}

interface ConnectionsState {
  configs: Partial<Record<Provider, Record<string, unknown>>>;
  testResults: Partial<Record<Provider, TestResult>>;
  setConfig: (provider: Provider, config: Record<string, unknown>) => void;
  setTestResult: (provider: Provider, result: TestResult) => void;
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  configs: {},
  testResults: {},
  setConfig: (provider, config) =>
    set(s => ({ configs: { ...s.configs, [provider]: config } })),
  setTestResult: (provider, result) =>
    set(s => ({ testResults: { ...s.testResults, [provider]: result } })),
}));
