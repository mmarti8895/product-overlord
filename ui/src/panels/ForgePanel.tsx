import { useEffect, useState } from "react";
import { GlassPanel } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { useServerStatus } from "../api/queries/hooks.js";

const FORGE_ROUTES = [
  { method: "POST", path: "/forge/ingest/issue" },
  { method: "POST", path: "/forge/analyse/:runId" },
  { method: "GET",  path: "/forge/draft/:runId" },
  { method: "POST", path: "/forge/plan/:runId" },
];
const KB_ROUTES = [
  { method: "POST", path: "/kb/upload" },
  { method: "POST", path: "/kb/crawl" },
  { method: "GET",  path: "/kb/sources" },
];
const API_ROUTES = [
  { method: "GET", path: "/api/status" },
  { method: "GET", path: "/api/config" },
  { method: "GET", path: "/api/metrics" },
];

interface EndpointHealth { path: string; method: string; ok: boolean | null; }

export function ForgePanel() {
  const { data: statusData } = useServerStatus();
  const [health, setHealth] = useState<EndpointHealth[]>([
    ...[...FORGE_ROUTES, ...KB_ROUTES, ...API_ROUTES].map(r => ({ ...r, ok: null })),
  ]);
  const [lastSize, setLastSize] = useState<number | null>(null);

  // Probe GET endpoints
  useEffect(() => {
    const getRoutes = [...FORGE_ROUTES, ...KB_ROUTES, ...API_ROUTES].filter(r => r.method === "GET");
    Promise.all(
      getRoutes.map(async r => {
        try {
          const res = await fetch(r.path.replace(/:\w+/, "probe"), { method: "HEAD" }).catch(() => fetch(r.path.replace(/:\w+/, "probe")));
          return { path: r.path, method: r.method, ok: res.status < 500 };
        } catch {
          return { path: r.path, method: r.method, ok: false };
        }
      })
    ).then(results => {
      setHealth(prev => prev.map(h => {
        const found = results.find(r => r.path === h.path);
        return found ? { ...h, ok: found.ok } : h;
      }));
    });
  }, []);

  // Probe last response size from status
  useEffect(() => {
    if (statusData?.ok) {
      setLastSize(JSON.stringify(statusData.data).length);
    }
  }, [statusData]);

  const MAX_BYTES = 4.5 * 1024 * 1024;
  const sizePct = lastSize ? Math.min(100, (lastSize / MAX_BYTES) * 100) : 0;

  const statusInfo = statusData?.ok ? statusData.data : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Server status overview */}
      <GlassPanel style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Forge</h2>
          {statusInfo && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <GlassBadge variant="ok" dot>{statusInfo.version}</GlassBadge>
              {statusInfo.shadow_mode && <GlassBadge variant="degraded" dot>Shadow Mode</GlassBadge>}
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>up {Math.round((statusInfo.uptime_ms ?? 0) / 1000)}s</span>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Endpoint health grid */}
      <GlassPanel>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Endpoint Health</h3>
        {([["Forge", FORGE_ROUTES], ["Knowledge Base", KB_ROUTES], ["API", API_ROUTES]] as [string, typeof FORGE_ROUTES][]).map(([group, routes]) => (
          <div key={group} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{group}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {routes.map(r => {
                const h = health.find(e => e.path === r.path);
                return (
                  <div key={r.path} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: h?.ok === null ? "var(--text-tertiary)" : h?.ok ? "var(--ready)" : "var(--blocked)", flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", width: 50 }}>{r.method}</span>
                    <code style={{ fontSize: 12, color: "var(--text-primary)" }}>{r.path}</code>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </GlassPanel>

      {/* Payload size monitor */}
      <GlassPanel>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Payload Size Monitor</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
          <span>Last response</span>
          <span>{lastSize ? `${(lastSize / 1024).toFixed(1)} KB` : "—"} / 4.5 MB limit</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
          <div style={{ width: `${sizePct}%`, height: "100%", borderRadius: 3, background: sizePct > 80 ? "var(--blocked)" : "var(--accent)", transition: "width 0.5s" }} />
        </div>
      </GlassPanel>

      {/* Degraded flags */}
      {statusInfo?.degraded_flags && Object.keys(statusInfo.degraded_flags).length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Degraded Flags</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(statusInfo.degraded_flags).map(([flag, active]) => (
              <GlassBadge key={flag} variant={active ? "degraded" : "ok"} dot>{flag}</GlassBadge>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

export default ForgePanel;
