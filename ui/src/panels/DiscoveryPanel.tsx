/**
 * DiscoveryPanel — placeholder (discovery-intake tasks 6.3)
 * Full implementation below.
 */

import { useState } from "react";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useDiscoveryThemes, useOpportunityCandidates, usePromoteCandidate, useDismissCandidate, useDiscoverySyncTrigger } from "../api/useDiscovery.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import type { FeedbackTheme } from "../types/discovery.js";

type Tab = "themes" | "triage" | "sentiment";

const TABS: { id: Tab; label: string }[] = [
  { id: "themes",    label: "💡 Theme Cards" },
  { id: "triage",    label: "📋 Triage Queue" },
  { id: "sentiment", label: "📈 Sentiment Timeline" },
];

// ─── Theme Cards Tab ───────────────────────────────────────────────────────

function ThemeCardsTab() {
  const { data: themes = [], isLoading } = useDiscoveryThemes();

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading themes…</p>;
  if (themes.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No themes yet. Run a sync to ingest feedback.</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
      {themes.map((t) => (
        <ThemeCard key={t.id} theme={t} />
      ))}
    </div>
  );
}

function ThemeCard({ theme }: { theme: FeedbackTheme }) {
  const [expanded, setExpanded] = useState(false);
  const sentimentColor = theme.avg_sentiment >= 0 ? "var(--ready)" : "var(--blocked)";

  return (
    <GlassCard style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{theme.name}</p>
        <GlassBadge variant="neutral">{theme.frequency} signals</GlassBadge>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Avg sentiment</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: sentimentColor }}>
          {theme.avg_sentiment >= 0 ? "+" : ""}{theme.avg_sentiment.toFixed(2)}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>
            Representative quotes
          </p>
          {theme.representative_quotes.map((q, i) => (
            <blockquote key={i} style={{
              margin: "0 0 6px", padding: "6px 10px",
              borderLeft: "2px solid var(--glass-border)",
              fontSize: 12, color: "var(--text-secondary)",
            }}>
              {q}
            </blockquote>
          ))}
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ background: "none", border: "none", color: "var(--text-secondary)",
          cursor: "pointer", fontSize: 12, textAlign: "left", padding: 0 }}
      >
        {expanded ? "▲ Collapse" : "▼ Show quotes"}
      </button>
    </GlassCard>
  );
}

// ─── Triage Queue Tab ──────────────────────────────────────────────────────

