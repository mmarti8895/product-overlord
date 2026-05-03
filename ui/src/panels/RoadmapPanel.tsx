/**
 * RoadmapPanel (tasks 4.3, 4.4)
 *
 * Three sub-views:
 *   4.3a  Timeline View — horizontal milestone swimlanes, epic pills, health colours, SVG arrows
 *   4.3b  RICE Table View — sortable, inline-editable, PATCH on blur
 *   4.3c  Dependency Graph View — react-force-graph, cross-team amber, cycle red badge
 *   4.4   Epic detail side drawer
 */

import { useState, useRef, useCallback } from "react";
import { ForceGraph2D } from "react-force-graph";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useSettingsStore } from "../stores/settingsStore.js";
import { useRoadmapStore } from "../stores/roadmapStore.js";
import { useRoadmap, useMilestones, useDependencies, useRefreshRoadmap, usePatchEpicRICE, useEpic } from "../api/useRoadmap.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import type { Epic, Milestone, DependencyEdge, RICEScore } from "../types/roadmap.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

const HEALTH_VARIANT = {
  healthy:  "ready",
  "at-risk": "needs_clarification",
  blocked:   "blocked",
} as const;

const HEALTH_COLOR = {
  healthy:  "var(--ready)",
  "at-risk": "var(--needs-clarification)",
  blocked:   "var(--blocked)",
} as const;

function healthVariant(label: Epic["health_label"]) {
  return HEALTH_VARIANT[label] ?? "neutral";
}

// ─── Tab Bar ───────────────────────────────────────────────────────────────

type Tab = "timeline" | "rice" | "graph";
const TABS: { id: Tab; label: string }[] = [
  { id: "timeline", label: "⏱ Timeline" },
  { id: "rice",     label: "📊 RICE Table" },
  { id: "graph",    label: "🔗 Dependency Graph" },
];

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "6px 16px",
            borderRadius: 8,
            border: "1px solid var(--glass-border)",
            background: active === t.id ? "var(--surface-2)" : "transparent",
            color: active === t.id ? "var(--text-primary)" : "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: active === t.id ? 600 : 400,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── 4.3a  Timeline View ───────────────────────────────────────────────────

