import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnectionsStore, type Provider } from "../../stores/connectionsStore.js";
import { useDecisionsStore } from "../../stores/decisionsStore.js";
import { useWorkflowStore } from "../../stores/workflowStore.js";
import { useAgentActivityStore } from "../../stores/agentActivityStore.js";
import { useOrchestratorStore } from "../../stores/orchestratorStore.js";

const BASE = "/api";

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

export function useConnections(provider: Provider) {
  const setConfig = useConnectionsStore(s => s.setConfig);
  return useQuery({
    queryKey: ["connections", provider],
    queryFn: async () => {
      const r = await fetch(`${BASE}/connections/${provider}`);
      if (!r.ok) return null;
      const data = await r.json();
      setConfig(provider, data);
      return data as Record<string, unknown>;
    },
  });
}

export function useSaveConnection(provider: Provider) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`${BASE}/connections/${provider}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["connections", provider] }),
  });
}

export function useTestConnection(provider: Provider) {
  const setResult = useConnectionsStore(s => s.setTestResult);
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/connections/${provider}/test`, { method: "POST" });
      return r.json() as Promise<{ ok: boolean; latency_ms: number; error?: string }>;
    },
    onSuccess: (data) => setResult(provider, { ...data, tested_at: new Date().toISOString() }),
  });
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export function useDecisionsStream() {
  const addOrUpdate = useDecisionsStore(s => s.addOrUpdate);
  useEffect(() => {
    const es = new EventSource(`${BASE}/decisions/stream`);
    es.onmessage = (e) => {
      try { addOrUpdate(JSON.parse(e.data)); } catch { /* ignore */ }
    };
    return () => es.close();
  }, [addOrUpdate]);
}

export function useApproveDecision() {
  const addOrUpdate = useDecisionsStore(s => s.addOrUpdate);
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/decisions/${id}/approve`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: addOrUpdate,
  });
}

export function useRejectDecision() {
  const addOrUpdate = useDecisionsStore(s => s.addOrUpdate);
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const r = await fetch(`${BASE}/decisions/${id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: addOrUpdate,
  });
}

export function useModifyDecision() {
  const addOrUpdate = useDecisionsStore(s => s.addOrUpdate);
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: unknown }) => {
      const r = await fetch(`${BASE}/decisions/${id}/modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patch }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: addOrUpdate,
  });
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export function useWorkflowRuns() {
  const setRuns = useWorkflowStore(s => s.setRuns);
  return useQuery({
    queryKey: ["workflow-runs"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/workflows/runs`);
      const data = await r.json();
      setRuns(data);
      return data;
    },
    refetchInterval: 3000,
  });
}

export function useRunWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stages: string[]) => {
      const r = await fetch(`${BASE}/workflows/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stages }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json() as Promise<{ run_id: string }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-runs"] }),
  });
}

export function usePlanWorkflow() {
  const setPlan = useWorkflowStore(s => s.setPlanResult);
  return useMutation({
    mutationFn: async (stages: string[]) => {
      const r = await fetch(`${BASE}/workflows/plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stages }) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: setPlan,
  });
}

export function useWorkflowSchedules() {
  const setSchedules = useWorkflowStore(s => s.setSchedules);
  return useQuery({
    queryKey: ["workflow-schedules"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/workflows/schedules`);
      const data = await r.json();
      setSchedules(data);
      return data;
    },
  });
}

export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch(`${BASE}/workflows/schedules`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-schedules"] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/workflows/schedules/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-schedules"] }),
  });
}

export function useStopWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ run_id, force }: { run_id: string; force?: boolean }) => {
      const r = await fetch(`${BASE}/workflows/${run_id}/stop${force ? "?force=true" : ""}`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-runs"] }),
  });
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/agents`);
      return r.json();
    },
    refetchInterval: 3000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (spec: Record<string, unknown>) => {
      const r = await fetch(`${BASE}/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(spec) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useStopAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (run_id: string) => {
      const r = await fetch(`${BASE}/agents/${run_id}/stop`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useStopAllAgents() {
  return useMutation({
    mutationFn: async () => {
      const r = await fetch(`${BASE}/agents/stop-all`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
}

export function useAgentStream() {
  const addEvent = useAgentActivityStore(s => s.addEvent);
  useEffect(() => {
    let es: EventSource;
    let retryMs = 1000;
    function connect() {
      es = new EventSource(`${BASE}/agents/stream`);
      es.onmessage = (e) => {
        try { addEvent(JSON.parse(e.data)); retryMs = 1000; } catch { /* ignore */ }
      };
      es.onerror = () => {
        es.close();
        setTimeout(connect, Math.min(retryMs, 30_000));
        retryMs = Math.min(retryMs * 2, 30_000);
      };
    }
    connect();
    return () => es?.close();
  }, [addEvent]);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export function useOrchestratorFindings() {
  const addOrUpdate = useOrchestratorStore(s => s.addOrUpdate);
  return useQuery({
    queryKey: ["orchestrator-findings"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/orchestrators/findings`);
      const data = await r.json();
      for (const f of data) addOrUpdate(f);
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useAckFinding() {
  const addOrUpdate = useOrchestratorStore(s => s.addOrUpdate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/orchestrators/findings/${id}/ack`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => { addOrUpdate(data); qc.invalidateQueries({ queryKey: ["orchestrator-findings"] }); },
  });
}

export function useEscalateFinding() {
  const addOrUpdate = useOrchestratorStore(s => s.addOrUpdate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${BASE}/orchestrators/findings/${id}/escalate`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    onSuccess: (data) => { addOrUpdate(data); qc.invalidateQueries({ queryKey: ["orchestrator-findings"] }); },
  });
}

export function useStopOrchestrator() {
  return useMutation({
    mutationFn: async (name: string) => {
      const r = await fetch(`${BASE}/orchestrators/${name}/stop`, { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
}
