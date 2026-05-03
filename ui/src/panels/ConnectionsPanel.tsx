import { useParams, NavLink, Navigate } from "react-router-dom";
import { JiraConnectionTab } from "./connections/JiraConnectionTab.js";
import { OpenAIConnectionTab } from "./connections/OpenAIConnectionTab.js";
import { GitHubConnectionTab } from "./connections/GitHubConnectionTab.js";

const TABS = [
  { id: "jira",   label: "🟦 Jira" },
  { id: "openai", label: "🟢 OpenAI" },
  { id: "github", label: "🐙 GitHub" },
];

export default function ConnectionsPanel() {
  const { provider } = useParams<{ provider: string }>();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Connections</h2>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
          Configure credentials for external services. Tokens are stored in the OS keychain (or local encrypted store).
        </p>
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Connection provider tabs" style={{ display: "flex", gap: 8 }}>
        {TABS.map(t => (
          <NavLink
            key={t.id}
            to={`/connections/${t.id}`}
            role="tab"
            aria-selected={provider === t.id}
            aria-controls={`connections-tabpanel-${t.id}`}
            style={({ isActive }) => ({
              padding: "7px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              background: isActive ? "var(--accent)" : "var(--glass-bg)",
              color: isActive ? "#fff" : "var(--text-secondary)",
              border: "1px solid var(--glass-border)",
              transition: "background 0.15s, color 0.15s",
            })}
          >
            {t.label}
          </NavLink>
        ))}
      </div>

      {/* Panel */}
      <div
        role="tabpanel"
        id={`connections-tabpanel-${provider}`}
        aria-label={`${provider ?? "jira"} connection settings`}
      >
        {provider === "jira"   && <JiraConnectionTab />}
        {provider === "openai" && <OpenAIConnectionTab />}
        {provider === "github" && <GitHubConnectionTab />}
        {!provider && <Navigate to="/connections/jira" replace />}
      </div>
    </div>
  );
}
