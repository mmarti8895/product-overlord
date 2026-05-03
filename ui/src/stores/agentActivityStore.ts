import { create } from "zustand";

export type AgentEventKind = "start" | "progress" | "delay" | "finish" | "decision" | "finding";

export interface AgentEvent {
  event: AgentEventKind;
  agent: string;
  run_id: string;
  ts: string;
  parent_run_id?: string;
  pct?: number;
  msg?: string;
  reason?: string;
  retry_in_ms?: number;
  status?: "ok" | "error" | "stopped";
  duration_ms?: number;
  decision_id?: string;
  severity?: "info" | "warn" | "critical";
  message?: string;
  finding_id?: string;
}

export interface ActiveAgent {
  name: string;
  run_id: string;
  parent_run_id?: string;
  started_at: string;
  last_pct?: number;
  last_msg?: string;
  status?: "running" | "ok" | "error" | "stopped";
}

const RING = 2000;

interface AgentActivityState {
  events: AgentEvent[];
  activeAgents: Map<string, ActiveAgent>;
  addEvent: (e: AgentEvent) => void;
}

export const useAgentActivityStore = create<AgentActivityState>((set) => ({
  events: [],
  activeAgents: new Map(),
  addEvent: (e) =>
    set(s => {
      const events = s.events.length >= RING
        ? [...s.events.slice(1), e]
        : [...s.events, e];

      const agents = new Map(s.activeAgents);
      if (e.event === "start") {
        agents.set(e.run_id, { name: e.agent, run_id: e.run_id, parent_run_id: e.parent_run_id, started_at: e.ts, status: "running" });
      } else if (e.event === "progress") {
        const a = agents.get(e.run_id);
        if (a) agents.set(e.run_id, { ...a, last_pct: e.pct, last_msg: e.msg });
      } else if (e.event === "finish") {
        const a = agents.get(e.run_id);
        if (a) agents.set(e.run_id, { ...a, status: e.status as ActiveAgent["status"] ?? "ok" });
      }
      return { events, activeAgents: agents };
    }),
}));
