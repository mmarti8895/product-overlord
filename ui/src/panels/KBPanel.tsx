import { useState, useRef } from "react";
import { GlassPanel, GlassCard, GlassButton, GlassInput } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";
import { GlassModal } from "../components/glass/GlassModal.js";
import { useKBStore } from "../stores/kbStore.js";
import { useKBSources, useKBUpload, useKBDeleteSource } from "../api/queries/hooks.js";
import { useToastStore } from "../components/glass/GlassToast.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function KBPanel() {
  const [projectFilter, setProjectFilter] = useState("");
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlProject, setCrawlProject] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { usedBytes, maxBytes } = useKBStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { add } = useToastStore();
  const upload = useKBUpload();
  const deleteSource = useKBDeleteSource();
  const { data: sourcesData } = useKBSources(projectFilter || undefined);
  const sources = sourcesData?.ok
    ? ((sourcesData.data as { sources: { id: string; name: string; type: string; projectKey: string; size: number; indexedAt: string }[] }).sources ?? [])
    : [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      add({ kind: "error", message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 50 MB.` });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    if (crawlProject) form.append("project_key", crawlProject);
    await upload.mutateAsync(form);
    add({ kind: "success", message: `Uploaded ${file.name}` });
  }

  async function handleCrawl(e: React.FormEvent) {
    e.preventDefault();
    if (!crawlUrl.match(/^https?:\/\//)) {
      add({ kind: "error", message: "Invalid URL format" });
      return;
    }
    const res = await fetch("/kb/crawl", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: crawlUrl, project_key: crawlProject, depth: crawlDepth }),
    });
    if (res.ok) { add({ kind: "success", message: "Crawl started" }); setCrawlUrl(""); }
    else add({ kind: "error", message: "Crawl failed" });
  }

  const usedPct = maxBytes > 0 ? (usedBytes / maxBytes) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Knowledge Base</h2>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {(usedBytes / 1024 / 1024 / 1024).toFixed(2)} GB / {(maxBytes / 1024 / 1024 / 1024).toFixed(0)} GB
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "var(--surface-2)" }}>
          <div style={{ width: `${usedPct}%`, height: "100%", borderRadius: 3, background: usedPct > 90 ? "var(--blocked)" : "var(--accent)", transition: "width 0.6s" }} />
        </div>
      </GlassPanel>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Upload File</h3>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file && fileInputRef.current) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="File upload drop zone"
            style={{ border: "2px dashed var(--glass-border)", borderRadius: "var(--radius-md)", padding: "28px 20px", textAlign: "center", cursor: "pointer", color: "var(--text-secondary)", fontSize: 13 }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
            Drag & drop or click to upload<br />
            <span style={{ fontSize: 11 }}>Max 50 MB · PDF, MD, TXT, HTML</span>
          </div>
          <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={handleFileChange} accept=".pdf,.md,.txt,.html" />
        </GlassPanel>

        <GlassPanel>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Crawl URL</h3>
          <form onSubmit={handleCrawl} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <GlassInput label="URL" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} required />
            <GlassInput label="Project Key" value={crawlProject} onChange={e => setCrawlProject(e.target.value)} />
            <div>
              <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>Depth: {crawlDepth}</label>
              <input type="range" min={1} max={3} value={crawlDepth} onChange={e => setCrawlDepth(Number(e.target.value))} style={{ width: "100%", marginTop: 4 }} />
            </div>
            <GlassButton type="submit">Crawl</GlassButton>
          </form>
        </GlassPanel>
      </div>

      <GlassPanel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Sources</h3>
          <GlassInput label="Filter project" value={projectFilter} onChange={e => setProjectFilter(e.target.value)} style={{ maxWidth: 180 }} />
        </div>
        {sources.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>No sources indexed.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sources.map(src => (
            <GlassCard key={src.id} style={{ padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{src.name}</span>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {src.projectKey} · {(src.size / 1024).toFixed(1)} KB · {new Date(src.indexedAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <GlassBadge variant="neutral">{src.type}</GlassBadge>
                <button onClick={() => setDeleteId(src.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--blocked)", fontSize: 14 }} aria-label="Delete source">🗑</button>
              </div>
            </GlassCard>
          ))}
        </div>
      </GlassPanel>

      <GlassModal open={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Source">
        <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>Are you sure? This cannot be undone.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <GlassButton onClick={async () => {
            if (deleteId) { await deleteSource.mutateAsync(deleteId); add({ kind: "success", message: "Source deleted" }); setDeleteId(null); }
          }}>Delete</GlassButton>
          <GlassButton onClick={() => setDeleteId(null)}>Cancel</GlassButton>
        </div>
      </GlassModal>
    </div>
  );
}

export default KBPanel;
