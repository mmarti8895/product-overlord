/**
 * Unit tests — ZendeskAdapter (discovery-intake task 7.2)
 *
 * Covers:
 *   - mocked HTTP, tag mapping
 *   - since parameter as start_time
 *   - failure path — non-OK response throws
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { ZendeskAdapter } from "../../adapters/feedback/zendesk.js";
afterEach(() => vi.restoreAllMocks());
function mockFetch(body, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: vi.fn().mockResolvedValue(body),
    });
}
describe("ZendeskAdapter", () => {
    it("maps tickets to RawFeedbackItem", async () => {
        vi.stubGlobal("fetch", mockFetch({
            tickets: [
                { id: 42, description: "I cannot login", created_at: "2024-01-15T10:00:00Z", tags: ["login", "auth"] },
            ],
        }));
        const adapter = new ZendeskAdapter({ subdomain: "test", email: "a@b.com", token: "tok" });
        const items = await adapter.fetchSince(null);
        expect(items).toHaveLength(1);
        expect(items[0].source_id).toBe("42");
        expect(items[0].text).toBe("I cannot login");
        expect(items[0].tags).toContain("login");
    });
    it("passes since as start_time query param", async () => {
        const fetch = mockFetch({ tickets: [] });
        vi.stubGlobal("fetch", fetch);
        const adapter = new ZendeskAdapter({ subdomain: "test", email: "a@b.com", token: "tok" });
        await adapter.fetchSince("2024-01-01T00:00:00.000Z");
        const url = fetch.mock.calls[0][0];
        expect(url).toContain("start_time=");
    });
    it("throws on non-OK HTTP response", async () => {
        vi.stubGlobal("fetch", mockFetch({}, 403));
        const adapter = new ZendeskAdapter({ subdomain: "test", email: "a@b.com", token: "tok" });
        await expect(adapter.fetchSince(null)).rejects.toThrow("403");
    });
});
