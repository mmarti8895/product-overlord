/**
 * PortfolioPanel (tasks 6.3–6.5)
 *
 * Four tabs:
 *   Overview         — project cards, refresh button, create portfolio modal
 *   Dependency Graph — react-force-graph cross-project epics
 *   Capacity Heat-map — table with colour-coded utilisation
 *   Digest           — Markdown digest, regenerate + deliver
 */

import { useState } from "react";
import { ForceGraph2D } from "react-force-graph";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { usePortfolioStore } from "../stores/portfolioStore.js";
import {
  usePortfolios, usePortfolioSnapshot, usePortfolioDependencies,
  usePortfolioCapacity, usePortfolioDigest,
  useRefreshPortfolio, useGenerateDigest, useDeliverDigest, useCreatePortfolio,
} from "../api/usePortfolio.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import type { Portfolio, ProjectSummary, CapacityRow, CrossProjectEdge } from "../types/portfolio.js";

type Tab = "overview" | "deps" | "capacity" | "digest";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "📁 Overview" },
  { id: "deps",      label: "🔗 Dependencies" },
  { id: "capacity",  label: "📊 Capacity" },
  { id: "digest",    label: "📄 Digest" },
];

const SPRINT_VARIANT = {
  "on-track":  "ready",
  "at-risk":   "needs_clarification",
  "off-track": "blocked",
} as const;

// ─── Overview Tab ──────────────────────────────────────────────────────────

