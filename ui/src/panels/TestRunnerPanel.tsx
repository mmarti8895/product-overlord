import { useState, useRef } from "react";
import { GlassPanel, GlassButton } from "../components/glass/index.js";
import { GlassBadge } from "../components/glass/GlassBadge.js";

// Tauri shell plugin — loaded dynamically so the UI compiles in browser mode too
type TauriCommand = {
  stdout: { on(event: "data", cb: (line: string) => void): void };
  stderr: { on(event: "data", cb: (line: string) => void): void };
  on(event: "close", cb: () => void): void;
  spawn(): Promise<{ kill(): void }>;
};
type TauriCommandStatic = { create(program: string, args: string[], opts?: Record<string, unknown>): TauriCommand };
async function loadCommand(): Promise<TauriCommandStatic | null> {
  try {
    const m = await import("@tauri-apps/plugin-shell");
    return m.Command as unknown as TauriCommandStatic;
  } catch {
    return null;
  }
}

const TEST_SUITES = [
  { id: "unit",     label: "Unit Tests",     dir: "src/tests/unit" },
  { id: "contract", label: "Contract Tests", dir: "src/tests/contract" },
  { id: "integration", label: "Integration Tests", dir: "src/tests/integration" },
];

interface SuiteResult {
  id: string;
  passed: number;
  failed: number;
  skipped: number;
}

export function TestRunnerPanel() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["unit"]));
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [results, setResults] = useState<SuiteResult[]>([]);
  const abortRef = useRef<(() => void) | null>(null);

  function toggleSuite(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function runTests() {
    if (selected.size === 0) return;
    setRunning(true);
    setOutput([]);
    setResults([]);

    const suiteArgs = Array.from(selected).map(id => {
      const s = TEST_SUITES.find(x => x.id === id);
      return s?.dir ?? id;
    });

    try {
      const Command = await loadCommand();
      if (!Command) {
        setOutput(["[error] Tauri shell plugin not available in this environment."]);
        setRunning(false);
        return;
      }
      const cmd = Command.create("run-tests", ["run", "vitest", "--reporter=verbose", ...suiteArgs], { cwd: "/home/mars/Desktop/projects/product-overlord" });

      cmd.stdout.on("data", (line: string) => {
        setOutput(prev => [...prev, line]);
      });
      cmd.stderr.on("data", (line: string) => {
        setOutput(prev => [...prev, `[err] ${line}`]);
      });

      const child = await cmd.spawn();
      abortRef.current = () => child.kill();

      await new Promise<void>((resolve) => {
        cmd.on("close", () => resolve());
      });

      // Parse naive results from output
      const combined = output.join("\n");
      const passMatch = combined.match(/(\d+) passed/);
      const failMatch = combined.match(/(\d+) failed/);
      const skipMatch = combined.match(/(\d+) skipped/);
      setResults([{ id: "run", passed: Number(passMatch?.[1] ?? 0), failed: Number(failMatch?.[1] ?? 0), skipped: Number(skipMatch?.[1] ?? 0) }]);
    } catch (e) {
      setOutput(prev => [...prev, `[error] ${String(e)}`]);
    } finally {
      setRunning(false);
    }
  }

  function stopTests() {
    abortRef.current?.();
    setRunning(false);
  }

  const totalResult = results[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <GlassPanel>
        <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>Test Runner</h2>
        {/* Suite selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {TEST_SUITES.map(s => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleSuite(s.id)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{s.label}</span>
              <code style={{ fontSize: 11, color: "var(--text-secondary)" }}>{s.dir}</code>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <GlassButton onClick={runTests} disabled={running || selected.size === 0}>▶ Run</GlassButton>
          {running && <GlassButton onClick={stopTests} style={{ background: "var(--blocked-bg)", color: "var(--blocked)" }}>Stop</GlassButton>}
          {totalResult && (
            <>
              <GlassBadge variant="ready" dot>{totalResult.passed} passed</GlassBadge>
              {totalResult.failed > 0 && <GlassBadge variant="blocked" dot>{totalResult.failed} failed</GlassBadge>}
              {totalResult.skipped > 0 && <GlassBadge variant="neutral" dot>{totalResult.skipped} skipped</GlassBadge>}
              {totalResult.failed > 0 && (
                <GlassButton onClick={runTests} style={{ marginLeft: "auto", fontSize: 12, padding: "4px 12px" }}>Re-run failed</GlassButton>
              )}
            </>
          )}
        </div>
      </GlassPanel>

      {/* Output */}
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <pre style={{
          margin: 0,
          padding: 14,
          fontSize: 11,
          fontFamily: "monospace",
          lineHeight: 1.6,
          color: "var(--text-primary)",
          background: "var(--surface-2)",
          maxHeight: "55vh",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          borderRadius: "var(--radius-lg)",
        }}>
          {output.length === 0
            ? (running ? "Starting…" : "Select suites and press Run.")
            : output.join("")}
        </pre>
      </GlassPanel>
    </div>
  );
}

export default TestRunnerPanel;
