import { useState } from "react";
import { GlassPanel, GlassCard } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { LatencyHistogram } from "../components/charts/index.js";
import { useRAGChunks } from "../api/queries/hooks.js";
import { useAnalysisStore } from "../stores/analysisStore.js";

interface Chunk {
  id: string;
  score: number;
  source: string;
  text: string;
  tokenCount: number;
  truncated: boolean;
}

export function RAGPanel() {
  const { runId } = useAnalysisStore();
  const { data } = useRAGChunks(runId);
  const [latencies] = useState<number[]>([120, 340, 210, 560, 890, 230, 410, 780, 300, 150]);
  const chunks: Chunk[] = data?.ok ? (((data.data as { chunks: Chunk[] }).chunks) ?? []) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel>
        <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
          Retrieved Chunks ({chunks.length})
        </h2>
        {!runId && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No active run — ingest an issue first.</p>}
        {chunks.length === 0 && runId && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No chunks retrieved.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "50vh", overflowY: "auto" }}>
          {chunks.map(chunk => (
            <GlassCard key={chunk.id} style={{ padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{chunk.source}</span>
                <GlassBadge variant="ok">{Math.round(chunk.score * 100)}%</GlassBadge>
                <GlassBadge variant="neutral">{chunk.tokenCount} tok</GlassBadge>
                {chunk.truncated && <GlassBadge variant="needs_clarification">Truncated</GlassBadge>}
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "var(--surface-2)", marginBottom: 8 }}>
                <div style={{ width: `${chunk.score * 100}%`, height: "100%", borderRadius: 2, background: "var(--accent)", transition: "width 0.5s" }} />
              </div>
              <p style={{
                margin: 0, fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
              }}>
                {chunk.text}
              </p>
            </GlassCard>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Retrieval Latency (last 50)</h3>
        <LatencyHistogram values={latencies} label="ms per retrieval" />
      </GlassPanel>
    </div>
  );
}

export default RAGPanel;
