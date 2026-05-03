/**
 * Unit tests — IntercomAdapter (discovery-intake task 7.1)
 *
 * Covers:
 *   - mocked HTTP fetch, since parameter
 *   - HTML stripping (plain text response)
 *   - tag filtering / mapping
 *   - failure path — error thrown on non-OK response
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { IntercomAdapter } from "../../adapters/feedback/intercom.js";
function makeConversations(items) {
    return { conversations: items };
}
function mockFetch(body, status = 200) {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: vi.fn().mockResolvedValue(body),
    });
}
afterEach(() => vi.restoreAllMocks());
describe("IntercomAdapter", () => {
    it("fetches conversations and maps to RawFeedbackItem", async () => {
        const fetch = mockFetch(makeConversations([
            {
                id: "conv-1",
                created_at: 1700000000,
                conversation_message: { body: "Hello world" },
                tags: { tags: [{ name: "bug" }] },
                custom_attributes: { segment: "enterprise" },
            },
        ]));
        vi.stubGlobal("fetch", fetch);
        const adapter = new IntercomAdapter({ token: "test-token", baseUrl: "https://mock.intercom.io" });
        const items = await adapter.fetchSince(null);
        expect(items).toHaveLength(1);
        expect(items[0].source_id).toBe("conv-1");
        expect(items[0].text).toBe("Hello world");
        expect(items[0].tags).toContain("bug");
        expect(items[0].customer_segment).toBe("enterprise");
    });
    it("passes 'since' as created_since epoch in URL", async () => {
        const fetch = mockFetch(makeConversations([]));
        vi.stubGlobal("fetch", fetch);
        const adapter = new IntercomAdapter({ token: "tok", baseUrl: "https://mock.intercom.io" });
        await adapter.fetchSince("2024-01-01T00:00:00.000Z");
        const url = fetch.mock.calls[0][0];
        expect(url).toContain("created_since=");
        expect(url).not.toContain("created_since=0");
    });
    it("throws on non-OK HTTP response", async () => {
        vi.stubGlobal("fetch", mockFetch({}, 401));
        const adapter = new IntercomAdapter({ token: "bad", baseUrl: "https://mock.intercom.io" });
        await expect(adapter.fetchSince(null)).rejects.toThrow("401");
    });
    it("returns empty array when conversations field is missing", async () => {
        vi.stubGlobal("fetch", mockFetch({}));
        const adapter = new IntercomAdapter({ token: "tok", baseUrl: "https://mock.intercom.io" });
        const items = await adapter.fetchSince(null);
        expect(items).toHaveLength(0);
    });
});
