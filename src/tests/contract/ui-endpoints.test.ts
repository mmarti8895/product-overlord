/**
 * Contract tests — UI developer endpoints (Tasks 5.5, 13.4)
 *
 * Covers:
 *   5.5a  GET /api/status — happy path
 *   5.5b  GET /api/status — shadow-mode flag reflected
 *   5.5c  GET /api/config — credential fields are redacted
 *   5.5d  GET /api/metrics — responds with text/event-stream
 *   5.5e  UI_DEV_ENDPOINTS=false — all three routes return 404
 *   13.4a SSE broadcaster — events fanned out to subscribers
 *   13.4b recordUIAction — increments counters per panel:action key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createApp } from "../../server/app.js";
import type { ServerConfig } from "../../server/config.js";
import { forgeInstrumentation } from "../../forge/instrumentation.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    port: 3000,
    baseUrl: "http://localhost:3000",
    nodeEnv: "test",
    jiraBaseUrl: undefined,
    jiraAccessToken: "secret-jira-token",
    rovoMcpCloudId: undefined,
    rovoMcpAccessToken: undefined,
    githubAccessToken: "secret-gh-token",
    bitbucketAccessToken: undefined,
    featureFlags: {
      repoGroundingEnabled: true,
      jiraIngestionEnabled: true,
      rovoMcpEnabled: false,
      shadowModeOnly: false,
      a2aEnabled: false,
      llmEnabled: false,
    },
    llm: {
      apiKey: undefined,
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      embeddingModel: "text-embedding-3-small",
      callsPerMinute: 60,
      degraded: true,
    },
    kb: { storePath: "./.kb-test", maxSizeGb: 1 },
    uiDevEndpoints: true,
    ...overrides,
  } as ServerConfig;
}

let app: Hono;

beforeEach(() => {
  forgeInstrumentation.reset();
  app = createApp(makeConfig());
});

// ---------------------------------------------------------------------------
// GET /api/status
// ---------------------------------------------------------------------------

describe("GET /api/status", () => {
  it("5.5a — returns server info with uptime_ms", async () => {
    const res = await app.request("/api/status");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.server).toBe("product-overlord");
    expect(body.version).toBeDefined();
    expect(typeof body.uptime_ms).toBe("number");
    expect(body.shadow_mode).toBe(false);
    expect(body.degraded_flags).toMatchObject({ llm: true });
  });

  it("5.5b — shadow_mode is true when featureFlags.shadowModeOnly=true", async () => {
    const shadowApp = createApp(
      makeConfig({ featureFlags: { repoGroundingEnabled: false, jiraIngestionEnabled: false, rovoMcpEnabled: false, shadowModeOnly: true, a2aEnabled: false, llmEnabled: false } })
    );
    const res = await shadowApp.request("/api/status");
    const body = await res.json() as Record<string, unknown>;
    expect(body.shadow_mode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/config
// ---------------------------------------------------------------------------

describe("GET /api/config", () => {
  it("5.5c — credential fields are redacted to [set] / [not set]", async () => {
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    // Set tokens → "[set]"
    expect(body.jiraAccessToken).toBe("[set]");
    expect(body.githubAccessToken).toBe("[set]");
    // Unset tokens → "[not set]"
    expect(body.rovoMcpAccessToken).toBe("[not set]");
    expect(body.bitbucketAccessToken).toBe("[not set]");
    // Non-credential fields are returned verbatim
    expect(body.nodeEnv).toBe("test");
    expect(body.port).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// GET /api/metrics (SSE)
// ---------------------------------------------------------------------------

describe("GET /api/metrics", () => {
  it("5.5d — responds with Content-Type text/event-stream", async () => {
    const res = await app.request("/api/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});

// ---------------------------------------------------------------------------
// UI_DEV_ENDPOINTS=false gates all three routes
// ---------------------------------------------------------------------------

describe("UI_DEV_ENDPOINTS disabled", () => {
  it("5.5e — /api/status returns 404 when uiDevEndpoints=false", async () => {
    const gatedApp = createApp(makeConfig({ uiDevEndpoints: false }));
    const res = await gatedApp.request("/api/status");
    expect(res.status).toBe(404);
  });

  it("5.5e — /api/config returns 404 when uiDevEndpoints=false", async () => {
    const gatedApp = createApp(makeConfig({ uiDevEndpoints: false }));
    const res = await gatedApp.request("/api/config");
    expect(res.status).toBe(404);
  });

  it("5.5e — /api/metrics returns 404 when uiDevEndpoints=false", async () => {
    const gatedApp = createApp(makeConfig({ uiDevEndpoints: false }));
    const res = await gatedApp.request("/api/metrics");
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// SSE broadcaster (Task 13.4a)
// ---------------------------------------------------------------------------

describe("forgeInstrumentation SSE broadcaster", () => {
  it("13.4a — subscribers receive events broadcast via broadcastSSE", () => {
    const received: object[] = [];
    const unsub = forgeInstrumentation.subscribeSSE((e) => received.push(e));

    forgeInstrumentation.broadcastSSE({ type: "heartbeat", ts: "2026-01-01T00:00:00.000Z" });
    forgeInstrumentation.broadcastSSE({ type: "test", value: 42 });

    expect(received).toHaveLength(2);
    expect(received[0]).toMatchObject({ type: "heartbeat" });
    expect(received[1]).toMatchObject({ type: "test", value: 42 });

    unsub();
    forgeInstrumentation.broadcastSSE({ type: "after_unsub" });
    expect(received).toHaveLength(2); // no new events after unsubscribe
  });

  it("13.4a — reset() clears all SSE subscribers", () => {
    const received: object[] = [];
    forgeInstrumentation.subscribeSSE((e) => received.push(e));
    forgeInstrumentation.reset();
    forgeInstrumentation.broadcastSSE({ type: "should_not_arrive" });
    expect(received).toHaveLength(0);
  });

  it("13.4a — LLM call events are fanned out to SSE subscribers", () => {
    const received: object[] = [];
    const unsub = forgeInstrumentation.subscribeSSE((e) => received.push(e));

    forgeInstrumentation.recordLLMCall({
      timestamp: new Date().toISOString(),
      model: "gpt-4o-mini",
      latency_ms: 200,
      prompt_tokens: 100,
      completion_tokens: 50,
      degraded: false,
    });

    expect(received).toHaveLength(1);
    expect((received[0] as Record<string, unknown>).type).toBe("llm_call");
    unsub();
  });
});

// ---------------------------------------------------------------------------
// recordUIAction (Task 13.4b)
// ---------------------------------------------------------------------------

describe("forgeInstrumentation.recordUIAction", () => {
  it("13.4b — increments counter per panel:action key", () => {
    forgeInstrumentation.recordUIAction("IngestionPanel", "open");
    forgeInstrumentation.recordUIAction("IngestionPanel", "open");
    forgeInstrumentation.recordUIAction("IngestionPanel", "submit");
    forgeInstrumentation.recordUIAction("AnalysisPanel", "open");

    const counters = forgeInstrumentation.getUIActionCounters();
    expect(counters["IngestionPanel:open"]).toBe(2);
    expect(counters["IngestionPanel:submit"]).toBe(1);
    expect(counters["AnalysisPanel:open"]).toBe(1);
  });

  it("13.4b — reset() clears all UI action counters", () => {
    forgeInstrumentation.recordUIAction("SettingsPanel", "save");
    forgeInstrumentation.reset();
    const counters = forgeInstrumentation.getUIActionCounters();
    expect(Object.keys(counters)).toHaveLength(0);
  });
});
