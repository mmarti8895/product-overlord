/**
 * AgentBuilderModal — 4-step wizard for creating a custom agent.
 *
 * Steps:
 *   1. Identity   — name, description, role tag
 *   2. Persona    — textarea → SOUL.md scaffold preview
 *   3. Skills     — multi-select from capability registry + free-text chips
 *   4. Config     — concurrency, RPM/TPM caps, retry policy
 *
 * Right side shows a live file-tree preview of the three generated files.
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassButton } from "../components/glass/GlassButton.js";
import { useCreateAgent } from "../api/queries/agentHooks.js";
import { useToastStore } from "../components/glass/GlassToast.js";
import { useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentRole = "planner" | "executor" | "reviewer" | "orchestrator";
type RetryPolicy = "none" | "exponential" | "fixed";

interface AgentDraft {
  name: string;
  description: string;
  role: AgentRole;
  persona: string;
  skills: string[];
  maxConcurrency: number;
  rpmCap: number;
  tpmCap: number;
  retryPolicy: RetryPolicy;
}

const DEFAULT_DRAFT: AgentDraft = {
  name: "",
  description: "",
  role: "executor",
  persona: "",
  skills: [],
  maxConcurrency: 3,
  rpmCap: 60,
  tpmCap: 100_000,
  retryPolicy: "exponential",
};

// ---------------------------------------------------------------------------
// Built-in capability registry (mirrors data/agents/capabilities.json shape)
// ---------------------------------------------------------------------------

const CAPABILITY_REGISTRY: { id: string; label: string; category: string }[] = [
  { id: "jira_read",       label: "Jira — Read Issues",        category: "Connections" },
  { id: "jira_write",      label: "Jira — Write Issues",       category: "Connections" },
  { id: "github_read",     label: "GitHub — Read Repos",       category: "Connections" },
  { id: "github_write",    label: "GitHub — Write PRs",        category: "Connections" },
  { id: "openai_chat",     label: "OpenAI — Chat Completion",  category: "LLM" },
  { id: "openai_embed",    label: "OpenAI — Embeddings",       category: "LLM" },
  { id: "lancedb_upsert",  label: "LanceDB — Upsert Vectors",  category: "Knowledge" },
  { id: "lancedb_search",  label: "LanceDB — Vector Search",   category: "Knowledge" },
  { id: "crawl_docs",      label: "Crawl — Documentation",     category: "Ingestion" },
  { id: "normalise",       label: "Normalise — Markdown",      category: "Ingestion" },
  { id: "decision_gate",   label: "Decision Gate",             category: "Orchestration" },
  { id: "sub_agent_spawn", label: "Spawn Sub-Agents",          category: "Orchestration" },
  { id: "rag_search",      label: "RAG — Context Search",      category: "RAG" },
  { id: "eval_run",        label: "Eval — Run Gold-Set",       category: "Eval" },
  { id: "forge_draft",     label: "Forge — Draft Comment",     category: "Output" },
];

// ---------------------------------------------------------------------------
// Preview generators
// ---------------------------------------------------------------------------

function genAgentsMd(d: AgentDraft) {
  return `# ${d.name || "<name>"}

## Role
${d.role}

## Description
${d.description || "<description>"}

## Parallelization
- Max concurrency: ${d.maxConcurrency}
- RPM cap: ${d.rpmCap}
- TPM cap: ${d.tpmCap}
- Retry policy: ${d.retryPolicy}
`;
}

function genSoulMd(d: AgentDraft) {
  return `# Soul — ${d.name || "<name>"}

${d.persona || "<persona — describe personality, tone, and decision-making style>"}
`;
}

function genSkillsMd(d: AgentDraft) {
  return `# Skills — ${d.name || "<name>"}

${d.skills.length ? d.skills.map(s => `- ${s}`).join("\n") : "- <no skills selected>"}
`;
}

// ---------------------------------------------------------------------------
// Step sub-components
// ---------------------------------------------------------------------------

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "var(--text-primary)",
    fontSize: 13,
    boxSizing: "border-box",
  };
}

function label(text: string) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {text}
    </div>
  );
}

// --- Step 1: Identity ---

function StepIdentity({ draft, setDraft }: { draft: AgentDraft; setDraft: React.Dispatch<React.SetStateAction<AgentDraft>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        {label("Agent name")}
        <input
          style={inputStyle()}
          value={draft.name}
          placeholder="e.g. jira-analyst"
          onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
        />
      </div>
      <div>
        {label("Description")}
        <textarea
          style={{ ...inputStyle(), minHeight: 72, resize: "vertical" }}
          value={draft.description}
          placeholder="What does this agent do?"
          onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
        />
      </div>
      <div>
        {label("Role")}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["planner", "executor", "reviewer", "orchestrator"] as AgentRole[]).map(r => (
            <button
              key={r}
              onClick={() => setDraft(d => ({ ...d, role: r }))}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid var(--glass-border)",
                background: draft.role === r ? "var(--accent)" : "var(--glass-bg)",
                color: draft.role === r ? "#fff" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Step 2: Persona ---

function StepPersona({ draft, setDraft }: { draft: AgentDraft; setDraft: React.Dispatch<React.SetStateAction<AgentDraft>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {label("Persona (SOUL.md)")}
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
        Describe the agent's personality, communication tone, and how it handles ambiguity.
        This becomes the contents of <code>SOUL.md</code>.
      </p>
      <textarea
        style={{ ...inputStyle(), minHeight: 180, resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
        value={draft.persona}
        placeholder={`You are a meticulous Jira analyst.\nYou prefer asking one clarifying question at a time.\nYou never make assumptions about scope.`}
        onChange={e => setDraft(d => ({ ...d, persona: e.target.value }))}
      />
    </div>
  );
}

// --- Step 3: Skills ---

function SkillChip({ id, label: text, selected, onToggle }: { id: string; label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: "4px 10px",
        borderRadius: 14,
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${selected ? "var(--accent)" : "var(--glass-border)"}`,
        background: selected ? "var(--accent)" : "transparent",
        color: selected ? "#fff" : "var(--text-secondary)",
        cursor: "pointer",
        transition: "background 0.12s, color 0.12s, border-color 0.12s",
      }}
      title={id}
    >
      {text}
    </button>
  );
}

function StepSkills({ draft, setDraft }: { draft: AgentDraft; setDraft: React.Dispatch<React.SetStateAction<AgentDraft>> }) {
  const [freeText, setFreeText] = useState("");
  const categories = useMemo(() => {
    const map = new Map<string, typeof CAPABILITY_REGISTRY>();
    for (const cap of CAPABILITY_REGISTRY) {
      if (!map.has(cap.category)) map.set(cap.category, []);
      map.get(cap.category)!.push(cap);
    }
    return map;
  }, []);

  function toggleCap(id: string) {
    setDraft(d => ({
      ...d,
      skills: d.skills.includes(id) ? d.skills.filter(s => s !== id) : [...d.skills, id],
    }));
  }

  function addFreeText() {
    const trimmed = freeText.trim();
    if (trimmed && !draft.skills.includes(trimmed)) {
      setDraft(d => ({ ...d, skills: [...d.skills, trimmed] }));
    }
    setFreeText("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Array.from(categories.entries()).map(([cat, caps]) => (
        <div key={cat}>
          {label(cat)}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {caps.map(c => (
              <SkillChip
                key={c.id}
                id={c.id}
                label={c.label}
                selected={draft.skills.includes(c.id)}
                onToggle={() => toggleCap(c.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <div>
        {label("Custom skill")}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={{ ...inputStyle(), flex: 1 }}
            value={freeText}
            placeholder="e.g. send_slack_message"
            onChange={e => setFreeText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFreeText(); } }}
          />
          <GlassButton variant="secondary" onClick={addFreeText} style={{ fontSize: 12, whiteSpace: "nowrap" }}>+ Add</GlassButton>
        </div>
      </div>
    </div>
  );
}

// --- Step 4: Config ---

function StepConfig({ draft, setDraft }: { draft: AgentDraft; setDraft: React.Dispatch<React.SetStateAction<AgentDraft>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        {label(`Max concurrency — ${draft.maxConcurrency}`)}
        <input
          type="range" min={1} max={20}
          value={draft.maxConcurrency}
          onChange={e => setDraft(d => ({ ...d, maxConcurrency: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "var(--accent)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
          <span>1 (sequential)</span><span>20 (max parallel)</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          {label("RPM cap")}
          <input
            type="number" min={1} max={10000}
            style={inputStyle()}
            value={draft.rpmCap}
            onChange={e => setDraft(d => ({ ...d, rpmCap: Number(e.target.value) }))}
          />
        </div>
        <div>
          {label("TPM cap")}
          <input
            type="number" min={1000} max={2_000_000} step={1000}
            style={inputStyle()}
            value={draft.tpmCap}
            onChange={e => setDraft(d => ({ ...d, tpmCap: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div>
        {label("Retry policy")}
        <div style={{ display: "flex", gap: 8 }}>
          {(["none", "fixed", "exponential"] as RetryPolicy[]).map(p => (
            <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, color: "var(--text-primary)" }}>
              <input
                type="radio"
                name="retryPolicy"
                value={p}
                checked={draft.retryPolicy === p}
                onChange={() => setDraft(d => ({ ...d, retryPolicy: p }))}
                style={{ accentColor: "var(--accent)" }}
              />
              {p}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File preview panel
// ---------------------------------------------------------------------------

function FilePreview({ draft }: { draft: AgentDraft }) {
  const [active, setActive] = useState<"AGENTS.md" | "SOUL.md" | "SKILLS.md">("AGENTS.md");
  const content = active === "AGENTS.md" ? genAgentsMd(draft)
    : active === "SOUL.md" ? genSoulMd(draft)
    : genSkillsMd(draft);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        📁 agents/{draft.name || "<name>"}/
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["AGENTS.md", "SOUL.md", "SKILLS.md"] as const).map(f => (
          <button
            key={f}
            onClick={() => setActive(f)}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              borderRadius: 8,
              border: "1px solid var(--glass-border)",
              background: active === f ? "var(--accent)" : "transparent",
              color: active === f ? "#fff" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <pre style={{
        flex: 1,
        margin: 0,
        overflowY: "auto",
        background: "var(--surface-2)",
        borderRadius: 10,
        padding: "12px 14px",
        fontSize: 11,
        fontFamily: "monospace",
        color: "var(--text-primary)",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}>
        {content}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard shell
// ---------------------------------------------------------------------------

const STEPS = ["Identity", "Persona", "Skills", "Config"] as const;

interface AgentBuilderModalProps {
  open: boolean;
  onClose: () => void;
}

export function AgentBuilderModal({ open, onClose }: AgentBuilderModalProps) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AgentDraft>(DEFAULT_DRAFT);
  const createAgent = useCreateAgent();
  const toast = useToastStore();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDivElement>(null);

  // ── Focus trap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;

    // Move focus into dialog on open
    const firstFocusable = el.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const focusable = Array.from(
        el!.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function reset() {
    setStep(0);
    setDraft(DEFAULT_DRAFT);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function canAdvance() {
    if (step === 0) return draft.name.trim().length > 0 && draft.description.trim().length > 0;
    return true;
  }

  function handleCreate() {
    createAgent.mutate(
      {
        name: draft.name,
        description: draft.description,
        role: draft.role,
        persona: draft.persona,
        skills: draft.skills,
        maxConcurrency: draft.maxConcurrency,
        rpmCap: draft.rpmCap,
        tpmCap: draft.tpmCap,
        retryPolicy: draft.retryPolicy,
      },
      {
        onSuccess: () => {
          toast.push(`Agent "${draft.name}" created`, "success");
          handleClose();
          navigate("/agents/activity");
        },
        onError: (err) => {
          toast.push((err as Error).message ?? "Failed to create agent", "error");
        },
      }
    );
  }

  return (
    // We render a custom oversized modal so we can have a side-by-side layout.
    <AnimatePresence>
      {open && (
        <motion.div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            onClick={handleClose}
          />

          {/* Dialog */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Create Custom Agent"
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.88, opacity: 0, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            style={{
              position: "relative",
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              backdropFilter: "var(--glass-blur)",
              borderRadius: 20,
              width: "min(900px, 95vw)",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              padding: "18px 24px 14px",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>🤖 Create Custom Agent</span>

              {/* Step indicators */}
              <div style={{ display: "flex", gap: 6, marginLeft: "auto", alignItems: "center" }}>
                {STEPS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => { if (i < step || canAdvance()) setStep(i); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid var(--glass-border)",
                      background: i === step ? "var(--accent)" : i < step ? "var(--surface-2)" : "transparent",
                      color: i === step ? "#fff" : i < step ? "var(--text-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: i < step ? "var(--ready)" : i === step ? "rgba(255,255,255,0.25)" : "var(--glass-border)",
                      fontSize: 9, fontWeight: 800,
                    }}>
                      {i < step ? "✓" : i + 1}
                    </span>
                    {s}
                  </button>
                ))}
              </div>

              {/* Close */}
              <button
                onClick={handleClose}
                aria-label="Close"
                style={{
                  marginLeft: 8,
                  width: 26, height: 26,
                  borderRadius: "50%",
                  background: "var(--surface-2)",
                  color: "var(--text-secondary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Body — two-column */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
              {/* Left: form */}
              <div style={{ flex: "0 0 50%", padding: "20px 24px", overflowY: "auto", borderRight: "1px solid var(--glass-border)" }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                  >
                    {step === 0 && <StepIdentity draft={draft} setDraft={setDraft} />}
                    {step === 1 && <StepPersona draft={draft} setDraft={setDraft} />}
                    {step === 2 && <StepSkills draft={draft} setDraft={setDraft} />}
                    {step === 3 && <StepConfig draft={draft} setDraft={setDraft} />}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Right: file preview */}
              <div style={{ flex: "0 0 50%", padding: "20px 24px", overflowY: "auto" }}>
                <FilePreview draft={draft} />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}>
              <GlassButton variant="ghost" onClick={handleClose} style={{ fontSize: 13 }}>Cancel</GlassButton>

              <div style={{ display: "flex", gap: 8 }}>
                {step > 0 && (
                  <GlassButton variant="secondary" onClick={() => setStep(s => s - 1)} style={{ fontSize: 13 }}>← Back</GlassButton>
                )}
                {step < STEPS.length - 1 ? (
                  <GlassButton
                    variant="primary"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canAdvance()}
                    style={{ fontSize: 13 }}
                  >
                    Next →
                  </GlassButton>
                ) : (
                  <GlassButton
                    variant="primary"
                    onClick={handleCreate}
                    disabled={createAgent.isPending || !draft.name.trim()}
                    style={{ fontSize: 13 }}
                  >
                    {createAgent.isPending ? "Creating…" : "🚀 Create Agent"}
                  </GlassButton>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
