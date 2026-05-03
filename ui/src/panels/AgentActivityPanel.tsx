import { useState } from "react";
import { GlassPanel } from "../components/glass/GlassPanel.js";
import { GlassInput } from "../components/glass/GlassInput.js";
import { useAgentStream, useStopAllAgents } from "../api/queries/agentHooks.js";
import { useAgentActivityStore } from "../stores/agentActivityStore.js";
import { AgentRow } from "./agents/AgentRow.js";
import { GlassButton } from "../components/glass/GlassButton.js";
import { AgentBuilderModal } from "./AgentBuilderModal.js";

export default function AgentActivityPanel() {
  useAgentStream();
  const [filter, setFilter] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const { activeAgents, events } = useAgentActivityStore();
  const stopAll = useStopAllAgents();

  const agents = [...activeAgents.values()].filter(a =>
    !filter || a.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Build parent→children map
  const children = new Map<string, string[]>();
  for (const a of activeAgents.values()) {
    if (a.parent_run_id) {
      if (!children.has(a.parent_run_id)) children.set(a.parent_run_id, []);
      children.get(a.parent_run_id)!.push(a.run_id);
    }
  }
  const roots = agents.filter(a => !a.parent_run_id);

  const activeCount = agents.filter(a => !a.status || a.status === "running").length;

  return (
    <div role="region" aria-label="Agent Activity" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Agent Activity</h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Live feed of all agent and sub-agent lifecycle events.
          </p>
        </div>
        {activeCount > 0 && (
          <GlassButton variant="danger" onClick={() => stopAll.mutate()} style={{ fontSize: 12 }}>
            ⏹ Stop All ({activeCount})
          </GlassButton>
        )}
        <GlassButton variant="primary" onClick={() => setBuilderOpen(true)} style={{ fontSize: 12 }}>
          + New Agent
        </GlassButton>
      </div>

      <GlassInput
        label=""
        placeholder="Filter by agent name…"
        aria-label="Filter agents by name"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        {roots.length === 0 ? (
          <p style={{ padding: 20, margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
            No active agents. Start a workflow or trigger an agent to see activity here.
          </p>
        ) : (
          roots.map(agent => (
            <div key={agent.run_id}>
              <AgentRow agent={agent} />
              {(children.get(agent.run_id) ?? []).map(childId => {
                const child = activeAgents.get(childId);
                return child ? <AgentRow key={childId} agent={child} isChild /> : null;
              })}
            </div>
          ))
        )}
      </GlassPanel>

      {/* Recent event log */}
      <GlassPanel style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Recent Events</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflowY: "auto" }}>
          {[...events].reverse().slice(0, 100).map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 11, fontFamily: "monospace", color: "var(--text-secondary)" }}>
              <span style={{ color: "var(--text-secondary)", flexShrink: 0 }}>{new Date(e.ts).toLocaleTimeString()}</span>
              <span style={{ fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>{e.agent}</span>
              <span style={{ color: "var(--text-primary)" }}>{e.event}</span>
              {e.msg && <span>{e.msg}</span>}
              {e.pct != null && <span>{e.pct}%</span>}
              {e.status && <span style={{ color: e.status === "ok" ? "var(--ok)" : e.status === "error" ? "var(--error)" : "inherit" }}>{e.status}</span>}
            </div>
          ))}
        </div>
      </GlassPanel>

      <AgentBuilderModal open={builderOpen} onClose={() => setBuilderOpen(false)} />
    </div>
  );
}
