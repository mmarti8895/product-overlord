import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { JsonView, allExpanded, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { GlassButton } from "../components/glass/GlassButton.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import {
  useDecisionsStream,
  useApproveDecision,
  useRejectDecision,
  useModifyDecision,
} from "../api/queries/agentHooks.js";
import { useDecisionsStore, useDecisionsPendingCount } from "../stores/decisionsStore.js";
import type { Decision } from "../stores/decisionsStore.js";

function DecisionCard({ d }: { d: Decision }) {
  const [rejectReason, setRejectReason] = useState("");
  const [showModify, setShowModify] = useState(false);
  const [patchText, setPatchText] = useState("{}");
  const approve = useApproveDecision();
  const reject  = useRejectDecision();
  const modify  = useModifyDecision();

  const isPending = d.status === "pending";

  return (
    <div
      style={{
        border: "1px solid var(--glass-border)",
        borderRadius: 12,
        padding: 16,
        background: "var(--glass-bg)",
        display: "flex", flexDirection: "column", gap: 10,
      }}
      role="article"
      aria-label={`Decision from ${d.agent}, status: ${d.status}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{d.agent}</span>
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>{d.run_id.slice(0, 8)}</span>
        <GlassBadge variant={d.status === "approved" ? "ready" : d.status === "rejected" ? "blocked" : "neutral"} style={{ marginLeft: "auto", fontSize: 10 }}>
          {d.type}
        </GlassBadge>
        <GlassBadge variant={d.status === "approved" ? "ready" : d.status === "rejected" ? "blocked" : d.status === "modified" ? "degraded" : "neutral"} style={{ fontSize: 10 }}>
          {d.status}
        </GlassBadge>
      </div>

      <div style={{ maxHeight: 200, overflow: "auto", borderRadius: 8, fontSize: 12 }}>
        <JsonView data={d.payload as object} shouldExpandNode={allExpanded} style={defaultStyles} />
      </div>

      {isPending && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <GlassButton variant="primary" onClick={() => approve.mutate(d.id)} disabled={approve.isPending} style={{ fontSize: 12 }} aria-label="Approve this decision">✓ Approve</GlassButton>
            <GlassButton variant="danger" onClick={() => reject.mutate({ id: d.id, reason: rejectReason || undefined })} disabled={reject.isPending} style={{ fontSize: 12 }} aria-label="Reject this decision">✕ Reject</GlassButton>
            <GlassButton variant="secondary" onClick={() => setShowModify(v => !v)} style={{ fontSize: 12 }} aria-expanded={showModify} aria-controls={`modify-${d.id}`}>✎ Modify</GlassButton>
          </div>

          <input
            placeholder="Rejection reason (optional)"
            aria-label="Rejection reason"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "6px 10px", color: "var(--text-primary)", fontSize: 12 }}
          />

          {showModify && (
            <div id={`modify-${d.id}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <textarea
                value={patchText}
                onChange={e => setPatchText(e.target.value)}
                rows={4}
                aria-label="JSON patch for this decision"
                style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px", color: "var(--text-primary)", fontSize: 12, fontFamily: "monospace", resize: "vertical" }}
              />
              <GlassButton variant="secondary" onClick={() => { try { modify.mutate({ id: d.id, patch: JSON.parse(patchText) }); setShowModify(false); } catch { /* invalid json */ } }} style={{ fontSize: 12, alignSelf: "flex-start" }}>
                Apply Patch
              </GlassButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function DecisionReviewPanel() {
  useDecisionsStream();
  const decisions = useDecisionsStore(s => s.decisions);
  const pendingCount = useDecisionsPendingCount();
  const [showAll, setShowAll] = useState(false);

  const shown = showAll ? decisions : decisions.filter(d => d.status === "pending");

  return (
    <div role="region" aria-label="Decision Review" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
            Decision Review
            {pendingCount > 0 && (
              <span style={{ marginLeft: 10, background: "var(--warn)", color: "#000", borderRadius: 99, padding: "2px 8px", fontSize: 13 }}>{pendingCount}</span>
            )}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Approve, reject, or modify agent decisions before they are committed.
          </p>
        </div>
        <GlassButton variant="secondary" onClick={() => setShowAll(v => !v)} style={{ fontSize: 12 }}>
          {showAll ? "Pending only" : "Show all"}
        </GlassButton>
      </div>

      {shown.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
          {showAll ? "No decisions yet." : "No pending decisions. ✓"}
        </p>
      ) : (
        <div aria-live="polite" aria-label="Decision list">
          <AnimatePresence>
            {shown.map(d => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <DecisionCard d={d} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
