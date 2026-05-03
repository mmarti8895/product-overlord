/**
 * OutcomePanel (tasks 6.3, 6.4)
 *
 * Three sub-views:
 *   6.3a  OKR Tab — list with progress bars, "Add OKR", "Link to Epic"
 *   6.3b  Outcome Snapshot Tab — OKR delta cards, flag adoption sparklines, reflection editor
 *   6.3c  Unmatched Metrics expandable section
 */

import { useState } from "react";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useOutcomeStore } from "../stores/outcomeStore.js";
import { useOKRs, useOutcomeSnapshot, useCreateOKR, useLinkEpicToOKR, usePatchSnapshotNotes } from "../api/useOutcomes.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import type { OKR, KeyResult, OKRDelta, FlagAdoption } from "../types/outcomes.js";

type Tab = "okrs" | "snapshot";
const TABS: { id: Tab; label: string }[] = [
  { id: "okrs",     label: "🎯 OKRs" },
  { id: "snapshot", label: "📸 Outcome Snapshot" },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, target > 0 ? (current / target) * 100 : 0);
  const color = pct >= 100 ? "var(--ready)" : pct >= 60 ? "var(--needs-clarification)" : "var(--blocked)";
  return (
    <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3,
        transition: "width 0.4s ease" }} />
    </div>
  );
}

// ─── OKR Tab ──────────────────────────────────────────────────────────────