function TriageQueueTab() {
  const { data: candidates = [], isLoading } = useOpportunityCandidates();
  const promote = usePromoteCandidate();
  const dismiss = useDismissCandidate();
  const push = useToastStore((s) => s.push);
  const [promoteId, setPromoteId] = useState<string | null>(null);
  const [dismissId, setDismissId] = useState<string | null>(null);
  const [promoteFields, setPromoteFields] = useState({ project_key: "", title: "", description: "" });
  const [dismissReason, setDismissReason] = useState("");

  const pending = candidates.filter((c) => c.status === "pending");

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;
  if (pending.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No pending candidates.</p>;

  async function handlePromote() {
    if (!promoteId) return;
    try {
      await promote.mutateAsync({ id: promoteId, ...promoteFields });
      push("Ticket created", "success");
    } catch { push("Failed to promote", "error"); }
    setPromoteId(null);
  }

  async function handleDismiss() {
    if (!dismissId) return;
    try {
      await dismiss.mutateAsync({ id: dismissId, reason: dismissReason });
      push("Candidate dismissed", "info");
    } catch { push("Failed to dismiss", "error"); }
    setDismissId(null);
    setDismissReason("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {pending.map((c) => (
        <GlassCard key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{c.title}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>{c.problem_statement}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <GlassBadge variant="neutral">Reach {c.estimated_reach}</GlassBadge>
              <GlassBadge variant="neutral">Impact {c.estimated_impact.toFixed(1)}</GlassBadge>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setPromoteId(c.id); setPromoteFields({ project_key: "", title: c.title, description: c.problem_statement }); }}
              style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
                border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer", fontSize: 12 }}>
              Promote
            </button>
            <button onClick={() => setDismissId(c.id)}
              style={{ padding: "6px 14px", borderRadius: 6, background: "var(--blocked-bg)",
                border: "1px solid var(--blocked)", color: "var(--blocked)", cursor: "pointer", fontSize: 12 }}>
              Dismiss
            </button>
          </div>
        </GlassCard>
      ))}

      {/* Promote Modal */}
      {promoteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass" style={{ padding: 24, borderRadius: 12, width: 420, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Promote to Jira</h3>
            {(["project_key", "title", "description"] as const).map((f) => (
              <div key={f}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>{f.replace("_", " ").toUpperCase()}</label>
                <input value={promoteFields[f]}
                  onChange={(e) => setPromoteFields((p) => ({ ...p, [f]: e.target.value }))}
                  style={{ width: "100%", padding: "6px 10px", marginTop: 4,
                    background: "var(--surface-2)", border: "1px solid var(--glass-border)",
                    borderRadius: 6, color: "var(--text-primary)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setPromoteId(null)} style={{ padding: "6px 14px", borderRadius: 6,
                background: "none", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handlePromote} disabled={promote.isPending}
                style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
                  border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer" }}>
                {promote.isPending ? "Creating…" : "Confirm & Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Modal */}
      {dismissId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass" style={{ padding: 24, borderRadius: 12, width: 360, display: "flex", flexDirection: "column", gap: 12 }}>
            <h3 style={{ margin: 0 }}>Dismiss candidate</h3>
            <textarea value={dismissReason} onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Reason for dismissal…"
              rows={3}
              style={{ padding: "8px 10px", background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                color: "var(--text-primary)", fontSize: 13, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDismissId(null)} style={{ padding: "6px 14px", borderRadius: 6,
                background: "none", border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleDismiss} disabled={dismiss.isPending}
                style={{ padding: "6px 14px", borderRadius: 6, background: "var(--blocked-bg)",
                  border: "1px solid var(--blocked)", color: "var(--blocked)", cursor: "pointer" }}>
                {dismiss.isPending ? "Dismissing…" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sentiment Timeline Tab ────────────────────────────────────────────────

function SentimentTimelineTab() {
  const { data: themes = [] } = useDiscoveryThemes();

  // Simple SVG line chart — no extra dep
  const W = 600, H = 120, PAD = 40;
  const weeks = 8;
  const slots = Array.from({ length: weeks }, (_, i) => i);

  // Placeholder sine data per theme (real data would come from API)
  const lines = themes.slice(0, 5).map((t, ti) => ({
    name: t.name,
    points: slots.map((w) => ({
      x: PAD + (w / (weeks - 1)) * (W - PAD * 2),
      y: H / 2 - Math.sin((w + ti) * 0.8) * (H / 3),
    })),
    color: ["var(--ready)", "var(--needs-clarification)", "var(--blocked)", "var(--ok)", "var(--degraded)"][ti],
  }));

  if (themes.length === 0) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No theme data.</p>;

  return (
    <div>
      <svg width={W} height={H} style={{ display: "block" }}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f}
            stroke="var(--glass-border)" strokeWidth={1} />
        ))}
        {/* Lines */}
        {lines.map((l) => (
          <polyline key={l.name}
            points={l.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none" stroke={l.color} strokeWidth={2} opacity={0.8} />
        ))}
        {/* X axis labels */}
        {slots.map((w) => (
          <text key={w}
            x={PAD + (w / (weeks - 1)) * (W - PAD * 2)}
            y={H - 4}
            textAnchor="middle" fontSize={9} fill="var(--text-secondary)">
            W-{weeks - w}
          </text>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
        {lines.map((l) => (
          <span key={l.name} style={{ fontSize: 11, color: l.color }}>■ {l.name}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────

export default function DiscoveryPanel() {
  const [tab, setTab] = useState<Tab>("themes");
  const sync = useDiscoverySyncTrigger();
  const push = useToastStore((s) => s.push);

  async function handleSync() {
    try {
      await sync.mutateAsync();
      push("Feedback sync triggered", "success");
    } catch { push("Sync failed", "error"); }
  }

  return (
    <GlassPanel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>💡 Discovery</h2>
        <button onClick={handleSync} disabled={sync.isPending}
          style={{ padding: "8px 18px", borderRadius: 8, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          {sync.isPending ? "Syncing…" : "⟳ Sync Feedback"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "6px 16px", borderRadius: 8,
              border: "1px solid var(--glass-border)",
              background: tab === t.id ? "var(--surface-2)" : "transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "themes"    && <ThemeCardsTab />}
      {tab === "triage"    && <TriageQueueTab />}
      {tab === "sentiment" && <SentimentTimelineTab />}
    </GlassPanel>
  );
}
