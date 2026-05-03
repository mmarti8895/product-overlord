import { useState, useRef, useCallback, useEffect } from "react";
import { GlassPanel, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useLogStore, type LogLevel } from "../stores/logStore.js";
import { useMetricsStream } from "../api/useMetricsStream.js";
import { clsx } from "clsx";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "var(--text-tertiary)",
  info:  "var(--ok)",
  warn:  "var(--needs-clarification)",
  error: "var(--blocked)",
};

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

export function LogConsole() {
  useMetricsStream();

  const { entries, clear } = useLogStore();
  const [levels, setLevels] = useState<Set<LogLevel>>(new Set(LEVELS));
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  const handleSearch = useCallback((v: string) => {
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setDebouncedSearch(v), 200);
  }, []);

  const filtered = entries.filter(e =>
    levels.has(e.level) &&
    (debouncedSearch === "" || e.message.toLowerCase().includes(debouncedSearch.toLowerCase()))
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current && filtered.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  function toggleLevel(l: LogLevel) {
    setLevels(prev => {
      const next = new Set(prev);
      if (next.has(l)) next.delete(l); else next.add(l);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      {/* Toolbar */}
      <GlassPanel style={{ borderRadius: "var(--radius-lg) var(--radius-lg) 0 0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginRight: 8 }}>Log Console</h2>
        {LEVELS.map(l => (
          <button
            key={l}
            onClick={() => toggleLevel(l)}
            className={clsx("px-3 py-1 rounded-full text-xs font-semibold border transition-colors")}
            style={{
              border: "1px solid var(--glass-border)",
              background: levels.has(l) ? LEVEL_COLORS[l] + "22" : "var(--surface-2)",
              color: levels.has(l) ? LEVEL_COLORS[l] : "var(--text-tertiary)",
              cursor: "pointer",
            }}
            aria-pressed={levels.has(l)}
          >
            {l}
          </button>
        ))}
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search…"
          aria-label="Search logs"
          style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid var(--glass-border)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: 12, outline: "none", width: 160 }}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} />
            Auto-scroll
          </label>
          <GlassButton onClick={clear} style={{ padding: "4px 12px", fontSize: 12 }}>Clear</GlassButton>
        </div>
        <GlassBadge variant="neutral">{filtered.length} / {entries.length}</GlassBadge>
      </GlassPanel>

      {/* Scrollable log list */}
      <div
        ref={scrollRef}
        style={{ flex: 1, background: "var(--surface-2)", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)", overflowY: "auto", minHeight: 0 }}
      >
        {filtered.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-tertiary)", fontSize: 13 }}>
            No log entries matching filters.
          </div>
        ) : (
          filtered.map((entry, index) => (
            <div
              key={entry.timestamp + index}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "2px 14px",
                fontSize: 11,
                fontFamily: "monospace",
                lineHeight: 1.5,
                borderBottom: "1px solid var(--glass-border)",
                background: index % 2 === 0 ? "transparent" : "rgba(0,0,0,0.03)",
              }}
            >
              <span style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>
                {new Date(entry.timestamp).toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span style={{ color: LEVEL_COLORS[entry.level], fontWeight: 700, width: 38, flexShrink: 0, textTransform: "uppercase" }}>
                {entry.level}
              </span>
              <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LogConsole;