function OKRsTab() {
  const { data: okrs = [], isLoading } = useOKRs();
  const create = useCreateOKR();
  const push = useToastStore((s) => s.push);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", quarter: "" });
  const [linkEpicInput, setLinkEpicInput] = useState<Record<string, string>>({});
  const selectedOKRId = useOutcomeStore((s) => s.selectedOKRId);
  const selectOKR = useOutcomeStore((s) => s.selectOKR);

  async function handleCreate() {
    try {
      await create.mutateAsync(form);
      push("OKR created", "success");
      setShowForm(false);
      setForm({ title: "", quarter: "" });
    } catch { push("Failed to create OKR", "error"); }
  }

  if (isLoading) return <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {okrs.map((okr) => (
        <OKRCard
          key={okr.id} okr={okr}
          selected={selectedOKRId === okr.id}
          onSelect={() => selectOKR(selectedOKRId === okr.id ? null : okr.id)}
          linkInput={linkEpicInput[okr.id] ?? ""}
          onLinkInputChange={(v) => setLinkEpicInput((p) => ({ ...p, [okr.id]: v }))}
          push={push}
        />
      ))}

      {okrs.length === 0 && !showForm && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No OKRs yet.</p>
      )}

      {showForm ? (
        <GlassCard>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="OKR title" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              style={{ padding: "6px 10px", background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                color: "var(--text-primary)", fontSize: 13 }} />
            <input placeholder="Quarter (e.g. Q3 2026)" value={form.quarter}
              onChange={(e) => setForm((f) => ({ ...f, quarter: e.target.value }))}
              style={{ padding: "6px 10px", background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                color: "var(--text-primary)", fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCreate} disabled={create.isPending}
                style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
                  border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer", fontSize: 12 }}>
                {create.isPending ? "Creating…" : "Create OKR"}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ padding: "6px 14px", borderRadius: 6, background: "none",
                  border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </div>
        </GlassCard>
      ) : (
        <button onClick={() => setShowForm(true)}
          style={{ padding: "8px 18px", borderRadius: 8, alignSelf: "flex-start",
            background: "var(--surface-2)", border: "1px solid var(--glass-border)",
            color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          + Add OKR
        </button>
      )}
    </div>
  );
}

function OKRCard({
  okr, selected, onSelect, linkInput, onLinkInputChange, push,
}: {
  okr: OKR;
  selected: boolean;
  onSelect: () => void;
  linkInput: string;
  onLinkInputChange: (v: string) => void;
  push: (m: string, v?: "info"|"success"|"warn"|"error") => void;
}) {
  const link = useLinkEpicToOKR(okr.id);

  async function handleLink() {
    if (!linkInput.trim()) return;
    try {
      await link.mutateAsync(linkInput.trim());
      push(`Linked ${linkInput.trim()} to OKR`, "success");
      onLinkInputChange("");
    } catch { push("Failed to link", "error"); }
  }

  return (
    <GlassCard style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }} onClick={onSelect}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{okr.title}</p>
          <GlassBadge variant="neutral" style={{ marginTop: 4 }}>{okr.quarter}</GlassBadge>
        </div>
        <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{selected ? "▲" : "▼"}</span>
      </div>

      {/* Key Results */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {okr.key_results.map((kr: KeyResult) => (
          <div key={kr.id}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>{kr.title}</span>
              <span style={{ color: "var(--text-secondary)" }}>{kr.current} / {kr.target} {kr.unit}</span>
            </div>
            <ProgressBar current={kr.current} target={kr.target} />
          </div>
        ))}
        {okr.key_results.length === 0 && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>No key results defined.</p>
        )}
      </div>

      {/* Linked epics + Link form */}
      {selected && (
        <div>
          {okr.linked_epic_keys.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {okr.linked_epic_keys.map((k) => (
                <GlassBadge key={k} variant="neutral">{k}</GlassBadge>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="Epic key (e.g. PROJ-42)"
              value={linkInput}
              onChange={(e) => onLinkInputChange(e.target.value)}
              style={{ flex: 1, padding: "5px 10px", background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                color: "var(--text-primary)", fontSize: 12 }}
            />
            <button onClick={handleLink} disabled={link.isPending}
              style={{ padding: "5px 12px", borderRadius: 6, background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 12 }}>
              Link
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

// ─── Snapshot Tab ──────────────────────────────────────────────────────────

function FlagSparkline({ trend }: { trend: number[] }) {
  if (trend.length === 0) return null;
  const max = Math.max(...trend, 1);
  const W = 100, H = 28;
  const pts = trend.map((v, i) => `${(i / (trend.length - 1)) * W},${H - (v / max) * H}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke="var(--ready)" strokeWidth={1.5} />
    </svg>
  );
}

function SnapshotTab() {
  const selectedEpicKey = useOutcomeStore((s) => s.selectedEpicKey);
  const selectEpic = useOutcomeStore((s) => s.selectEpic);
  const { data: snap, isLoading } = useOutcomeSnapshot(selectedEpicKey);
  const patchNotes = usePatchSnapshotNotes(selectedEpicKey ?? "");
  const push = useToastStore((s) => s.push);
  const [epicInput, setEpicInput] = useState(selectedEpicKey ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");

  async function handleSaveNotes() {
    try {
      await patchNotes.mutateAsync(notes);
      push("Notes saved", "success");
      setEditingNotes(false);
    } catch { push("Failed to save notes", "error"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Epic key (e.g. PROJ-1)"
          value={epicInput}
          onChange={(e) => setEpicInput(e.target.value)}
          style={{ flex: 1, padding: "6px 10px", background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", borderRadius: 6,
            color: "var(--text-primary)", fontSize: 13 }} />
        <button onClick={() => selectEpic(epicInput.trim() || null)}
          style={{ padding: "6px 16px", borderRadius: 6, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          Load
        </button>
      </div>

      {isLoading && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Loading snapshot…</p>}
      {!selectedEpicKey && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Enter an epic key to view its outcome snapshot.</p>}
      {selectedEpicKey && !snap && !isLoading && (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No snapshot for {selectedEpicKey} yet.</p>
      )}

      {snap && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <GlassBadge variant={snap.status === "reviewed" ? "ready" : "neutral"}>{snap.status}</GlassBadge>
            <GlassBadge variant="neutral">Shipped {new Date(snap.ship_date).toLocaleDateString()}</GlassBadge>
          </div>

          {/* OKR Deltas */}
          {snap.okr_deltas.length > 0 && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>OKR DELTAS</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {snap.okr_deltas.map((d: OKRDelta) => (
                  <GlassCard key={`${d.okr_id}-${d.kr_id}`}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-secondary)" }}>{d.kr_id}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                      <span style={{ fontSize: 13 }}>{d.before} → {d.after}</span>
                      <span style={{ fontWeight: 700, color: d.delta >= 0 ? "var(--ready)" : "var(--blocked)" }}>
                        {d.delta >= 0 ? "+" : ""}{d.delta}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Flag Adoption */}
          {snap.flag_adoption.length > 0 && (
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>FLAG ADOPTION</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {snap.flag_adoption.map((f: FlagAdoption) => (
                  <GlassCard key={f.flag_key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{f.flag_key}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                        {f.on_percentage.toFixed(1)}% on · {f.evaluations_7d.toLocaleString()} evals / 7d
                      </p>
                    </div>
                    <FlagSparkline trend={f.trend} />
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Reflection */}
          <GlassCard>
            <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>REFLECTION</p>
            {editingNotes ? (
              <>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  style={{ width: "100%", padding: "8px 10px", background: "var(--surface-2)",
                    border: "1px solid var(--glass-border)", borderRadius: 6,
                    color: "var(--text-primary)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={handleSaveNotes} disabled={patchNotes.isPending}
                    style={{ padding: "6px 14px", borderRadius: 6, background: "var(--ready-bg)",
                      border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer", fontSize: 12 }}>
                    {patchNotes.isPending ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditingNotes(false)}
                    style={{ padding: "6px 14px", borderRadius: 6, background: "none",
                      border: "1px solid var(--glass-border)", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div>
                <p style={{ margin: "0 0 8px", fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {snap.reflection_notes ?? snap.reflection_draft ?? "No reflection drafted yet."}
                </p>
                <button onClick={() => { setNotes(snap.reflection_notes ?? snap.reflection_draft ?? ""); setEditingNotes(true); }}
                  style={{ padding: "5px 12px", borderRadius: 6, background: "var(--surface-2)",
                    border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 12 }}>
                  ✏ Edit
                </button>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────

export default function OutcomePanel() {
  const [tab, setTab] = useState<Tab>("okrs");

  return (
    <GlassPanel>
      <h2 style={{ margin: "0 0 20px", fontSize: 20 }}>🎯 Outcomes</h2>

      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "6px 16px", borderRadius: 8, border: "1px solid var(--glass-border)",
              background: tab === t.id ? "var(--surface-2)" : "transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "okrs"     && <OKRsTab />}
      {tab === "snapshot" && <SnapshotTab />}
    </GlassPanel>
  );
}
