import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../client.js";

// ---- Status & Config ----

export function useServerStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: () => apiFetch<{ server: string; version: string; shadow_mode: boolean; degraded_flags: Record<string, boolean>; uptime_ms: number }>("/api/status"),
    refetchInterval: 10_000,
  });
}

export function useServerConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: () => apiFetch<Record<string, string>>("/api/config"),
    staleTime: 60_000,
  });
}

// ---- Forge ----

export function useForgeIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { issueKey?: string; jql?: string }) =>
      apiFetch("/forge/ingest/issue", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evidence"] }),
  });
}

export function useForgeAnalyse(runId: string | null) {
  return useQuery({
    queryKey: ["analysis", runId],
    queryFn: () => apiFetch<Record<string, unknown>>(`/forge/analyse/${runId}`),
    enabled: !!runId,
  });
}

// ---- Knowledge Base ----

export function useKBSources(projectKey?: string) {
  return useQuery({
    queryKey: ["kb", "sources", projectKey],
    queryFn: () => apiFetch<{ sources: unknown[] }>(`/kb/sources${projectKey ? `?project=${projectKey}` : ""}`),
  });
}

export function useKBUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) =>
      fetch("/kb/upload", { method: "POST", body: form }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb"] }),
  });
}

export function useKBDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/kb/sources/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kb"] }),
  });
}

// ---- Evidence ----

export function useEvidenceRuns() {
  return useQuery({
    queryKey: ["evidence"],
    queryFn: () => apiFetch<{ runs: unknown[] }>("/api/evidence/runs"),
  });
}

export function useEvidenceBundle(runId: string | null) {
  return useQuery({
    queryKey: ["evidence", "bundle", runId],
    queryFn: () => apiFetch<unknown>(`/api/evidence/runs/${runId}`),
    enabled: !!runId,
  });
}

// ---- LLM ----

export function useLLMStatus() {
  return useQuery({
    queryKey: ["llm", "status"],
    queryFn: () => apiFetch<{ adapter: string; live: boolean; rateLimit: { remaining: number; resetAt: string } }>("/api/llm/status"),
    refetchInterval: 15_000,
  });
}

export function useLLMTraces() {
  return useQuery({
    queryKey: ["llm", "traces"],
    queryFn: () => apiFetch<{ traces: unknown[] }>("/api/llm/traces"),
    refetchInterval: 5_000,
  });
}

// ---- RAG ----

export function useRAGChunks(runId: string | null) {
  return useQuery({
    queryKey: ["rag", "chunks", runId],
    queryFn: () => apiFetch<{ chunks: unknown[] }>(`/api/rag/chunks/${runId}`),
    enabled: !!runId,
  });
}

// ---- Eval ----

export function useEvalGoldSet() {
  return useQuery({
    queryKey: ["eval", "goldset"],
    queryFn: () => apiFetch<{ entries: unknown[] }>("/api/eval/gold-set"),
  });
}

export function useRunEval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/eval/run", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["eval"] }),
  });
}