function OverviewTab({ portfolioId }: { portfolioId: string }) {
  const { data: snap, isLoading } = usePortfolioSnapshot(portfolioId);
  const refresh = useRefreshPortfolio(portfolioId);
  const push = useToastStore((s) => s.push);

  async function handleRefresh() {
    try { await refresh.mutateAsync(); push("Portfolio refreshed", "success"); }
    catch { push("Refresh failed", "error"); }
  }

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;
  if (!snap) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No snapshot yet.</p>
      <button onClick={handleRefresh} disabled={refresh.isPending}
        style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
          border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
        {refresh.isPending ? "Refreshing…" : "⟳ Refresh"}
      </button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={handleRefresh} disabled={refresh.isPending}
          style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          {refresh.isPending ? "Refreshing…" : "⟳ Refresh"}
        </button>
      </div>

      {snap.warnings.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {snap.warnings.map((w, i) => (
            <GlassBadge key={i} variant="needs_clarification">⚠ {w}</GlassBadge>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {snap.project_summaries.map((ps: ProjectSummary) => (
          <GlassCard key={ps.project_key} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{ps.project_key}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ps.sprint_health && (
                <GlassBadge variant={SPRINT_VARIANT[ps.sprint_health]}>
                  Sprint: {ps.sprint_health}
                </GlassBadge>
              )}
              {ps.roadmap_health && (
                <GlassBadge variant={SPRINT_VARIANT[ps.roadmap_health.health_label as keyof typeof SPRINT_VARIANT] ?? "neutral"}>
                  Roadmap: {ps.roadmap_health.health_label}
                </GlassBadge>
              )}
            </div>
            {ps.roadmap_health?.next_milestone && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                Next: {ps.roadmap_health.next_milestone}
                {ps.roadmap_health.next_milestone_date && ` · ${new Date(ps.roadmap_health.next_milestone_date).toLocaleDateString()}`}
              </p>
            )}
            {ps.warnings.length > 0 && (
              <p style={{ margin: 0, fontSize: 11, color: "var(--needs-clarification)" }}>
                ⚠ {ps.warnings.join("; ")}
              </p>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Dependency Graph Tab ──────────────────────────────────────────────────

function DepsTab({ portfolioId }: { portfolioId: string }) {
  const { data: deps = [], isLoading } = usePortfolioDependencies(portfolioId);
  const push = useToastStore((s) => s.push);

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;
  if (deps.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No cross-project dependencies found.</p>;

  const epicKeys = Array.from(new Set(deps.flatMap((d: CrossProjectEdge) => [d.from_epic, d.to_epic])));
  const nodes = epicKeys.map((id) => {
    const isBlocking = deps.some((d: CrossProjectEdge) => (d.from_epic === id || d.to_epic === id) && d.blocking);
    return { id, color: isBlocking ? "var(--blocked)" : "var(--ready)" };
  });
  const links = deps.map((d: CrossProjectEdge) => ({
    source: d.from_epic,
    target: d.to_epic,
    color: d.blocking ? "var(--blocked)" : "var(--needs-clarification)",
  }));

  return (
    <div style={{ border: "1px solid var(--glass-border)", borderRadius: 8, overflow: "hidden" }}>
      <ForceGraph2D
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        graphData={{ nodes: nodes as any, links: links as any }}
        nodeLabel="id"
        nodeColor={(n: object) => (n as { color: string }).color}
        linkColor={(l: object) => (l as { color: string }).color}
        linkDirectionalArrowLength={6}
        linkDirectionalArrowRelPos={1}
        width={780}
        height={400}
        backgroundColor="transparent"
        onNodeClick={(n: object) => push((n as { id: string }).id, "info")}
      />
    </div>
  );
}

// ─── Capacity Heat-map Tab ─────────────────────────────────────────────────

function CapacityTab({ portfolioId }: { portfolioId: string }) {
  const { data: rows = [], isLoading } = usePortfolioCapacity(portfolioId);

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;
  if (rows.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No capacity data.</p>;

  const utilisationColor = (label: CapacityRow["utilisation_label"]) => ({
    under: "var(--needs-clarification)",
    ok:    "var(--ready)",
    over:  "var(--blocked)",
  }[label]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--text-secondary)" }}>
            {["Project", "Team", "Avg Velocity", "Committed", "Sprints to MS", "Utilisation %", "Status"].map((h) => (
              <th key={h} style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)", textAlign: "left" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: CapacityRow) => (
            <tr key={row.project_key} style={{ background: row.utilisation_label === "over" ? "rgba(var(--blocked-rgb, 255,80,80),0.05)" : undefined }}>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>{row.project_key}</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>{row.team}</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>{row.avg_velocity_6sp.toFixed(1)}</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>{row.committed_next_ms}</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>{row.sprints_to_milestone.toFixed(1)}</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>
                <span style={{ fontWeight: 700, color: utilisationColor(row.utilisation_label) }}>
                  {row.utilisation_pct.toFixed(0)}%
                </span>
              </td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" }}>
                <GlassBadge variant={row.utilisation_label === "ok" ? "ready" : row.utilisation_label === "over" ? "blocked" : "needs_clarification"}>
                  {row.utilisation_label}
                </GlassBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Digest Tab ────────────────────────────────────────────────────────────

function DigestTab({ portfolioId }: { portfolioId: string }) {
  const { data: digest, isLoading } = usePortfolioDigest(portfolioId);
  const generate = useGenerateDigest(portfolioId);
  const deliver = useDeliverDigest(portfolioId);
  const push = useToastStore((s) => s.push);
  const [confirmChannel, setConfirmChannel] = useState<"slack" | "confluence" | null>(null);

  async function handleGenerate() {
    try { await generate.mutateAsync(); push("Digest generated", "success"); }
    catch { push("Generation failed", "error"); }
  }

  async function handleDeliver() {
    if (!confirmChannel) return;
    try {
      await deliver.mutateAsync(confirmChannel);
      push(`Delivered to ${confirmChannel}`, "success");
    } catch { push("Delivery failed", "error"); }
    setConfirmChannel(null);
  }

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleGenerate} disabled={generate.isPending}
          style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          {generate.isPending ? "Generating…" : "⟳ Regenerate"}
        </button>
        {digest && (
          <>
            <button onClick={() => setConfirmChannel("slack")}
              style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
              📤 Deliver to Slack
            </button>
            <button onClick={() => setConfirmChannel("confluence")}
              style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
              📤 Publish to Confluence
            </button>
          </>
        )}
      </div>

      {!digest && !isLoading && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No digest yet. Click Regenerate to create one.</p>
      )}

      {digest && (
        <GlassCard>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, fontFamily: "inherit" }}>
            {digest.content}
          </pre>
          <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
            Generated {new Date(digest.generated_at).toLocaleString()}
          </p>
        </GlassCard>
      )}

      {/* Confirm Deliver Modal */}
      {confirmChannel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass" style={{ padding: 24, borderRadius: 12, width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={{ margin: 0 }}>Confirm delivery</h3>
            <p style={{ margin: 0, fontSize: 13 }}>
              Deliver digest to <strong>{confirmChannel}</strong>?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmChannel(null)}
                style={{ padding: "6px 14px", borderRadius: 6, background: "none",
                  border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDeliver} disabled={deliver.isPending}
                style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
                  border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer" }}>
                {deliver.isPending ? "Delivering…" : "Deliver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Portfolio Modal ────────────────────────────────────────────────

function CreatePortfolioModal({ onClose }: { onClose: () => void }) {
  const create = useCreatePortfolio();
  const push = useToastStore((s) => s.push);
  const selectPortfolio = usePortfolioStore((s) => s.selectPortfolio);
  const [name, setName] = useState("");
  const [keys, setKeys] = useState("");

  async function handleCreate() {
    const project_keys = keys.split(/[\s,]+/).map((k) => k.trim()).filter(Boolean);
    try {
      const p = await create.mutateAsync({ name, project_keys });
      push("Portfolio created", "success");
      selectPortfolio(p.id);
      onClose();
    } catch { push("Failed to create portfolio", "error"); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass" style={{ padding: 24, borderRadius: 12, width: 380, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ margin: 0 }}>Create Portfolio</h3>
        <input placeholder="Portfolio name" value={name} onChange={(e) => setName(e.target.value)}
          style={{ padding: "6px 10px", background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", borderRadius: 6,
            color: "var(--text-primary)", fontSize: 13 }} />
        <div>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Project keys (comma or space separated)</label>
          <textarea value={keys} onChange={(e) => setKeys(e.target.value)}
            placeholder="PROJ1, PROJ2, PROJ3"
            rows={2}
            style={{ width: "100%", marginTop: 4, padding: "6px 10px", background: "var(--surface-2)",
              border: "1px solid var(--glass-border)", borderRadius: 6,
              color: "var(--text-primary)", fontSize: 13, resize: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose}
            style={{ padding: "6px 14px", borderRadius: 6, background: "none",
              border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={create.isPending || !name.trim()}
            style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
              border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer" }}>
            {create.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────

export default function PortfolioPanel() {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const selectedId = usePortfolioStore((s) => s.selectedId);
  const activeTab = usePortfolioStore((s) => s.activeTab);
  const selectPortfolio = usePortfolioStore((s) => s.selectPortfolio);
  const setTab = usePortfolioStore((s) => s.setTab);
  const [showCreate, setShowCreate] = useState(false);

  const currentPortfolio = portfolios.find((p: Portfolio) => p.id === selectedId);

  return (
    <GlassPanel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>📁 Portfolio</h2>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          + New Portfolio
        </button>
      </div>

      {/* Portfolio selector */}
      {portfolios.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <select value={selectedId ?? ""}
            onChange={(e) => selectPortfolio(e.target.value || null)}
            style={{ padding: "6px 12px", background: "var(--surface-2)",
              border: "1px solid var(--glass-border)", borderRadius: 6,
              color: "var(--text-primary)", fontSize: 13, cursor: "pointer" }}>
            <option value="">Select portfolio…</option>
            {portfolios.map((p: Portfolio) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading portfolios…</p>}
      {!isLoading && portfolios.length === 0 && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No portfolios yet. Create one to get started.</p>
      )}

      {selectedId && currentPortfolio && (
        <>
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid var(--glass-border)",
                  background: activeTab === t.id ? "var(--surface-2)" : "transparent",
                  color: activeTab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400 }}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview"  && <OverviewTab portfolioId={selectedId} />}
          {activeTab === "deps"      && <DepsTab portfolioId={selectedId} />}
          {activeTab === "capacity"  && <CapacityTab portfolioId={selectedId} />}
          {activeTab === "digest"    && <DigestTab portfolioId={selectedId} />}
        </>
      )}

      {showCreate && <CreatePortfolioModal onClose={() => setShowCreate(false)} />}
    </GlassPanel>
  );
}
