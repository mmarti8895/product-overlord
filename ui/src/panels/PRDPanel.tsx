/**
 * PRDPanel (tasks 4.3–4.4)
 *
 * Three states:
 *   A — No draft:     ticket input, doc type selector, "Generate" button
 *   B — Draft ready:  section editor, RAG sources sidebar, "Approve" button
 *   C — Approved:     "Preview Confluence Diff" → modal with diff, "Publish" button
 *
 * Plus version history list at bottom.
 */

import { useState } from "react";
import { GlassPanel, GlassCard } from "../components/glass/GlassPanel.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { usePRDStore } from "../stores/prdStore.js";
import {
  usePRDDrafts, usePRDDiff,
  useGenerateDraft, useApproveDraft, usePublishDraft,
} from "../api/usePRD.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import type { DocumentType, PRDDraft } from "../types/prd.js";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "prd",          label: "PRD" },
  { value: "one-pager",    label: "One-Pager" },
  { value: "release-note", label: "Release Note" },
];

// ─── State A — No draft ────────────────────────────────────────────────────

function NoDraftState({
  ticketKey, setTicketKey,
  docType, setDocType,
  onGenerate, isGenerating,
}: {
  ticketKey: string; setTicketKey: (v: string) => void;
  docType: DocumentType; setDocType: (v: DocumentType) => void;
  onGenerate: () => void; isGenerating: boolean;
}) {
  return (
    <div style={{ maxWidth: 440, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>TICKET KEY</label>
        <input
          placeholder="e.g. PROJ-42"
          value={ticketKey}
          onChange={(e) => setTicketKey(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 12px",
            background: "var(--surface-2)", border: "1px solid var(--glass-border)",
            borderRadius: 6, color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box" }}
        />
      </div>
      <div>
        <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>DOCUMENT TYPE</label>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {DOC_TYPES.map((dt) => (
            <button key={dt.value} onClick={() => setDocType(dt.value)}
              style={{ padding: "6px 14px", borderRadius: 6,
                background: docType === dt.value ? "var(--surface-2)" : "transparent",
                border: `1px solid ${docType === dt.value ? "var(--text-primary)" : "var(--glass-border)"}`,
                color: docType === dt.value ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer", fontSize: 13 }}>
              {dt.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={onGenerate}
        disabled={!ticketKey.trim() || isGenerating}
        style={{ padding: "10px 24px", borderRadius: 8, alignSelf: "flex-start",
          background: "var(--ready-bg)", border: "1px solid var(--ready)",
          color: "var(--ready)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
        {isGenerating ? "Generating…" : "✨ Generate Draft"}
      </button>
    </div>
  );
}

// ─── State B — Draft ready ─────────────────────────────────────────────────

function DraftEditorState({
  draft, onApprove, isApproving,
}: {
  draft: PRDDraft; ticketKey: string; onApprove: () => void; isApproving: boolean;
}) {
  const editSection = usePRDStore((s) => s.editSection);
  const activeDraft = usePRDStore((s) => s.activeDraft) ?? draft;
  const [showSources, setShowSources] = useState(true);

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {/* Section editor */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassBadge variant="neutral">v{draft.version}</GlassBadge>
            <GlassBadge variant="neutral">{draft.doc_type}</GlassBadge>
            <GlassBadge variant="needs_clarification">draft</GlassBadge>
          </div>
          <button onClick={onApprove} disabled={isApproving}
            style={{ padding: "8px 20px", borderRadius: 8, background: "var(--ready-bg)",
              border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {isApproving ? "Approving…" : "✓ Approve"}
          </button>
        </div>

        {activeDraft.content.sections.map((sec) => (
          <div key={sec.heading}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: 1 }}>
              {sec.heading}
            </label>
            <textarea
              value={sec.content}
              onChange={(e) => editSection(sec.heading, e.target.value)}
              rows={6}
              style={{ display: "block", width: "100%", marginTop: 6,
                padding: "8px 12px", background: "var(--surface-2)",
                border: "1px solid var(--glass-border)", borderRadius: 6,
                color: "var(--text-primary)", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
            />
          </div>
        ))}
      </div>

      {/* RAG Sources sidebar */}
      <div style={{ width: 260 }}>
        <button onClick={() => setShowSources((v) => !v)}
          style={{ background: "none", border: "none", color: "var(--text-secondary)",
            cursor: "pointer", fontSize: 13, marginBottom: 8 }}>
          {showSources ? "▲" : "▼"} RAG Sources ({draft.rag_sources.length})
        </button>
        {showSources && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draft.rag_sources.map((s) => (
              <GlassCard key={s.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{s.title}</span>
                  <GlassBadge variant="neutral" style={{ fontSize: 10 }}>{s.score.toFixed(2)}</GlassBadge>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.source}</span>
                <p style={{ margin: 0, fontSize: 11, color: "var(--text-secondary)",
                  overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box",
                  WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                  {s.snippet}
                </p>
              </GlassCard>
            ))}
            {draft.rag_sources.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--blocked)" }}>No RAG sources found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── State C — Approved ────────────────────────────────────────────────────

function ApprovedState({
  draft, ticketKey,
}: {
  draft: PRDDraft; ticketKey: string;
}) {
  const [showDiffModal, setShowDiffModal] = useState(false);
  const { data: diff } = usePRDDiff(ticketKey, draft.id);
  const publish = usePublishDraft(ticketKey, draft.id);
  const push = useToastStore((s) => s.push);

  async function handlePublish() {
    try {
      const updated = await publish.mutateAsync();
      push(
        updated.confluence_url ? `Published: ${updated.confluence_url}` : "Published to Confluence",
        "success",
      );
      setShowDiffModal(false);
    } catch { push("Publish failed", "error"); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <GlassBadge variant="ready">approved</GlassBadge>
        <GlassBadge variant="neutral">v{draft.version}</GlassBadge>
        <button onClick={() => setShowDiffModal(true)}
          style={{ padding: "6px 16px", borderRadius: 8, background: "var(--surface-2)",
            border: "1px solid var(--glass-border)", color: "var(--text-primary)", cursor: "pointer", fontSize: 13 }}>
          🔍 Preview Confluence Diff
        </button>
      </div>

      {/* Content preview (read-only) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.content.sections.map((sec) => (
          <GlassCard key={sec.heading}>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
              textTransform: "uppercase", letterSpacing: 1 }}>
              {sec.heading}
            </p>
            <p style={{ margin: 0, fontSize: 13, whiteSpace: "pre-wrap" }}>{sec.content}</p>
          </GlassCard>
        ))}
      </div>

      {/* Diff + Publish Modal */}
      {showDiffModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="glass" style={{ padding: 24, borderRadius: 12, width: 700, maxHeight: "80vh",
            overflow: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Confluence Diff</h3>
              <button onClick={() => setShowDiffModal(false)}
                style={{ background: "none", border: "none", color: "var(--text-secondary)",
                  cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>

            {!diff && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No existing Confluence page — this will create a new page.</p>}

            {diff && diff.sections.map((s) => (
              <div key={s.heading} style={{ borderBottom: "1px solid var(--glass-border)", paddingBottom: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {s.heading}
                  {s.added && <GlassBadge variant="ready" style={{ marginLeft: 8, fontSize: 10 }}>NEW</GlassBadge>}
                  {s.changed && !s.added && <GlassBadge variant="needs_clarification" style={{ marginLeft: 8, fontSize: 10 }}>CHANGED</GlassBadge>}
                </p>
                {s.old && (
                  <pre style={{ margin: "0 0 6px", background: "rgba(255,80,80,0.08)",
                    padding: "6px 10px", borderRadius: 4, fontSize: 12,
                    whiteSpace: "pre-wrap", color: "var(--blocked)" }}>
                    - {s.old}
                  </pre>
                )}
                <pre style={{ margin: 0, background: "rgba(80,255,80,0.08)",
                  padding: "6px 10px", borderRadius: 4, fontSize: 12,
                  whiteSpace: "pre-wrap", color: "var(--ready)" }}>
                  + {s.new}
                </pre>
              </div>
            ))}

            <button onClick={handlePublish} disabled={publish.isPending}
              style={{ alignSelf: "flex-end", padding: "8px 24px", borderRadius: 8, background: "var(--ready-bg)",
                border: "1px solid var(--ready)", color: "var(--ready)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
              {publish.isPending ? "Publishing…" : "📤 Publish to Confluence"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Version History ───────────────────────────────────────────────────────

function VersionHistory({
  drafts, activeDraftId, onSelect,
}: {
  drafts: PRDDraft[]; activeDraftId: string | null; onSelect: (d: PRDDraft) => void;
}) {
  if (drafts.length <= 1) return null;

  const VARIANT = { draft: "neutral", approved: "ready", published: "ok" } as const;

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
        VERSION HISTORY
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...drafts].sort((a, b) => b.version - a.version).map((d) => (
          <GlassCard
            key={d.id}
            style={{ display: "flex", justifyContent: "space-between", cursor: "pointer",
              opacity: activeDraftId === d.id ? 1 : 0.7 }}
            onClick={() => onSelect(d)}
          >
            <span style={{ fontSize: 13 }}>v{d.version} · {d.doc_type}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <GlassBadge variant={VARIANT[d.status]}>{d.status}</GlassBadge>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {new Date(d.updated_at).toLocaleDateString()}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ────────────────────────────────────────────────────────────

export default function PRDPanel() {
  const [ticketKey, setTicketKey] = useState("");
  const [docType, setDocType] = useState<DocumentType>("prd");
  const [loadedTicket, setLoadedTicket] = useState<string | null>(null);
  const activeDraft = usePRDStore((s) => s.activeDraft);
  const setActiveDraft = usePRDStore((s) => s.setActiveDraft);
  const push = useToastStore((s) => s.push);
  const generate = useGenerateDraft();

  const { data: drafts = [] } = usePRDDrafts(loadedTicket);
  const latestDraft = drafts.length > 0
    ? [...drafts].sort((a, b) => b.version - a.version)[0]
    : null;
  const displayDraft = activeDraft ?? latestDraft;

  const approve = useApproveDraft(loadedTicket ?? "", displayDraft?.id ?? "");

  async function handleGenerate() {
    try {
      const draft = await generate.mutateAsync({ ticket_key: ticketKey.trim(), doc_type: docType });
      setLoadedTicket(ticketKey.trim());
      setActiveDraft(draft);
      push("Draft generated", "success");
    } catch (e) { push(String(e), "error"); }
  }

  async function handleApprove() {
    try {
      const updated = await approve.mutateAsync();
      setActiveDraft(updated);
      push("Draft approved", "success");
    } catch { push("Approval failed", "error"); }
  }

  const state = !displayDraft ? "none"
    : displayDraft.status === "draft" ? "draft"
    : "approved";

  return (
    <GlassPanel>
      <h2 style={{ margin: "0 0 24px", fontSize: 20 }}>📝 PRD Generator</h2>

      {state === "none" && (
        <NoDraftState
          ticketKey={ticketKey} setTicketKey={setTicketKey}
          docType={docType} setDocType={setDocType}
          onGenerate={handleGenerate} isGenerating={generate.isPending}
        />
      )}

      {state === "draft" && displayDraft && loadedTicket && (
        <DraftEditorState
          draft={displayDraft}
          ticketKey={loadedTicket}
          onApprove={handleApprove}
          isApproving={approve.isPending}
        />
      )}

      {state === "approved" && displayDraft && loadedTicket && (
        <ApprovedState draft={displayDraft} ticketKey={loadedTicket} />
      )}

      {loadedTicket && (
        <VersionHistory
          drafts={drafts}
          activeDraftId={activeDraft?.id ?? null}
          onSelect={setActiveDraft}
        />
      )}

      {/* Reset link */}
      {loadedTicket && (
        <button
          onClick={() => { setLoadedTicket(null); setActiveDraft(null); setTicketKey(""); }}
          style={{ marginTop: 16, background: "none", border: "none",
            color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>
          ← Start over
        </button>
      )}
    </GlassPanel>
  );
}