function TimelineView({
  milestones,
  epics,
  deps,
  onEpicClick,
}: {
  milestones: Milestone[];
  epics: Epic[];
  deps: DependencyEdge[];
  onEpicClick: (key: string) => void;
}) {
  const LANE_H = 72;
  const PILL_H = 32;
  const LABEL_W = 140;
  const TOTAL_W = 800;

  if (milestones.length === 0 && epics.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No roadmap data available. Click Refresh to load.</p>;
  }

  // Build a simple column index per milestone
  const msEpics: Record<string, Epic[]> = {};
  milestones.forEach((m) => { msEpics[m.id] = []; });
  const ungrouped: Epic[] = [];

  epics.forEach((e) => {
    if (e.milestone_id && msEpics[e.milestone_id]) {
      msEpics[e.milestone_id].push(e);
    } else {
      ungrouped.push(e);
    }
  });

  const allLanes = [
    ...milestones.map((m) => ({ id: m.id, label: m.name, epics: msEpics[m.id] })),
    ...(ungrouped.length > 0 ? [{ id: "__none__", label: "Unscheduled", epics: ungrouped }] : []),
  ];

  // Epic key → x,y centre for arrow drawing
  const epicPos: Record<string, { x: number; y: number }> = {};
  allLanes.forEach((lane, li) => {
    const y = li * LANE_H + LANE_H / 2;
    lane.epics.forEach((e, ei) => {
      const w = Math.max(80, Math.min(180, (e.child_keys.length + 1) * 20));
      const x = LABEL_W + ei * 200 + w / 2;
      epicPos[e.key] = { x, y };
    });
  });

  const totalH = allLanes.length * LANE_H;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={TOTAL_W} height={totalH} style={{ display: "block" }}>
        {/* Lane backgrounds */}
        {allLanes.map((lane, li) => (
          <g key={lane.id}>
            <rect x={0} y={li * LANE_H} width={TOTAL_W} height={LANE_H - 2}
              fill={li % 2 === 0 ? "var(--surface-1)" : "var(--surface-2)"}
              opacity={0.4} rx={4} />
            <text x={8} y={li * LANE_H + LANE_H / 2 + 4}
              fill="var(--text-secondary)" fontSize={11} fontWeight={600}>
              {lane.label}
            </text>
            {/* Epic pills */}
            {lane.epics.map((e) => {
              const w = Math.max(80, Math.min(180, (e.child_keys.length + 1) * 20));
              const pos = epicPos[e.key];
              return (
                <g key={e.key} style={{ cursor: "pointer" }}
                  onClick={() => onEpicClick(e.key)}>
                  <rect
                    x={pos.x - w / 2}
                    y={li * LANE_H + (LANE_H - PILL_H) / 2}
                    width={w} height={PILL_H} rx={6}
                    fill={HEALTH_COLOR[e.health_label]}
                    opacity={0.25}
                    stroke={HEALTH_COLOR[e.health_label]}
                    strokeWidth={1.5}
                  />
                  <text x={pos.x} y={li * LANE_H + LANE_H / 2 + 4}
                    textAnchor="middle"
                    fill="var(--text-primary)" fontSize={10} fontWeight={500}>
                    {e.key}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Dependency arrows */}
        {deps.map((d, i) => {
          const from = epicPos[d.from_epic];
          const to = epicPos[d.to_epic];
          if (!from || !to) return null;
          const color = d.cross_team ? "var(--needs-clarification)" : "var(--text-secondary)";
          return (
            <line key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={color} strokeWidth={1.5}
              strokeDasharray={d.cross_team ? "4,3" : undefined}
              markerEnd="url(#arrow)"
              opacity={0.7}
            />
          );
        })}

        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="var(--text-secondary)" />
          </marker>
        </defs>
      </svg>

      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--ready)" }}>■ Healthy</span>
        <span style={{ fontSize: 11, color: "var(--needs-clarification)" }}>■ At-Risk</span>
        <span style={{ fontSize: 11, color: "var(--blocked)" }}>■ Blocked</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>─── Same team dep</span>
        <span style={{ fontSize: 11, color: "var(--needs-clarification)" }}>- - Cross-team dep</span>
      </div>
    </div>
  );
}

// ─── 4.3b  RICE Table View ─────────────────────────────────────────────────

type SortKey = "rice" | "ice" | "health" | "key";

function RICETableView({
  epics,
  projectKey,
}: {
  epics: Epic[];
  projectKey: string;
}) {
  const [sortBy, setSortBy] = useState<SortKey>("rice");
  const push = useToastStore((s) => s.push);

  const sorted = [...epics].sort((a, b) => {
    if (sortBy === "rice") {
      return (b.rice_score?.score ?? -1) - (a.rice_score?.score ?? -1);
    }
    if (sortBy === "ice") {
      return (b.ice_score?.score ?? -1) - (a.ice_score?.score ?? -1);
    }
    if (sortBy === "health") return b.health_score - a.health_score;
    return a.key.localeCompare(b.key);
  });

  function SortBtn({ id, label }: { id: SortKey; label: string }) {
    return (
      <button
        onClick={() => setSortBy(id)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: sortBy === id ? "var(--text-primary)" : "var(--text-secondary)",
          fontWeight: sortBy === id ? 700 : 400, fontSize: 12, padding: "0 4px",
        }}
      >
        {label} {sortBy === id ? "▼" : ""}
      </button>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ color: "var(--text-secondary)", textAlign: "left" }}>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>
              <SortBtn id="key" label="Epic" />
            </th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>Summary</th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>
              <SortBtn id="health" label="Health" />
            </th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>
              <SortBtn id="rice" label="RICE" />
            </th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>R</th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>I</th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>C%</th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>E</th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>
              <SortBtn id="ice" label="ICE" />
            </th>
            <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>By</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <RICERow key={e.key} epic={e} projectKey={projectKey} push={push} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RICERow({
  epic,
  projectKey,
  push,
}: {
  epic: Epic;
  projectKey: string;
  push: (msg: string, variant?: "info" | "success" | "warn" | "error") => void;
}) {
  const patch = usePatchEpicRICE(projectKey, epic.key);
  const rice = epic.rice_score;
  const ice = epic.ice_score;

  const [draft, setDraft] = useState<Partial<RICEScore>>({});

  async function commit(field: keyof RICEScore) {
    const val = draft[field];
    if (val === undefined) return;
    try {
      await patch.mutateAsync({ [field]: val });
      push(`${epic.key} RICE updated`, "success");
    } catch {
      push(`Failed to update RICE`, "error");
    }
    setDraft((d) => { const n = { ...d }; delete n[field]; return n; });
  }

  function EditCell({ field, val }: { field: keyof RICEScore; val: number | undefined }) {
    return (
      <input
        type="number"
        value={draft[field] ?? val ?? ""}
        onChange={(ev) => setDraft((d) => ({ ...d, [field]: Number(ev.target.value) }))}
        onBlur={() => commit(field)}
        style={{
          width: 56, padding: "2px 6px",
          background: "var(--surface-2)", border: "1px solid var(--glass-border)",
          borderRadius: 4, color: "var(--text-primary)", fontSize: 12,
        }}
      />
    );
  }

  const td: React.CSSProperties = { padding: "6px 12px", borderBottom: "1px solid var(--glass-border)" };

  return (
    <tr>
      <td style={td}><code style={{ fontSize: 11 }}>{epic.key}</code></td>
      <td style={{ ...td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {epic.summary}
      </td>
      <td style={td}>
        <GlassBadge variant={healthVariant(epic.health_label)}>
          {epic.health_label}
        </GlassBadge>
      </td>
      <td style={{ ...td, fontWeight: 700 }}>{rice ? rice.score.toFixed(1) : "—"}</td>
      <td style={td}><EditCell field="reach" val={rice?.reach} /></td>
      <td style={td}><EditCell field="impact" val={rice?.impact} /></td>
      <td style={td}><EditCell field="confidence" val={rice?.confidence} /></td>
      <td style={td}><EditCell field="effort" val={rice?.effort} /></td>
      <td style={{ ...td, fontWeight: 700 }}>{ice ? ice.score.toFixed(1) : "—"}</td>
      <td style={td}>
        <GlassBadge variant={rice?.estimated_by === "human" ? "ready" : "neutral"}>
          {rice?.estimated_by ?? "—"}
        </GlassBadge>
      </td>
    </tr>
  );
}

// ─── 4.3c  Dependency Graph View ───────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  health: Epic["health_label"];
  val: number;
  [key: string]: unknown;
}
interface GraphLink {
  source: string;
  target: string;
  cross_team: boolean;
  type: string;
  [key: string]: unknown;
}

function DependencyGraphView({
  epics,
  deps,
  warnings,
  onNodeClick,
}: {
  epics: Epic[];
  deps: DependencyEdge[];
  warnings: string[];
  onNodeClick: (key: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  const hasCycle = warnings.some((w) => w.toLowerCase().includes("cycle"));

  const nodes: GraphNode[] = epics.map((e) => ({
    id: e.key,
    label: e.key,
    health: e.health_label,
    val: Math.max(1, e.child_keys.length),
  }));

  const links: GraphLink[] = deps.map((d) => ({
    source: d.from_epic,
    target: d.to_epic,
    cross_team: d.cross_team,
    type: d.type,
  }));

  const nodeColor = useCallback((node: GraphNode) => HEALTH_COLOR[node.health] ?? "var(--text-secondary)", []);
  const linkColor = useCallback((link: GraphLink) =>
    link.cross_team ? "var(--needs-clarification)" : "var(--text-secondary)", []);

  if (epics.length === 0) {
    return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No epics to display.</p>;
  }

  return (
    <div>
      {hasCycle && (
        <GlassBadge variant="blocked" style={{ marginBottom: 12, display: "inline-flex" }}>
          ⚠ Cycle detected — {warnings.filter((w) => w.includes("cycle")).join("; ")}
        </GlassBadge>
      )}
      <div style={{ border: "1px solid var(--glass-border)", borderRadius: 8, overflow: "hidden" }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={{ nodes, links }}
          nodeLabel="label"
          nodeColor={nodeColor as (n: object) => string}
          nodeVal="val"
          linkColor={linkColor as (l: object) => string}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          width={780}
          height={460}
          backgroundColor="transparent"
          onNodeClick={(node) => onNodeClick((node as GraphNode).id)}
          nodeCanvasObject={(node, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const n = node as GraphNode & { x?: number; y?: number };
            const x = n.x ?? 0, y = n.y ?? 0;
            const r = 6;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, 2 * Math.PI);
            ctx.fillStyle = HEALTH_COLOR[n.health] ?? "#888";
            ctx.fill();
            if (globalScale > 1.5) {
              ctx.font = `${10 / globalScale}px sans-serif`;
              ctx.fillStyle = "var(--text-primary)";
              ctx.textAlign = "center";
              ctx.fillText(n.label, x, y - r - 2);
            }
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--ready)" }}>● Healthy</span>
        <span style={{ fontSize: 11, color: "var(--needs-clarification)" }}>● At-Risk / Cross-team</span>
        <span style={{ fontSize: 11, color: "var(--blocked)" }}>● Blocked</span>
      </div>
    </div>
  );
}

// ─── 4.4  Epic Detail Drawer ───────────────────────────────────────────────

function EpicDrawer({
  projectKey,
  epicKey,
  onClose,
}: {
  projectKey: string;
  epicKey: string;
  onClose: () => void;
}) {
  const { data: epic, isLoading } = useEpic(projectKey, epicKey);

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
      background: "var(--glass-bg)",
      backdropFilter: "var(--glass-blur)",
      WebkitBackdropFilter: "var(--glass-blur)",
      borderLeft: "1px solid var(--glass-border)",
      zIndex: 200,
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,0.2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", borderBottom: "1px solid var(--glass-border)" }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{epicKey}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none",
          color: "var(--text-secondary)", cursor: "pointer", fontSize: 18 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {isLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>}
        {epic && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{epic.summary}</p>
              {epic.description && (
                <p style={{ margin: "8px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
                  {epic.description}
                </p>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <GlassBadge variant={healthVariant(epic.health_label)}>
                {epic.health_label}
              </GlassBadge>
              <GlassBadge variant="neutral">{epic.status}</GlassBadge>
              <GlassBadge variant="neutral">Health {epic.health_score.toFixed(0)}%</GlassBadge>
            </div>

            {epic.rice_score && (
              <GlassCard>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  RICE Score
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {(["reach", "impact", "confidence", "effort", "score"] as const).map((k) => (
                    <div key={k}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>{k}</span>
                      <br />
                      <strong style={{ fontSize: 15 }}>{epic.rice_score![k].toFixed(1)}</strong>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {epic.ice_score && (
              <GlassCard>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  ICE Score
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {(["impact", "confidence", "ease", "score"] as const).map((k) => (
                    <div key={k}>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "uppercase" }}>{k}</span>
                      <br />
                      <strong style={{ fontSize: 15 }}>{epic.ice_score![k].toFixed(1)}</strong>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {epic.child_keys.length > 0 && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  CHILD TICKETS ({epic.child_keys.length})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {epic.child_keys.map((k) => (
                    <code key={k} style={{
                      fontSize: 11, padding: "3px 8px",
                      background: "var(--surface-2)", borderRadius: 4,
                      color: "var(--text-primary)",
                    }}>{k}</code>
                  ))}
                </div>
              </div>
            )}

            {epic.linked_epic_keys.length > 0 && (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                  LINKED EPICS
                </p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {epic.linked_epic_keys.map((k) => (
                    <GlassBadge key={k} variant="neutral">{k}</GlassBadge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────

export default function RoadmapPanel() {
  const projectKey = useSettingsStore((s) => (s as any).jiraProjectKey ?? null);
  const activeTab = useRoadmapStore((s) => s.activeTab);
  const setActiveTab = useRoadmapStore((s) => s.setActiveTab);
  const drawerEpicKey = useRoadmapStore((s) => s.drawerEpicKey);
  const openDrawer = useRoadmapStore((s) => s.openDrawer);
  const closeDrawer = useRoadmapStore((s) => s.closeDrawer);

  const { data: snapshot, isLoading, error } = useRoadmap(projectKey);
  const { data: milestones = [] } = useMilestones(projectKey);
  const { data: deps = [] } = useDependencies(projectKey);
  const refresh = useRefreshRoadmap(projectKey ?? "");
  const push = useToastStore((s) => s.push);

  const epics = snapshot?.epics ?? [];
  const warnings = snapshot?.warnings ?? [];

  async function handleRefresh() {
    try {
      await refresh.mutateAsync();
      push("Roadmap refreshed", "success");
    } catch (e) {
      push(String(e), "error");
    }
  }

  return (
    <GlassPanel>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>🗺 Roadmap</h2>
          {projectKey && (
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
              Project: <code>{projectKey}</code>
              {snapshot && (
                <> · Generated {new Date(snapshot.generated_at).toLocaleString()}</>
              )}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refresh.isPending || !projectKey}
          style={{
            padding: "8px 18px", borderRadius: 8,
            background: "var(--surface-2)", border: "1px solid var(--glass-border)",
            color: "var(--text-primary)", cursor: "pointer", fontSize: 13,
          }}
        >
          {refresh.isPending ? "Refreshing…" : "⟳ Refresh"}
        </button>
      </div>

      {!projectKey && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          Configure a Jira project key in Settings to load the roadmap.
        </p>
      )}

      {isLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading roadmap…</p>}
      {error && <p style={{ color: "var(--blocked)", fontSize: 13 }}>Error: {String(error)}</p>}

      {warnings.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {warnings.map((w, i) => (
            <GlassBadge key={i} variant="needs_clarification">⚠ {w}</GlassBadge>
          ))}
        </div>
      )}

      {projectKey && !isLoading && (
        <>
          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === "timeline" && (
            <TimelineView
              milestones={milestones}
              epics={epics}
              deps={deps}
              onEpicClick={openDrawer}
            />
          )}

          {activeTab === "rice" && (
            <RICETableView epics={epics} projectKey={projectKey} />
          )}

          {activeTab === "graph" && (
            <DependencyGraphView
              epics={epics}
              deps={deps}
              warnings={warnings}
              onNodeClick={openDrawer}
            />
          )}
        </>
      )}

      {/* Epic Drawer */}
      {drawerEpicKey && projectKey && (
        <EpicDrawer
          projectKey={projectKey}
          epicKey={drawerEpicKey}
          onClose={closeDrawer}
        />
      )}
    </GlassPanel>
  );
}
