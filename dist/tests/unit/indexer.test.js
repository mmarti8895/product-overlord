/**
 * Unit tests — ComponentIndexer (task 1.6)
 *
 * Covers:
 *   - component extraction from tree entries
 *   - > 20 GB repository rejection (via RepoAdapter guard)
 *   - incremental diff detection
 *   - missing test-dir flag (testLocationKnown: false)
 */
import { describe, it, expect } from "vitest";
import { ComponentIndexer } from "../../repo/component-indexer.js";
// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function makeEntries(paths) {
    return paths.map((p) => ({ path: p, type: "blob" }));
}
const TYPICAL_ENTRIES = makeEntries([
    "src/auth/index.ts",
    "src/auth/login.ts",
    "src/auth/__tests__/login.test.ts",
    "src/payments/index.ts",
    "src/payments/stripe.ts",
    "src/payments/vitest.config.ts",
    "README.md",
    "package.json",
]);
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("ComponentIndexer — index()", () => {
    const indexer = new ComponentIndexer();
    it("groups entries by top-level directory into components", () => {
        const result = indexer.index("org/repo", TYPICAL_ENTRIES);
        const names = result.components.map((c) => c.name);
        expect(names).toContain("src");
        expect(names).toContain("<root>");
    });
    it("detects node framework via package.json at root", () => {
        const result = indexer.index("org/repo", TYPICAL_ENTRIES);
        const root = result.components.find((c) => c.name === "<root>");
        expect(root?.frameworks).toContain("node");
    });
    it("detects vitest convention in payments component", () => {
        // payments is nested under src — top-level dir is src
        const result = indexer.index("org/repo", TYPICAL_ENTRIES);
        const src = result.components.find((c) => c.name === "src");
        expect(src?.conventions.some((c) => c.includes("vitest"))).toBe(true);
    });
    it("detects test directory in src component", () => {
        const result = indexer.index("org/repo", TYPICAL_ENTRIES);
        const src = result.components.find((c) => c.name === "src");
        expect(src?.testLocationKnown).toBe(true);
        expect(src?.testDirs.length).toBeGreaterThan(0);
    });
    it("flags testLocationKnown: false when no test dirs exist", () => {
        const entries = makeEntries(["lib/foo.ts", "lib/bar.ts"]);
        const result = indexer.index("org/repo", entries);
        const lib = result.components.find((c) => c.name === "lib");
        expect(lib?.testLocationKnown).toBe(false);
        expect(lib?.testDirs).toHaveLength(0);
    });
    it("detects CODEOWNERS as an owner file", () => {
        const entries = makeEntries(["src/foo.ts", "CODEOWNERS"]);
        const result = indexer.index("org/repo", entries);
        const root = result.components.find((c) => c.name === "<root>");
        expect(root?.owners).toContain("CODEOWNERS");
    });
    it("detects python framework via requirements.txt", () => {
        const entries = makeEntries(["backend/app.py", "backend/requirements.txt"]);
        const result = indexer.index("org/repo", entries);
        const backend = result.components.find((c) => c.name === "backend");
        expect(backend?.frameworks).toContain("python");
    });
    it("detects go framework via go.mod", () => {
        const entries = makeEntries(["cmd/main.go", "go.mod"]);
        const result = indexer.index("org/repo", entries);
        const root = result.components.find((c) => c.name === "<root>");
        expect(root?.frameworks).toContain("go");
    });
    it("repoFullName and indexedAt are correctly set", () => {
        const result = indexer.index("my-org/my-repo", TYPICAL_ENTRIES);
        expect(result.repoFullName).toBe("my-org/my-repo");
        expect(result.indexedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});
describe("ComponentIndexer — diff()", () => {
    const indexer = new ComponentIndexer();
    it("marks components as updated when root paths change", () => {
        const prev = indexer.index("org/repo", makeEntries(["src/foo.ts"]));
        const { updated, unchanged } = indexer.diff(prev, makeEntries(["src/foo.ts", "src/bar.ts"]));
        expect(updated.some((c) => c.name === "src")).toBe(true);
        expect(unchanged).toHaveLength(0);
    });
    it("marks components as unchanged when root paths are identical", () => {
        const prev = indexer.index("org/repo", makeEntries(["src/foo.ts"]));
        const { updated, unchanged } = indexer.diff(prev, makeEntries(["src/foo.ts"]));
        expect(unchanged.some((c) => c.name === "src")).toBe(true);
        expect(updated).toHaveLength(0);
    });
    it("marks a brand-new component as updated", () => {
        const prev = indexer.index("org/repo", makeEntries(["src/foo.ts"]));
        const { updated } = indexer.diff(prev, makeEntries(["src/foo.ts", "infra/terraform.tf"]));
        expect(updated.some((c) => c.name === "infra")).toBe(true);
    });
});
describe("RepoAdapter — > 20 GB rejection guard", () => {
    it("throws when repo size exceeds 20 GB", async () => {
        // 20 GB = 20 * 1024 * 1024 KB = 20971520 KB
        const tooBigMeta = {
            name: "big-repo",
            full_name: "org/big-repo",
            size: 21_000_000, // KB > 20 GB
            default_branch: "main",
            private: false,
        };
        const fakeFetch = async () => ({
            ok: true,
            status: 200,
            json: async () => tooBigMeta,
        });
        const { RepoAdapter } = await import("../../repo/repo-adapter.js");
        const adapter = new RepoAdapter({
            provider: "github",
            accessToken: "tok",
            retryDelayMs: 0,
        });
        // @ts-expect-error — stubbing global fetch
        globalThis.fetch = fakeFetch;
        await expect(adapter.getRepoMeta("org", "big-repo")).rejects.toThrow(/exceeds.*20 GB/i);
    });
});
