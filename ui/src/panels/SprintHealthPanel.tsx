/**
 * SprintHealthPanel (task 4.4)
 *
 * Shows live sprint health for any configured Jira board:
 *   4.4a  Board selector dropdown
 *   4.4b  Velocity gauge  (completed / committed %)
 *   4.4c  6-sprint velocity sparkline
 *   4.4d  Health badge
 *   4.4e  Blocker list
 *   4.4f  Scope-creep badge
 *
 * Live updates via useSprintStream (SSE → sprintStore).
 */

import { useState, useEffect } from "react";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { ScoreGauge } from "../components/charts/ScoreGauge.js";
import { useSprintStore } from "../stores/sprintStore.js";
import { useSprintStream } from "../api/useSprintStream.js";
import { useSprint } from "../api/useSprint.js";
import { useSettingsStore } from "../stores/settingsStore.js";
import type { SprintSnapshot, VelocityPoint, BlockerTicket } from "../types/sprint.js";

// ---------------------------------------------------------------------------
// Health-label → GlassBadge variant mapping (task 4.4d)
// ---------------------------------------------------------------------------
const HEALTH_VARIANT: Record<SprintSnapshot["health_label"], "ready" | "needs_clarification" | "blocked"> = {
  "on-track": "ready",
  "at-risk":  "needs_clarification",
  "off-track": "blocked",
};

const HEALTH_LABEL: Record<SprintSnapshot["health_label"], string> = {
  "on-track":  "On Track",
  "at-risk":   "At Risk",
  "off-track": "Off Track",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VelocitySparkline({ points }: { points: VelocityPoint[] }) {
  if (points.length === 0) return (
    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>No closed-sprint data yet.</p>
  );

  const max = Math.max(...points.map(p => Math.max(p.committed, p.completed)), 1);
  const W = 280;
  const H = 60;
  const gap = W / Math.max(points.length - 1, 1);

  const toY = (v: number) => H - (v / max) * (H - 8);

  const committedPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${i * gap},${toY(p.committed)}`)
    .join(" ");
  const completedPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${i * gap},${toY(p.completed)}`)
    .join(" ");

  return (
    <div>
      <svg width={W} height={H} style={{ overflow: "visible" }}>
        <path d={committedPath} fill="none" stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="4 2" />
        <path d={completedPath} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <title key={i}>{`${p.sprint_name}: ${p.completed}/${p.committed} pts`}</title>
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={i * gap} cy={toY(p.completed)} r={3} fill="var(--accent)" />
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "var(--text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={16} height={4}><line x1={0} y1={2} x2={16} y2={2} stroke="var(--text-secondary)" strokeWidth={1.5} strokeDasharray="4 2" /></svg>
          Committed
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={16} height={4}><line x1={0} y1={2} x2={16} y2={2} stroke="var(--accent)" strokeWidth={2} /></svg>
          Completed
        </span>
      </div>
    </div>
  );
}

