import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "./ThemeProvider.js";
import { useAgentActivityStore } from "../../stores/agentActivityStore.js";
import { useStopAllAgents } from "../../api/queries/agentHooks.js";

export function TitleBar() {
  const { theme, toggle } = useTheme();
  const win = getCurrentWindow();
  const activeAgents = useAgentActivityStore(s => s.activeAgents);
  const stopAll = useStopAllAgents();
  const activeCount = [...activeAgents.values()].filter(a => !a.status || a.status === "running").length;

  return (
    <div
      className="drag-region flex items-center justify-between px-4"
      style={{
        height: "var(--titlebar-height)",
        background: "var(--glass-bg)",
        borderBottom: "1px solid var(--glass-border)",
        userSelect: "none",
      }}
    >
      {/* Traffic-light spacer for macOS */}
      <div className="no-drag flex items-center gap-1.5">
        <button
          onClick={() => win.close()}
          className="w-3 h-3 rounded-full"
          style={{ background: "#FF5F57" }}
          aria-label="Close"
        />
        <button
          onClick={() => win.minimize()}
          className="w-3 h-3 rounded-full"
          style={{ background: "#FFBC2E" }}
          aria-label="Minimize"
        />
        <button
          onClick={() => win.toggleMaximize()}
          className="w-3 h-3 rounded-full"
          style={{ background: "#28C840" }}
          aria-label="Maximize"
        />
      </div>

      <span
        className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold"
        style={{ color: "var(--text-secondary)" }}
      >
        product-overlord
      </span>

      <div className="no-drag flex items-center gap-2">
        {activeCount > 0 && (
          <button
            onClick={() => stopAll.mutate()}
            className="flex items-center gap-1 px-2 h-6 rounded text-xs font-semibold"
            style={{ background: "var(--blocked)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11 }}
            aria-label={`Stop all ${activeCount} active agents`}
            title={`Stop all ${activeCount} active agent(s)`}
          >
            ⏹ Stop All ({activeCount})
          </button>
        )}
        <button
          onClick={toggle}
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}
