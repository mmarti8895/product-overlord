import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { clsx } from "clsx";
import { useDecisionsPendingCount } from "../../stores/decisionsStore.js";

interface NavGroup {
  label: string;
  items: { path: string; icon: string; label: string }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Core",
    items: [
      { path: "/ingestion",  icon: "⬇️",  label: "Ingestion" },
      { path: "/analysis",   icon: "🔍",  label: "Analysis" },
      { path: "/normaliser", icon: "🔀",  label: "Normaliser" },
      { path: "/evidence",   icon: "📂",  label: "Evidence" },
      { path: "/draft",      icon: "✏️",  label: "Draft" },
      { path: "/planning",   icon: "🗺️",  label: "Planning" },
      { path: "/repo",       icon: "🗂️",  label: "Repo" },
      { path: "/kb",         icon: "📚",  label: "Knowledge Base" },
      { path: "/llm",        icon: "🤖",  label: "LLM" },
      { path: "/rag",        icon: "🔗",  label: "RAG" },
      { path: "/eval",       icon: "📊",  label: "Eval" },
      { path: "/forge",      icon: "⚙️",  label: "Forge" },
      { path: "/logs",       icon: "📋",  label: "Logs" },
      { path: "/tests",      icon: "🧪",  label: "Test Runner" },
      { path: "/settings",   icon: "⚙️",  label: "Settings" },
      { path: "/devtools",   icon: "🛠️",  label: "Dev Tools" },
    ],
  },
  {
    label: "Connections",
    items: [
      { path: "/connections/jira",   icon: "🟦",  label: "Jira" },
      { path: "/connections/openai", icon: "🟢",  label: "OpenAI" },
      { path: "/connections/github", icon: "🐙",  label: "GitHub" },
    ],
  },
  {
    label: "Workflows",
    items: [
      { path: "/workflows/pipeline", icon: "🔄",  label: "Pipeline" },
      { path: "/workflows/schedule", icon: "🕐",  label: "Schedule" },
    ],
  },
  {
    label: "Agents",
    items: [
      { path: "/agents/activity",        icon: "📡",  label: "Activity Feed" },
      { path: "/agents/decisions",       icon: "⚖️",  label: "Decision Review" },
      { path: "/agents/orchestrator",    icon: "🔭",  label: "Orchestrator" },
    ],
  },
  {
    label: "Sprint",
    items: [
      { path: "/sprint/health", icon: "🏃", label: "Sprint Health" },
    ],
  },
  {
    label: "Product",
    items: [
      { path: "/roadmap",    icon: "🗺",  label: "Roadmap" },
      { path: "/discovery",  icon: "💡",  label: "Discovery" },
      { path: "/outcomes",   icon: "🎯",  label: "Outcomes" },
      { path: "/portfolio",  icon: "📁",  label: "Portfolio" },
      { path: "/prd",        icon: "📝",  label: "PRD" },
    ],
  },
];

// Flat list kept for backward compat
export const NAV_ITEMS = NAV_GROUPS.flatMap(g => g.items);

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pendingDecisions = useDecisionsPendingCount();

  return (
    <motion.nav
      animate={{ width: collapsed ? 52 : 180 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        background: "var(--glass-bg)",
        borderRight: "1px solid var(--glass-border)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
        flexShrink: 0,
        zIndex: 10,
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{ padding: "10px", background: "transparent", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: 14, textAlign: "right", flexShrink: 0 }}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div style={{ padding: "8px 14px 2px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-secondary)", opacity: 0.55, display: "flex", alignItems: "center", gap: 4 }}>
                {group.label}
                {group.label === "Agents" && pendingDecisions > 0 && (
                  <span style={{ background: "var(--warn)", color: "#000", borderRadius: 99, padding: "0 5px", fontSize: 9, fontWeight: 800 }}>{pendingDecisions}</span>
                )}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={item.label}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
                  textDecoration: "none",
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  background: isActive ? "var(--ok-bg)" : "transparent",
                  borderLeft: `3px solid ${isActive ? "var(--accent)" : "transparent"}`,
                  transition: "background 0.15s, color 0.15s",
                  whiteSpace: "nowrap", fontSize: 13, fontWeight: 500,
                })}
              >
                {({ isActive }) => (
                  <>
                    <span className={clsx("text-base leading-none", isActive && "drop-shadow")} style={{ flexShrink: 0 }} aria-hidden="true">{item.icon}</span>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.label}
                      </motion.span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </motion.nav>
  );
}
