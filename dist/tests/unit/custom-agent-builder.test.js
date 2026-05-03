/**
 * Unit tests for CustomAgentBuilder — assert correct AGENTS.md/SOUL.md/SKILLS.md content generated.
 * Stubs fs to avoid real disk I/O.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const writtenFiles = new Map();
vi.mock("fs", async (importOriginal) => {
    const orig = await importOriginal();
    return {
        ...orig,
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn((path, content) => {
            writtenFiles.set(path, content);
        }),
    };
});
import { buildAgent } from "../../agents/CustomAgentBuilder.js";
function makeSpec(overrides = {}) {
    return {
        name: "test-agent",
        description: "A test agent for unit tests",
        role: "executor",
        persona: "You are precise and concise.",
        skills: ["jira_read", "openai_chat"],
        maxConcurrency: 3,
        rpmCap: 60,
        tpmCap: 100_000,
        retryPolicy: "exponential",
        ...overrides,
    };
}
describe("CustomAgentBuilder.buildAgent", () => {
    beforeEach(() => {
        writtenFiles.clear();
        vi.clearAllMocks();
    });
    it("returns a BuiltAgent with name, dir, and files", () => {
        const result = buildAgent(makeSpec());
        expect(result.name).toBe("test-agent");
        expect(result.dir).toContain("test-agent");
        expect(result.files["AGENTS.md"]).toBeDefined();
        expect(result.files["SOUL.md"]).toBeDefined();
        expect(result.files["SKILLS.md"]).toBeDefined();
    });
    describe("AGENTS.md content", () => {
        it("contains the agent name as heading", () => {
            const { files } = buildAgent(makeSpec({ name: "my-planner" }));
            expect(files["AGENTS.md"]).toContain("# my-planner");
        });
        it("contains the role", () => {
            const { files } = buildAgent(makeSpec({ role: "reviewer" }));
            expect(files["AGENTS.md"]).toContain("reviewer");
        });
        it("contains the description", () => {
            const { files } = buildAgent(makeSpec({ description: "Reviews PRs carefully" }));
            expect(files["AGENTS.md"]).toContain("Reviews PRs carefully");
        });
        it("contains parallelization config", () => {
            const { files } = buildAgent(makeSpec({ maxConcurrency: 5, rpmCap: 30, tpmCap: 50000, retryPolicy: "fixed" }));
            expect(files["AGENTS.md"]).toContain("5");
            expect(files["AGENTS.md"]).toContain("30");
            expect(files["AGENTS.md"]).toContain("50000");
            expect(files["AGENTS.md"]).toContain("fixed");
        });
    });
    describe("SOUL.md content", () => {
        it("contains the agent name in heading", () => {
            const { files } = buildAgent(makeSpec({ name: "soul-tester" }));
            expect(files["SOUL.md"]).toContain("soul-tester");
        });
        it("contains the persona text", () => {
            const { files } = buildAgent(makeSpec({ persona: "Thoughtful and careful." }));
            expect(files["SOUL.md"]).toContain("Thoughtful and careful.");
        });
    });
    describe("SKILLS.md content", () => {
        it("contains the agent name in heading", () => {
            const { files } = buildAgent(makeSpec({ name: "skill-tester" }));
            expect(files["SKILLS.md"]).toContain("skill-tester");
        });
        it("lists each skill as a bullet", () => {
            const { files } = buildAgent(makeSpec({ skills: ["jira_read", "github_write", "lancedb_search"] }));
            expect(files["SKILLS.md"]).toContain("- jira_read");
            expect(files["SKILLS.md"]).toContain("- github_write");
            expect(files["SKILLS.md"]).toContain("- lancedb_search");
        });
        it("handles empty skills array", () => {
            const { files } = buildAgent(makeSpec({ skills: [] }));
            expect(files["SKILLS.md"]).toBeDefined();
        });
    });
    describe("file system writes", () => {
        it("writes three files to disk", () => {
            buildAgent(makeSpec({ name: "fs-agent" }));
            const paths = [...writtenFiles.keys()];
            expect(paths.some(p => p.includes("AGENTS.md"))).toBe(true);
            expect(paths.some(p => p.includes("SOUL.md"))).toBe(true);
            expect(paths.some(p => p.includes("SKILLS.md"))).toBe(true);
        });
        it("dir path includes normalised agent name", () => {
            const result = buildAgent(makeSpec({ name: "My Fancy Agent" }));
            expect(result.dir).toContain("my-fancy-agent");
        });
    });
});
