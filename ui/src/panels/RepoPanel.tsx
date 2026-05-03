import { useState } from "react";
import { GlassPanel, GlassCard, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { apiFetch } from "../api/client.js";

interface ComponentInfo {
  name: string;
  path: string;
  framework: string;
  owner: string;
  testDirs: string[];
  enrichmentOnly?: boolean;
}

interface MapperResult {
  component: string;
  confidence: number;
  reason: string;
}

export function RepoPanel() {
  const [components, setComponents] = useState<ComponentInfo[]>([]);
  const [mapperResults, setMapperResults] = useState<MapperResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadComponents() {
    setLoading(true);
    const res = await apiFetch<{ components: ComponentInfo[]; mapper_results: MapperResult[] }>("/api/repo/components");
    setLoading(false);
    if (res.ok) {
      setComponents(res.data.components ?? []);
      setMapperResults(res.data.mapper_results ?? []);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Repository</h2>
        <GlassButton onClick={loadComponents} disabled={loading}>{loading ? "Loading…" : "Load Index"}</GlassButton>
      </GlassPanel>

      {components.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Component Index</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {components.map(c => (
              <GlassCard key={c.name} style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                  <GlassBadge variant="ok">{c.framework}</GlassBadge>
                </div>
                {c.enrichmentOnly && <GlassBadge variant="degraded" dot>enrichmentOnly β</GlassBadge>}
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{c.path}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Owner: {c.owner}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Tests: {c.testDirs.join(", ")}</div>
              </GlassCard>
            ))}
          </div>
        </GlassPanel>
      )}

      {mapperResults.length > 0 && (
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Mapper Results</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {mapperResults.sort((a, b) => b.confidence - a.confidence).map((r, i) => (
              <GlassCard key={i} style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{r.component}</span>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{Math.round(r.confidence * 100)}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)", marginBottom: 4 }}>
                  <div style={{ width: `${r.confidence * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent)" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.reason}</div>
              </GlassCard>
            ))}
          </div>
        </GlassPanel>
      )}
    </div>
  );
}

export default RepoPanel;