function BlockerItem({ blocker, jiraBase }: { blocker: BlockerTicket; jiraBase?: string }) {
  const [open, setOpen] = useState(false);
  const url = jiraBase ? `${jiraBase}/browse/${blocker.key}` : undefined;

  return (
    <GlassCard style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          width: "100%", background: "none", border: "none", cursor: "pointer",
          color: "var(--text-primary)", textAlign: "left", padding: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {url
            ? <a href={url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }} onClick={e => e.stopPropagation()}>{blocker.key}</a>
            : blocker.key
          }{" "}
          <span style={{ fontWeight: 400 }}>{blocker.summary}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlassBadge variant="blocked" style={{ fontSize: 11 }}>{blocker.age_days}d old</GlassBadge>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
          <strong>Blocked by:</strong>{" "}
          {blocker.blocker_keys.map((k, i) => (
            <span key={k}>
              {i > 0 && ", "}
              {jiraBase
                ? <a href={`${jiraBase}/browse/${k}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{k}</a>
                : k
              }
            </span>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", color: "var(--text-secondary)", gap: 12 }}>
      <span style={{ fontSize: 32 }}>🏃</span>
      <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function SprintHealthPanel() {
  // 4.4a — board selector uses sprint_board_ids from server settings
  // We read the raw setting key stored by SettingsPanel; fall back gracefully.
  const { serverUrl } = useSettingsStore();
  const [boardIds, setBoardIds] = useState<string[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string | null>(null);

  // Fetch available board IDs from /health (they are embedded in featureFlags indirectly)
  // Simpler: load from /api/status or just let the SSE stream tell us what boards exist.
  useEffect(() => {
    fetch(`${serverUrl.replace(/\/$/, "")}/health`)
      .then(r => r.json())
      .then((data: { sprint_board_ids?: string[] }) => {
        const ids: string[] = data.sprint_board_ids ?? [];
        if (ids.length > 0) {
          setBoardIds(ids);
          setSelectedBoard(s => s ?? ids[0]);
        }
      })
      .catch(() => {});
  }, [serverUrl]);

  // Populate board list from SSE store too (covers the case where health doesn't expose IDs)
  const snapshots = useSprintStore(s => s.snapshots);
  useEffect(() => {
    const ids = Array.from(snapshots.keys());
    if (ids.length > 0) {
      setBoardIds(prev => {
        const merged = Array.from(new Set([...prev, ...ids]));
        return merged;
      });
      setSelectedBoard(s => s ?? ids[0]);
    }
  }, [snapshots]);

  // Start SSE stream
  useSprintStream();

  const streamConnected = useSprintStore(s => s.streamConnected);

  // 4.4 — prefer live store snapshot; fall back to React Query fetch
  const liveSnap = useSprintStore(s => selectedBoard ? s.snapshots.get(selectedBoard) : undefined);
  const { data: fetchedSnap, isLoading } = useSprint(liveSnap ? null : selectedBoard);
  const snap: SprintSnapshot | null | undefined = liveSnap ?? fetchedSnap;

  const jiraBase = useSettingsStore(s => (s as unknown as { jiraBaseUrl?: string }).jiraBaseUrl);

  const velocityPct = snap && snap.committed_points > 0
    ? Math.round((snap.completed_points / snap.committed_points) * 100)
    : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 860 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Sprint Health</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* 4.4a — board selector */}
          {boardIds.length > 0 && (
            <select
              value={selectedBoard ?? ""}
              onChange={e => setSelectedBoard(e.target.value)}
              style={{
                background: "var(--surface-2)", color: "var(--text-primary)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                padding: "5px 10px", fontSize: 13, cursor: "pointer",
              }}
              aria-label="Board selector"
            >
              {boardIds.map(id => <option key={id} value={id}>Board {id}</option>)}
            </select>
          )}
          {/* Stream status */}
          <GlassBadge variant={streamConnected ? "ok" : "degraded"} dot>
            {streamConnected ? "Live" : "Reconnecting…"}
          </GlassBadge>
        </div>
      </div>

      {/* No board configured */}
      {boardIds.length === 0 && !isLoading && (
        <EmptyState message="No sprint boards configured. Set SPRINT_BOARD_IDS in your server environment." />
      )}

      {/* Loading */}
      {isLoading && boardIds.length === 0 && (
        <EmptyState message="Loading sprint data…" />
      )}

      {/* No active sprint */}
      {selectedBoard && !isLoading && snap === null && (
        <EmptyState message={`No active sprint found for board ${selectedBoard}.`} />
      )}

      {/* Snapshot available */}
      {snap && (
        <>
          {/* Stale warning */}
          {snap.stale && (
            <GlassBadge variant="degraded" style={{ alignSelf: "flex-start" }}>
              ⚠️ Data may be stale since {snap.stale_since ? new Date(snap.stale_since).toLocaleTimeString() : "unknown"}
            </GlassBadge>
          )}

          {/* Top metrics row */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* 4.4b — velocity gauge */}
            <GlassPanel style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 180 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>Velocity</p>
              <ScoreGauge score={velocityPct} size={120} />
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                {snap.completed_points} / {snap.committed_points} pts
                {snap.points_estimated_from_time && (
                  <span title="Points estimated from time (1 pt = 8 h)"> ⏱</span>
                )}
              </p>
            </GlassPanel>

            {/* Sprint info + 4.4d health badge */}
            <GlassPanel style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{snap.sprint_name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
                    {snap.days_remaining} day{snap.days_remaining !== 1 ? "s" : ""} remaining
                  </p>
                </div>
                {/* 4.4d */}
                <GlassBadge variant={HEALTH_VARIANT[snap.health_label]} dot style={{ fontSize: 13 }}>
                  {HEALTH_LABEL[snap.health_label]}
                </GlassBadge>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {/* 4.4f — scope creep badge */}
                {snap.scope_creep_delta > 0 && (
                  <GlassBadge variant="needs_clarification" title={`${snap.scope_additions.length} issue(s) added after sprint start`}>
                    📈 Scope creep +{snap.scope_creep_delta} pts ({snap.scope_additions.length} issues)
                  </GlassBadge>
                )}
                {snap.scope_creep_delta === 0 && (
                  <GlassBadge variant="neutral">No scope creep</GlassBadge>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  Health score: <strong style={{ color: "var(--text-primary)" }}>{snap.health_score}</strong> / 100
                </span>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  · Last updated: {new Date(snap.fetched_at).toLocaleTimeString()}
                </span>
              </div>
            </GlassPanel>
          </div>

          {/* 4.4c — velocity sparkline */}
          {snap.velocity_trend.length > 0 && (
            <GlassPanel>
              <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
                6-Sprint Velocity Trend
              </p>
              <VelocitySparkline points={snap.velocity_trend} />
            </GlassPanel>
          )}

          {/* 4.4e — blocker list */}
          <GlassPanel>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-secondary)" }}>
                Blockers
              </p>
              {snap.blockers.length > 0 && (
                <GlassBadge variant="blocked">{snap.blockers.length} blocker{snap.blockers.length !== 1 ? "s" : ""}</GlassBadge>
              )}
            </div>
            {snap.blockers.length === 0
              ? <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>No unresolved blockers past sprint midpoint. ✅</p>
              : snap.blockers.map(b => <BlockerItem key={b.key} blocker={b} jiraBase={jiraBase} />)
            }
          </GlassPanel>
        </>
      )}
    </div>
  );
}
