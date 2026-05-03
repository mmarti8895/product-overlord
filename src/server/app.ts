/**
 * HTTP application factory.
 *
 * Creates a Hono app wiring the four Forge endpoint handlers + /health.
 * The ForgeRequest/ForgeResponse adapter translates between Hono's Context
 * and the existing handler interfaces — no changes to endpoints.ts required.
 */

import { Hono } from "hono";
import type { Context } from "hono";
import {
  handleIngestIssue,
  handleIngestBoard,
  handleGetPlan,
  handleConfirmPost,
} from "../forge/endpoints.js";
import type { ForgeRequest } from "../forge/endpoints.js";
import type { ServerConfig } from "./config.js";
import { logger } from "../utils/logger.js";
import { KnowledgeBase } from "../knowledge/index.js";
import { createLLMAdapter } from "../llm/index.js";
import { FileTooLargeError, StoreFullError, UnsupportedFormatError } from "../knowledge/types.js";
import { z } from "zod";
import { ConnectionManager } from "../connections/ConnectionManager.js";
import { AgentEventBus } from "../agents/AgentEventBus.js";
import { AgentRegistry } from "../agents/AgentRegistry.js";
import { DecisionQueue } from "../decisions/DecisionQueue.js";
import { WorkflowEngine } from "../workflows/WorkflowEngine.js";
import { WorkflowScheduler } from "../workflows/WorkflowScheduler.js";
import { OrchestratorTeam } from "../orchestrators/OrchestratorTeam.js";
import { forgeInstrumentation } from "../forge/instrumentation.js";
import { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import { SprintMonitor } from "../services/sprint-monitor.js";
import { createSprintRouter } from "./routes/sprint.js";
import { RoadmapStore } from "../stores/roadmap-store.js";
import { createRoadmapRouter } from "./routes/roadmap.js";
import { TriageQueue } from "../stores/triage-queue.js";
import { ThemeClusterer } from "../services/theme-clusterer.js";
import { OpportunitySizer } from "../services/opportunity-sizer.js";
import { WebhookFeedbackAdapter } from "../adapters/feedback/webhook.js";
import { createDiscoveryRouter } from "./routes/discovery.js";
import { OKRStore } from "../stores/okr-store.js";
import { ReflectionAgent } from "../services/reflection-agent.js";
import { OutcomeSnapshotBuilder } from "../services/outcome-snapshot-builder.js";
import { WebhookMetricsAdapter } from "../adapters/metrics/webhook.js";
import { createOutcomesRouter } from "./routes/outcomes.js";
import { PortfolioStore } from "../stores/portfolio-store.js";
import { CrossProjectDependencyGraph } from "../services/cross-project-deps.js";
import { CapacityHeatmapBuilder } from "../services/capacity-heatmap.js";
import { PortfolioAggregator } from "../services/portfolio-aggregator.js";
import { PortfolioDigestWriter } from "../services/portfolio-digest.js";
import { createPortfolioRouter } from "./routes/portfolio.js";
import { DraftStore } from "../stores/draft-store.js";
import { KBStore } from "../knowledge/store.js";
import { PRDWriter } from "../services/prd-writer.js";
import { ConfluencePublisher } from "../services/confluence-publisher.js";
import { createPRDRouter } from "./routes/prd.js";

// ---------------------------------------------------------------------------
// Zod schemas for connection providers
// ---------------------------------------------------------------------------

const JiraSchema = z.object({
  baseUrl: z.string().url(),
  projectKey: z.string().min(1),
  token: z.string().min(1),
});

const OpenAISchema = z.object({
  apiKey: z.string().min(1),
  orgId: z.string().optional(),
  baseUrl: z.string().url().optional(),
  plannerModel: z.string().default("gpt-4o"),
  executorModel: z.string().default("gpt-4o-mini"),
  reviewerModel: z.string().default("gpt-4o-mini"),
  tpmBudget: z.number().int().positive().default(100_000),
  rpmBudget: z.number().int().positive().default(60),
});

const GitHubSchema = z.object({
  pat: z.string().optional(),
  appId: z.string().optional(),
  privateKey: z.string().optional(),
  repos: z.array(z.string()).default([]),
  branchFilter: z.string().default("main"),
});

const ProviderSchemas = { jira: JiraSchema, openai: OpenAISchema, github: GitHubSchema } as const;
type ValidProvider = keyof typeof ProviderSchemas;

// ---------------------------------------------------------------------------
// Hono → ForgeRequest adapter
// ---------------------------------------------------------------------------

async function toForgeRequest(c: Context): Promise<ForgeRequest> {
  const headers: Record<string, string | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const params: Record<string, string | undefined> = {};
  // Hono stores named params in c.req.param()
  try {
    const rawParams = c.req.param();
    if (rawParams && typeof rawParams === "object") {
      Object.assign(params, rawParams);
    }
  } catch {
    // no params
  }

  const query: Record<string, string | undefined> = {};
  const url = new URL(c.req.url);
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  let body: unknown;
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await c.req.json();
    } catch {
      body = undefined;
    }
  }

  return { headers, params, query, body };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createApp(config: ServerConfig): Hono {
  const app = new Hono();

  // ── Lazy KB singleton (created once per app instance) ───────────────────
  let _kb: KnowledgeBase | null = null;
  function getKB(): KnowledgeBase {
    if (!_kb) {
      _kb = new KnowledgeBase({
        storePath: config.kb.storePath,
        maxSizeGb: config.kb.maxSizeGb,
        adapter: createLLMAdapter({
          apiKey: config.llm.apiKey,
          baseUrl: config.llm.baseUrl,
          model: config.llm.model,
          embeddingModel: config.llm.embeddingModel,
          callsPerMinute: config.llm.callsPerMinute,
          degraded: config.llm.degraded,
        }),
      });
    }
    return _kb;
  }

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      version: "1.0.0",
      degraded: !config.featureFlags.jiraIngestionEnabled || !config.featureFlags.repoGroundingEnabled,
      featureFlags: config.featureFlags,
      sprint_board_ids: config.sprint.boardIds,
    });
  });

  // -------------------------------------------------------------------------
  // Forge routes
  // -------------------------------------------------------------------------

  app.post("/forge/ingest/issue", async (c) => {
    const req = await toForgeRequest(c);
    // Inject BASE_URL so confirm_post_url is always absolute
    req.query = { ...req.query, base_url: config.baseUrl };
    const res = await handleIngestIssue(req);
    return c.json(res.body, res.status as 200 | 401);
  });

  app.get("/forge/ingest/board/:id", async (c) => {
    const req = await toForgeRequest(c);
    req.query = { ...req.query, base_url: config.baseUrl };
    const res = await handleIngestBoard(req);
    return c.json(res.body, res.status as 200 | 400 | 401);
  });

  app.get("/forge/plan/:run_id", async (c) => {
    const req = await toForgeRequest(c);
    const res = await handleGetPlan(req);
    return c.json(res.body, res.status as 200 | 401 | 404);
  });

  app.post("/forge/output/confirm/:run_id", async (c) => {
    // Shadow-mode guard (invariant: no Jira writes in shadow mode)
    if (config.featureFlags.shadowModeOnly) {
      logger.warn("forge_confirm_blocked_shadow_mode", {
        run_id: c.req.param("run_id"),
      });
      return c.json({ error: "shadow mode active — confirm endpoint is disabled" }, 403);
    }
    const req = await toForgeRequest(c);
    const res = await handleConfirmPost(req);
    return c.json(res.body, res.status as 200 | 400 | 401 | 403 | 404);
  });

  // -------------------------------------------------------------------------
  // KB routes (Tasks 6.1–6.5)
  // -------------------------------------------------------------------------

  /** Shadow-mode guard for KB write endpoints */
  function kbWriteGuard(c: Context): Response | null {
    if (config.featureFlags.shadowModeOnly) {
      logger.warn("kb_write_blocked_shadow_mode", { path: c.req.path });
      return c.json({ error: "shadow mode active — KB writes are disabled" }, 403) as unknown as Response;
    }
    return null;
  }

  // POST /kb/ingest — multipart file upload
  app.post("/kb/ingest", async (c) => {
    const guard = kbWriteGuard(c);
    if (guard) return guard;

    const formData = await c.req.formData().catch(() => null);
    if (!formData) return c.json({ error: "multipart/form-data required" }, 400);

    const file = formData.get("file");
    const projectKey = String(formData.get("project_key") ?? "").trim();
    if (!projectKey) return c.json({ error: "project_key is required" }, 400);
    if (!file || typeof file === "string") return c.json({ error: "file field required" }, 400);

    const arrayBuffer = await (file as File).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = (file as File).name ?? "upload";

    try {
      const result = await getKB().ingestFile(buffer, filename, projectKey);
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof FileTooLargeError) return c.json({ error: err.message }, 413);
      if (err instanceof UnsupportedFormatError) return c.json({ error: err.message }, 422);
      if (err instanceof StoreFullError) return c.json({ error: err.message }, 507);
      logger.error("kb_ingest_error", { error: String(err) });
      return c.json({ error: "Internal error during ingestion" }, 500);
    }
  });

  // POST /kb/crawl — JSON body {url, project_key, depth?}
  app.post("/kb/crawl", async (c) => {
    const guard = kbWriteGuard(c);
    if (guard) return guard;

    const body = await c.req.json().catch(() => null) as { url?: string; project_key?: string; depth?: number } | null;
    if (!body?.url || !body?.project_key) {
      return c.json({ error: "url and project_key are required" }, 400);
    }

    try {
      const result = await getKB().crawlUrl(body.url, body.project_key, body.depth ?? 1);
      return c.json(result, 201);
    } catch (err) {
      if (err instanceof StoreFullError) return c.json({ error: err.message }, 507);
      logger.error("kb_crawl_error", { error: String(err) });
      return c.json({ error: "Internal error during crawl" }, 500);
    }
  });

  // GET /kb/sources?project_key=PROJ
  app.get("/kb/sources", async (c) => {
    const projectKey = c.req.query("project_key");
    if (!projectKey) return c.json({ error: "project_key query param required" }, 400);
    try {
      const sources = await getKB().listSources(projectKey);
      return c.json(sources, 200);
    } catch (err) {
      logger.error("kb_sources_error", { error: String(err) });
      return c.json({ error: "Internal error listing sources" }, 500);
    }
  });

  // DELETE /kb/sources/:id
  app.delete("/kb/sources/:id", async (c) => {
    const guard = kbWriteGuard(c);
    if (guard) return guard;

    const sourceId = c.req.param("id");
    if (!sourceId) return c.json({ error: "source id required" }, 400);
    try {
      await getKB().deleteSource(sourceId);
      return c.body(null, 204);
    } catch (err) {
      logger.error("kb_delete_error", { error: String(err) });
      return c.json({ error: "Internal error deleting source" }, 500);
    }
  });

  // -------------------------------------------------------------------------
  // UI API routes (GET /api/status, GET /api/config, GET /api/metrics SSE)
  // Gated by config.uiDevEndpoints (Task 5.4 / UI_DEV_ENDPOINTS env flag)
  // -------------------------------------------------------------------------

  const serverStartMs = Date.now();

  if (config.uiDevEndpoints) {
  // GET /api/status — server health snapshot for the desktop UI
  app.get("/api/status", (c) => {
    return c.json({
      server: "product-overlord",
      version: "1.0.0",
      shadow_mode: config.featureFlags.shadowModeOnly,
      degraded_flags: {
        llm: config.llm.degraded,
        repo: !config.featureFlags.repoGroundingEnabled,
        jira: !config.featureFlags.jiraIngestionEnabled,
        rovo: !config.featureFlags.rovoMcpEnabled,
      },
      uptime_ms: Date.now() - serverStartMs,
    });
  });

  // GET /api/config — sanitised config (credential fields redacted)
  app.get("/api/config", (c) => {
    function mask(v: string | undefined) { return v ? "[set]" : "[not set]"; }
    return c.json({
      nodeEnv: config.nodeEnv,
      baseUrl: config.baseUrl,
      port: config.port,
      jiraBaseUrl: config.jiraBaseUrl ?? "[not set]",
      jiraAccessToken: mask(config.jiraAccessToken),
      rovoMcpCloudId: mask(config.rovoMcpCloudId),
      rovoMcpAccessToken: mask(config.rovoMcpAccessToken),
      githubAccessToken: mask(config.githubAccessToken),
      bitbucketAccessToken: mask(config.bitbucketAccessToken),
      llmApiKey: mask(config.llm.apiKey),
      llmBaseUrl: config.llm.baseUrl,
      llmModel: config.llm.model,
      embeddingModel: config.llm.embeddingModel,
      kbStorePath: config.kb.storePath,
      kbMaxSizeGb: config.kb.maxSizeGb,
      featureFlags: config.featureFlags,
    });
  });

  // GET /api/metrics — SSE stream; fan-out via forgeInstrumentation (Task 13.2)
  app.get("/api/metrics", (c) => {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const send = (event: object) =>
      writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});

    // Subscribe to instrumentation events
    const unsub = forgeInstrumentation.subscribeSSE(send);

    // Heartbeat every 15 s (Task 13.2)
    const hb = setInterval(() => {
      send({ type: "heartbeat", ts: new Date().toISOString() });
    }, 15_000);

    // Write a welcome event
    send({ type: "connected", timestamp: new Date().toISOString() });

    c.req.raw.signal.addEventListener("abort", () => {
      unsub();
      clearInterval(hb);
      writer.close().catch(() => {});
    });

    return new Response(readable as unknown as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  } // end uiDevEndpoints

  // -------------------------------------------------------------------------
  // Connection routes
  // -------------------------------------------------------------------------

  const connMgr = ConnectionManager.instance;
  const VALID_PROVIDERS: ValidProvider[] = ["jira", "openai", "github"];

  function isValidProvider(p: string): p is ValidProvider {
    return VALID_PROVIDERS.includes(p as ValidProvider);
  }

  app.get("/api/connections/:provider", (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const config = connMgr.load(provider);
    return config ? c.json(config) : c.json({ configured: false }, 404);
  });

  app.post("/api/connections/:provider", async (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const schema = ProviderSchemas[provider];
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    connMgr.save(provider, parsed.data as never);
    return c.json({ ok: true });
  });

  app.post("/api/connections/:provider/test", async (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const result = await connMgr.test(provider);
    return c.json(result, result.ok ? 200 : 502);
  });

  // -------------------------------------------------------------------------
  // Decision routes
  // -------------------------------------------------------------------------

  app.get("/api/decisions/stream", (c) => {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = DecisionQueue.subscribe(d => {
      writer.write(enc.encode(`data: ${JSON.stringify(d)}\n\n`)).catch(() => {});
    });
    // Send current pending decisions as replay
    for (const d of DecisionQueue.list()) {
      writer.write(enc.encode(`data: ${JSON.stringify(d)}\n\n`)).catch(() => {});
    }
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return new Response(readable as unknown as ReadableStream<Uint8Array>, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
    });
  });

  app.get("/api/decisions", (c) => {
    const status = c.req.query("status") as Parameters<typeof DecisionQueue.list>[0];
    return c.json(DecisionQueue.list(status));
  });

  app.post("/api/decisions/:id/approve", (c) => {
    const d = DecisionQueue.approve(c.req.param("id"));
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });

  app.post("/api/decisions/:id/reject", async (c) => {
    let reason: string | undefined;
    try { const b = await c.req.json(); reason = b?.reason; } catch { /* ok */ }
    const d = DecisionQueue.reject(c.req.param("id"), reason);
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });

  app.post("/api/decisions/:id/modify", async (c) => {
    let patch: unknown;
    try { const b = await c.req.json(); patch = b?.patch; } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const d = DecisionQueue.modify(c.req.param("id"), patch);
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });

  // -------------------------------------------------------------------------
  // Workflow routes
  // -------------------------------------------------------------------------

  WorkflowScheduler.load();

  app.get("/api/workflows/schedules", (c) => c.json(WorkflowScheduler.list()));

  app.post("/api/workflows/schedules", async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const parsed = z.object({
      name: z.string().min(1),
      cron_expr: z.string().min(1),
      stages: z.array(z.string()).min(1),
      enabled: z.boolean().default(true),
    }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    const schedule = WorkflowScheduler.upsert(parsed.data);
    return c.json(schedule, 201);
  });

  app.delete("/api/workflows/schedules/:id", (c) => {
    const ok = WorkflowScheduler.delete(c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Not found" }, 404);
  });

  app.post("/api/workflows/plan", async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const parsed = z.object({ stages: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed" }, 422);
    const result = await WorkflowEngine.plan(parsed.data.stages);
    return c.json(result);
  });

  app.post("/api/workflows/run", async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const parsed = z.object({ stages: z.array(z.string()).min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed" }, 422);
    const run_id = await WorkflowEngine.run(parsed.data.stages);
    return c.json({ run_id }, 202);
  });

  app.get("/api/workflows/runs", (c) => c.json(WorkflowEngine.listRuns()));

  app.get("/api/workflows/runs/:run_id/logs", (c) => {
    const run_id = c.req.param("run_id");
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = AgentEventBus.subscribe(e => {
      if (e.run_id === run_id) writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {});
    });
    // Replay relevant past events
    for (const e of AgentEventBus.replay()) {
      if (e.run_id === run_id) writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {});
    }
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return new Response(readable as unknown as ReadableStream<Uint8Array>, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
    });
  });

  app.post("/api/workflows/:run_id/stop", (c) => {
    const force = c.req.query("force") === "true";
    const ok = WorkflowEngine.stop(c.req.param("run_id"));
    return ok ? c.json({ ok: true, force }) : c.json({ error: "Run not found or already finished" }, 404);
  });

  // -------------------------------------------------------------------------
  // Agent routes
  // -------------------------------------------------------------------------

  app.get("/api/agents", (c) => {
    return c.json(AgentRegistry.listRuns().map(r => ({ name: r.name, run_id: r.run_id, started_at: r.started_at, parent_run_id: r.parent_run_id })));
  });

  app.post("/api/agents", async (c) => {
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: "Invalid JSON" }, 400); }
    const { buildAgent, CAPABILITY_REGISTRY } = await import("../agents/CustomAgentBuilder.js");
    const parsed = z.object({
      name: z.string().min(1),
      description: z.string().default(""),
      role: z.enum(["planner", "executor", "reviewer", "orchestrator"]),
      persona: z.string().default(""),
      skills: z.array(z.string()).default([]),
      maxConcurrency: z.number().int().min(1).max(20).default(4),
      rpmCap: z.number().int().positive().default(60),
      tpmCap: z.number().int().positive().default(100_000),
      retryPolicy: z.enum(["none", "exponential", "fixed"]).default("exponential"),
    }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    const agent = buildAgent(parsed.data);
    void CAPABILITY_REGISTRY; // used in UI
    return c.json({ name: agent.name, dir: agent.dir }, 201);
  });

  app.get("/api/agents/stream", (c) => {
    const agentFilter = c.req.query("agent");
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = AgentEventBus.subscribe(e => {
      if (!agentFilter || e.agent === agentFilter)
        writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {});
    });
    for (const e of AgentEventBus.replay(agentFilter)) {
      writer.write(enc.encode(`data: ${JSON.stringify(e)}\n\n`)).catch(() => {});
    }
    c.req.raw.signal.addEventListener("abort", () => { unsub(); writer.close().catch(() => {}); });
    return new Response(readable as unknown as ReadableStream<Uint8Array>, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
    });
  });

  app.post("/api/agents/:run_id/stop", (c) => {
    const ok = AgentRegistry.stopRun(c.req.param("run_id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Run not found" }, 404);
  });

  app.post("/api/agents/stop-all", (_c) => {
    const runs = AgentRegistry.listRuns();
    for (const r of runs) AgentRegistry.stopRun(r.run_id);
    WorkflowEngine.listRuns().filter(r => r.status === "running").forEach(r => WorkflowEngine.stop(r.run_id));
    return _c.json({ stopped: runs.length });
  });

  // -------------------------------------------------------------------------
  // Orchestrator routes
  // -------------------------------------------------------------------------

  OrchestratorTeam.start();

  app.get("/api/orchestrators/findings", (c) => {
    const status = c.req.query("status") as Parameters<typeof OrchestratorTeam.list>[0];
    return c.json(OrchestratorTeam.list(status));
  });

  app.post("/api/orchestrators/findings/:id/ack", (c) => {
    const f = OrchestratorTeam.ack(c.req.param("id"));
    return f ? c.json(f) : c.json({ error: "Not found" }, 404);
  });

  app.post("/api/orchestrators/findings/:id/escalate", (c) => {
    const f = OrchestratorTeam.escalate(c.req.param("id"));
    return f ? c.json(f) : c.json({ error: "Not found" }, 404);
  });

  app.post("/api/orchestrators/:name/stop", (c) => {
    const count = AgentRegistry.stopAgent(c.req.param("name"));
    return c.json({ stopped_runs: count });
  });

  // -------------------------------------------------------------------------
  // Sprint monitoring routes (task 3.2)
  // -------------------------------------------------------------------------

  if (config.featureFlags.jiraIngestionEnabled && config.sprint?.boardIds?.length > 0) {
    const jiraAgile = new JiraAgileRestAdapter({
      baseUrl: config.jiraBaseUrl!,
      accessToken: config.jiraAccessToken,
    });
    const sprintMonitor = new SprintMonitor(jiraAgile, config.sprint);
    sprintMonitor.start();
    app.route("/api/sprint", createSprintRouter(sprintMonitor));

    // Roadmap store (roadmap-planning)
    const llmAdapter = createLLMAdapter({
      apiKey: config.llm.apiKey,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
      embeddingModel: config.llm.embeddingModel,
      callsPerMinute: config.llm.callsPerMinute,
      degraded: config.llm.degraded,
    });
    const roadmapStore = new RoadmapStore(jiraAgile, llmAdapter, {}, async () => []);
    app.route("/api/roadmap", createRoadmapRouter(roadmapStore));

    // ── Discovery-intake (task 3.2) ──────────────────────────────────────
    const storePath = process.env.LANCEDB_PATH ?? "./data/lancedb";
    const webhookFeedback = new WebhookFeedbackAdapter();
    const triageQueue     = new TriageQueue(storePath, jiraAgile);
    const themeClusterer  = new ThemeClusterer(llmAdapter);
    const opportunitySizer = new OpportunitySizer(llmAdapter);
    app.route("/api/discovery", createDiscoveryRouter(
      triageQueue, themeClusterer, opportunitySizer, [webhookFeedback], webhookFeedback,
    ));

    // ── Outcome-tracking (task 3.3) ──────────────────────────────────────
    const okrStore          = new OKRStore(storePath);
    const reflectionAgent   = new ReflectionAgent(llmAdapter);
    const webhookMetrics    = new WebhookMetricsAdapter();
    const snapshotBuilder   = new OutcomeSnapshotBuilder(okrStore, [webhookMetrics], reflectionAgent);
    app.route("/api/outcomes", createOutcomesRouter(okrStore, snapshotBuilder, webhookMetrics));

    // ── Portfolio-management (task 3.4) ──────────────────────────────────
    const portfolioStore    = new PortfolioStore(storePath);
    const crossProjectDeps  = new CrossProjectDependencyGraph(roadmapStore);
    const capacityHeatmap   = new CapacityHeatmapBuilder(roadmapStore, config.sprint?.sprintLengthDays ?? 14);
    const portfolioAgg      = new PortfolioAggregator(portfolioStore, roadmapStore, crossProjectDeps, capacityHeatmap);
    const digestWriter      = new PortfolioDigestWriter(llmAdapter, {
      slackWebhookUrl:      process.env.SLACK_WEBHOOK_URL,
      confluenceBaseUrl:    config.confluenceBaseUrl,
      confluenceToken:      config.confluenceToken,
      confluenceSpaceKey:   process.env.CONFLUENCE_SPACE_KEY,
    });
    app.route("/api/portfolio", createPortfolioRouter(portfolioStore, portfolioAgg, digestWriter));

    // ── PRD-generation (task 3.5) ─────────────────────────────────────────
    const draftStore        = new DraftStore(storePath);
    const kbStore           = new KBStore(storePath);
    const prdWriter         = new PRDWriter(draftStore, kbStore, llmAdapter);
    const confluencePublisher = config.confluenceBaseUrl && config.confluenceToken
      ? new ConfluencePublisher({
          baseUrl:  config.confluenceBaseUrl,
          token:    config.confluenceToken,
          spaceKey: process.env.CONFLUENCE_SPACE_KEY ?? "PROD",
        })
      : null;
    app.route("/api/prd", createPRDRouter(draftStore, prdWriter, confluencePublisher));
  } else {
    app.get("/api/sprint/*", (c) =>
      c.json({ ok: false, error: { code: "JIRA_NOT_CONFIGURED", message: "Jira integration is not enabled" } }, 503)
    );
    app.get("/api/roadmap/*", (c) =>
      c.json({ ok: false, error: { code: "JIRA_NOT_CONFIGURED", message: "Jira integration is not enabled" } }, 503)
    );
  }

  // -------------------------------------------------------------------------
  // 404 fallback
  // -------------------------------------------------------------------------

  app.notFound((c) => {
    return c.json({ error: "not found" }, 404);
  });

  return app;
}
