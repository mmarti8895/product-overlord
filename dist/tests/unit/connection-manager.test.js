/**
 * Tests for ConnectionManager — save/load/mask round-trip.
 * Stubs SecretStore so no real file I/O occurs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
// Stub SecretStore before importing ConnectionManager
vi.mock("../../connections/SecretStore.js", () => ({
    secretSave: vi.fn().mockResolvedValue(undefined),
    secretLoad: vi.fn().mockResolvedValue(null),
    secretDelete: vi.fn().mockResolvedValue(undefined),
}));
import * as SecretStore from "../../connections/SecretStore.js";
import { ConnectionManager } from "../../connections/ConnectionManager.js";
// ─── helpers ────────────────────────────────────────────────────────────────
function makeJira(overrides = {}) {
    return { baseUrl: "https://example.atlassian.net", projectKey: "PROJ", token: "secret-token", ...overrides };
}
function makeOpenAI(overrides = {}) {
    return {
        apiKey: "sk-secret",
        plannerModel: "gpt-4o",
        executorModel: "gpt-4o-mini",
        reviewerModel: "gpt-4o-mini",
        tpmBudget: 100_000,
        rpmBudget: 60,
        ...overrides,
    };
}
function makeGitHub(overrides = {}) {
    return { pat: "ghp_secret", repos: ["org/repo"], branchFilter: "main", ...overrides };
}
// ─── tests ──────────────────────────────────────────────────────────────────
describe("ConnectionManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    describe("save", () => {
        it("calls secretSave with serialised jira config", async () => {
            const cfg = makeJira();
            await ConnectionManager.save("jira", cfg);
            expect(SecretStore.secretSave).toHaveBeenCalledWith("overlord.connection.jira", JSON.stringify(cfg));
        });
        it("calls secretSave with serialised openai config", async () => {
            const cfg = makeOpenAI();
            await ConnectionManager.save("openai", cfg);
            expect(SecretStore.secretSave).toHaveBeenCalledWith("overlord.connection.openai", JSON.stringify(cfg));
        });
        it("calls secretSave with serialised github config", async () => {
            const cfg = makeGitHub();
            await ConnectionManager.save("github", cfg);
            expect(SecretStore.secretSave).toHaveBeenCalledWith("overlord.connection.github", JSON.stringify(cfg));
        });
    });
    describe("load (masked)", () => {
        it("returns null when no config saved", async () => {
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(null);
            const result = await ConnectionManager.load("jira");
            expect(result).toBeNull();
        });
        it("masks token field for jira", async () => {
            const cfg = makeJira();
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(JSON.stringify(cfg));
            const result = await ConnectionManager.load("jira");
            expect(result).not.toBeNull();
            expect(result.token).toBe("***");
            expect(result.baseUrl).toBe(cfg.baseUrl);
            expect(result.projectKey).toBe(cfg.projectKey);
        });
        it("masks apiKey field for openai", async () => {
            const cfg = makeOpenAI();
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(JSON.stringify(cfg));
            const result = await ConnectionManager.load("openai");
            expect(result.apiKey).toBe("***");
            expect(result.plannerModel).toBe(cfg.plannerModel);
        });
        it("masks pat and privateKey for github", async () => {
            const cfg = { ...makeGitHub(), privateKey: "pem-secret" };
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(JSON.stringify(cfg));
            const result = await ConnectionManager.load("github");
            expect(result.pat).toBe("***");
            expect(result.privateKey).toBe("***");
            expect(result.repos).toEqual(cfg.repos);
        });
    });
    describe("loadRaw (unmasked)", () => {
        it("returns original config without masking", async () => {
            const cfg = makeJira();
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(JSON.stringify(cfg));
            const result = await ConnectionManager.loadRaw("jira");
            expect(result.token).toBe("secret-token");
        });
        it("returns null when nothing stored", async () => {
            vi.mocked(SecretStore.secretLoad).mockResolvedValueOnce(null);
            const result = await ConnectionManager.loadRaw("openai");
            expect(result).toBeNull();
        });
    });
});
