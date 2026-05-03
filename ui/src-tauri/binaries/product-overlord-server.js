var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/connections/providers/JiraProvider.ts
var JiraProvider_exports = {};
__export(JiraProvider_exports, {
  testJira: () => testJira
});
async function testJira(config2) {
  const url = `${config2.baseUrl.replace(/\/$/, "")}/rest/api/3/myself`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config2.token}`,
      Accept: "application/json"
    }
  });
  if (!res.ok) throw new Error(`Jira probe failed: ${res.status} ${res.statusText}`);
}
var init_JiraProvider = __esm({
  "src/connections/providers/JiraProvider.ts"() {
    "use strict";
  }
});

// src/connections/providers/OpenAIProvider.ts
var OpenAIProvider_exports = {};
__export(OpenAIProvider_exports, {
  testOpenAI: () => testOpenAI
});
async function testOpenAI(config2) {
  const base = (config2.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const res = await fetch(`${base}/models`, {
    headers: {
      Authorization: `Bearer ${config2.apiKey}`,
      ...config2.orgId ? { "OpenAI-Organization": config2.orgId } : {}
    }
  });
  if (!res.ok) throw new Error(`OpenAI probe failed: ${res.status} ${res.statusText}`);
}
var init_OpenAIProvider = __esm({
  "src/connections/providers/OpenAIProvider.ts"() {
    "use strict";
  }
});

// src/connections/providers/GitHubProvider.ts
var GitHubProvider_exports = {};
__export(GitHubProvider_exports, {
  testGitHub: () => testGitHub
});
async function testGitHub(config2) {
  if (config2.pat) {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${config2.pat}`,
        Accept: "application/vnd.github+json"
      }
    });
    if (!res.ok) throw new Error(`GitHub PAT probe failed: ${res.status} ${res.statusText}`);
  } else if (config2.appId) {
    const res = await fetch(`https://api.github.com/app`, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
    if (!res.ok) throw new Error(`GitHub App probe failed: ${res.status} ${res.statusText}`);
  } else {
    throw new Error("No GitHub credentials configured (need pat or appId)");
  }
}
var init_GitHubProvider = __esm({
  "src/connections/providers/GitHubProvider.ts"() {
    "use strict";
  }
});

// src/agents/CustomAgentBuilder.ts
var CustomAgentBuilder_exports = {};
__export(CustomAgentBuilder_exports, {
  CAPABILITY_REGISTRY: () => CAPABILITY_REGISTRY,
  buildAgent: () => buildAgent
});
import { mkdirSync as mkdirSync5, writeFileSync as writeFileSync4 } from "fs";
import { join as join4 } from "path";
function buildAgent(spec) {
  const agentsMd = `# ${spec.name}

## Role
${spec.role}

## Description
${spec.description}

## Parallelization
- Max concurrency: ${spec.maxConcurrency}
- RPM cap: ${spec.rpmCap}
- TPM cap: ${spec.tpmCap}
- Retry policy: ${spec.retryPolicy}
`;
  const soulMd = `# Soul \u2014 ${spec.name}

${spec.persona}
`;
  const skillsMd = `# Skills \u2014 ${spec.name}

${spec.skills.map((s) => `- ${s}`).join("\n")}
`;
  const dir = join4(AGENTS_DIR, spec.name.toLowerCase().replace(/\s+/g, "-"));
  mkdirSync5(dir, { recursive: true });
  writeFileSync4(join4(dir, "AGENTS.md"), agentsMd);
  writeFileSync4(join4(dir, "SOUL.md"), soulMd);
  writeFileSync4(join4(dir, "SKILLS.md"), skillsMd);
  return { name: spec.name, dir, files: { "AGENTS.md": agentsMd, "SOUL.md": soulMd, "SKILLS.md": skillsMd } };
}
var AGENTS_DIR, CAPABILITY_REGISTRY;
var init_CustomAgentBuilder = __esm({
  "src/agents/CustomAgentBuilder.ts"() {
    "use strict";
    AGENTS_DIR = process.env.AGENTS_DIR ?? "agents";
    CAPABILITY_REGISTRY = [
      "jira-read",
      "jira-write",
      "github-read",
      "github-write",
      "web-crawl",
      "embed-text",
      "search-kb",
      "call-llm",
      "run-eval",
      "write-report",
      "send-notification",
      "manage-workflows",
      "monitor-agents"
    ];
  }
});

// src/index.ts
import { serve } from "@hono/node-server";
import { config as loadDotenv } from "dotenv";

// src/server/config.ts
import { z } from "zod";

// src/utils/logger.ts
function log(level, message, context) {
  const entry = {
    level,
    message,
    context,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const line = JSON.stringify(entry);
  if (level === "warn" || level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}
var logger = {
  info: (message, context) => log("info", message, context),
  warn: (message, context) => log("warn", message, context),
  error: (message, context) => log("error", message, context),
  debug: (message, context) => log("debug", message, context),
  /** Emit a structured adapter-call trace entry */
  adapterCall(params) {
    log("info", "adapter_call", params);
  }
};

// src/server/config.ts
var ServerEnvSchema = z.object({
  PORT: z.coerce.number().default(3e3),
  BASE_URL: z.string().url({ message: "BASE_URL must be a valid URL (e.g. https://overlord.example.com)" }),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Jira Agile REST
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_ACCESS_TOKEN: z.string().optional(),
  // Rovo MCP
  ROVO_MCP_CLOUD_ID: z.string().optional(),
  ROVO_MCP_ACCESS_TOKEN: z.string().optional(),
  // Repo adapters
  GITHUB_ACCESS_TOKEN: z.string().optional(),
  BITBUCKET_ACCESS_TOKEN: z.string().optional(),
  // Feature flags
  SHADOW_MODE: z.string().default("false").transform((v) => v === "true"),
  FEATURE_ROVO_AGENT_CONNECTOR: z.string().default("false").transform((v) => v === "true"),
  // LLM / Knowledge Base
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  KB_STORE_PATH: z.string().default("./.kb"),
  KB_MAX_SIZE_GB: z.coerce.number().default(5),
  LLM_CALLS_PER_MINUTE: z.coerce.number().default(60),
  DEGRADED_LLM: z.string().default("false").transform((v) => v === "true"),
  // UI developer endpoints (/api/status, /api/config, /api/metrics)
  UI_DEV_ENDPOINTS: z.string().default("true").transform((v) => v !== "false"),
  // Sprint monitoring
  SPRINT_POLL_INTERVAL_MS: z.coerce.number().default(3e5),
  SPRINT_DONE_STATUSES: z.string().default("Done,Closed,Resolved").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  SPRINT_BOARD_IDS: z.string().default("").transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  SPRINT_LENGTH_DAYS: z.coerce.number().default(14),
  // Confluence
  CONFLUENCE_BASE_URL: z.string().url().optional(),
  CONFLUENCE_TOKEN: z.string().optional()
});
function loadConfig(env = process.env) {
  const result = ServerEnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  \u2022 ${i.path.join(".")}: ${i.message}`).join("\n");
    const msg = `product-overlord: invalid environment configuration
${issues}`;
    logger.error("server_config_invalid", { issues: result.error.issues });
    throw new Error(msg);
  }
  const e = result.data;
  const repoGroundingEnabled = Boolean(e.GITHUB_ACCESS_TOKEN || e.BITBUCKET_ACCESS_TOKEN);
  const jiraIngestionEnabled = Boolean(e.JIRA_BASE_URL && e.JIRA_ACCESS_TOKEN);
  const rovoMcpEnabled = Boolean(e.ROVO_MCP_CLOUD_ID && e.ROVO_MCP_ACCESS_TOKEN);
  const degraded = {
    "repo-grounding": repoGroundingEnabled,
    "jira-ingestion": jiraIngestionEnabled,
    "rovo-mcp": rovoMcpEnabled,
    "shadow-mode": e.SHADOW_MODE,
    "a2a": e.FEATURE_ROVO_AGENT_CONNECTOR
  };
  const degradedCapabilities = Object.entries(degraded).filter(([, v]) => !v).map(([k]) => k);
  if (degradedCapabilities.length > 0) {
    logger.warn("server_degraded_mode", { degraded_capabilities: degradedCapabilities });
  }
  return {
    port: e.PORT,
    baseUrl: e.BASE_URL,
    nodeEnv: e.NODE_ENV,
    jiraBaseUrl: e.JIRA_BASE_URL,
    jiraAccessToken: e.JIRA_ACCESS_TOKEN,
    rovoMcpCloudId: e.ROVO_MCP_CLOUD_ID,
    rovoMcpAccessToken: e.ROVO_MCP_ACCESS_TOKEN,
    githubAccessToken: e.GITHUB_ACCESS_TOKEN,
    bitbucketAccessToken: e.BITBUCKET_ACCESS_TOKEN,
    featureFlags: {
      repoGroundingEnabled,
      jiraIngestionEnabled,
      rovoMcpEnabled,
      shadowModeOnly: e.SHADOW_MODE,
      a2aEnabled: e.FEATURE_ROVO_AGENT_CONNECTOR,
      llmEnabled: Boolean(e.LLM_API_KEY) && !e.DEGRADED_LLM
    },
    llm: {
      apiKey: e.LLM_API_KEY,
      baseUrl: e.LLM_BASE_URL,
      model: e.LLM_MODEL,
      embeddingModel: e.EMBEDDING_MODEL,
      callsPerMinute: e.LLM_CALLS_PER_MINUTE,
      degraded: e.DEGRADED_LLM || !e.LLM_API_KEY
    },
    kb: {
      storePath: e.KB_STORE_PATH,
      maxSizeGb: e.KB_MAX_SIZE_GB
    },
    uiDevEndpoints: e.UI_DEV_ENDPOINTS,
    confluenceBaseUrl: e.CONFLUENCE_BASE_URL,
    confluenceToken: e.CONFLUENCE_TOKEN,
    sprint: {
      pollIntervalMs: e.SPRINT_POLL_INTERVAL_MS,
      doneStatuses: e.SPRINT_DONE_STATUSES,
      boardIds: e.SPRINT_BOARD_IDS,
      sprintLengthDays: e.SPRINT_LENGTH_DAYS
    }
  };
}

// src/server/app.ts
import { Hono as Hono7 } from "hono";

// src/forge/endpoints.ts
import { randomUUID as randomUUID2 } from "crypto";

// src/adapters/ingestion-orchestrator.ts
var IngestionOrchestrator = class {
  constructor(rovo, agile) {
    this.rovo = rovo;
    this.agile = agile;
  }
  rovo;
  agile;
  // -------------------------------------------------------------------------
  // Board sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------
  async ingestBoard(boardId) {
    const traces = [];
    try {
      const { issues, trace } = await this.agile.getBoardIssues(boardId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = err.trace;
      if (failedTrace) {
        traces.push({ ...failedTrace, degraded: true });
      }
      logger.warn("adapter_degraded: jira-agile-rest \u2014 falling back to Rovo MCP", {
        boardId,
        error: String(err)
      });
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint in openSprints() ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) }
      };
    }
  }
  // -------------------------------------------------------------------------
  // Backlog sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------
  async ingestBacklog(boardId) {
    const traces = [];
    try {
      const { issues, trace } = await this.agile.getBacklogIssues(boardId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = err.trace;
      if (failedTrace) traces.push({ ...failedTrace, degraded: true });
      logger.warn("adapter_degraded: jira-agile-rest (backlog) \u2014 falling back to Rovo MCP", {
        boardId,
        error: String(err)
      });
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint is EMPTY AND statusCategory != Done ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) }
      };
    }
  }
  // -------------------------------------------------------------------------
  // Sprint sweep — primary: Agile REST, fallback: Rovo MCP JQL
  // -------------------------------------------------------------------------
  async ingestSprint(sprintId) {
    const traces = [];
    try {
      const { issues, trace } = await this.agile.getSprintIssues(sprintId);
      traces.push(trace);
      return { issues, traces };
    } catch (err) {
      const failedTrace = err.trace;
      if (failedTrace) traces.push({ ...failedTrace, degraded: true });
      logger.warn("adapter_degraded: jira-agile-rest (sprint) \u2014 falling back to Rovo MCP", {
        sprintId,
        error: String(err)
      });
      const { result, trace: rvTrace } = await this.rovo.searchIssues(
        `sprint = ${sprintId} ORDER BY created DESC`
      );
      traces.push(rvTrace);
      return {
        issues: result.issues,
        traces,
        degraded: { adapter: "jira-agile-rest", reason: String(err) }
      };
    }
  }
  // -------------------------------------------------------------------------
  // Direct issue key — always Rovo MCP
  // -------------------------------------------------------------------------
  async ingestIssue(issueKey) {
    const { issue, trace } = await this.rovo.getIssue(issueKey);
    return { issues: [issue], traces: [trace] };
  }
  // -------------------------------------------------------------------------
  // JQL search — always Rovo MCP
  // -------------------------------------------------------------------------
  async ingestJql(jql, opts = {}) {
    const { result, trace } = await this.rovo.searchIssues(jql);
    const traces = [trace];
    let issues = result.issues;
    const inaccessibleProjects = [];
    if (opts.accessibleProjects && opts.accessibleProjects.length > 0) {
      const accessible = new Set(opts.accessibleProjects.map((p) => p.toUpperCase()));
      const before = issues.length;
      issues = issues.filter((i) => {
        const proj = i.key.split("-")[0].toUpperCase();
        if (!accessible.has(proj)) {
          if (!inaccessibleProjects.includes(proj)) inaccessibleProjects.push(proj);
          return false;
        }
        return true;
      });
      if (before !== issues.length) {
        logger.warn("permission_filter: removed inaccessible project issues", {
          inaccessibleProjects,
          removed: before - issues.length
        });
      }
    }
    return { issues, traces, inaccessibleProjects };
  }
  // -------------------------------------------------------------------------
  // Natural-language search — always Rovo MCP
  // -------------------------------------------------------------------------
  async ingestNaturalLanguage(query) {
    const { issues, trace } = await this.rovo.naturalLanguageSearch(query);
    return { issues, traces: [trace] };
  }
  // -------------------------------------------------------------------------
  // Both-adapters-down guard — used by callers to detect total failure
  // -------------------------------------------------------------------------
  static isTotalFailure(err) {
    const msg = String(err);
    return msg.includes("adapter_unavailable") || msg.includes("failed");
  }
};

// src/utils/retry.ts
async function withRetry(fn, options = {}) {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// src/adapters/rovo-mcp.ts
var RovoMcpAdapter = class {
  baseUrl;
  cloudId;
  headers;
  retryDelayMs;
  constructor(config2) {
    this.baseUrl = config2.baseUrl.replace(/\/$/, "");
    this.cloudId = config2.cloudId;
    this.retryDelayMs = config2.retryDelayMs ?? 200;
    if (config2.accessToken) {
      this.headers = {
        Authorization: `Bearer ${config2.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
    } else if (config2.email && config2.apiToken) {
      const token = Buffer.from(`${config2.email}:${config2.apiToken}`).toString("base64");
      this.headers = {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
    } else {
      throw new Error("RovoMcpAdapter: provide either accessToken or email+apiToken");
    }
  }
  // -------------------------------------------------------------------------
  // getIssue
  // -------------------------------------------------------------------------
  async getIssue(issueKey) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const issue = await withRetry(
        async () => {
          retryCount++;
          const res = await fetch(
            `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/issue/${issueKey}?expand=renderedFields,names`,
            { headers: this.headers }
          );
          statusCode = res.status;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        },
        { baseDelayMs: this.retryDelayMs }
      );
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount);
      return { issue, trace };
    } catch (err) {
      const trace = this._trace("getIssue", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.getIssue failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // searchIssues (JQL)
  // -------------------------------------------------------------------------
  async searchIssues(jql, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const result = await withRetry(async () => {
        retryCount++;
        const res = await fetch(
          `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/search`,
          {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
              jql,
              maxResults: opts.maxResults ?? 50,
              startAt: opts.startAt ?? 0,
              fields: ["*all"]
            })
          }
        );
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount);
      return { result, trace };
    } catch (err) {
      const trace = this._trace("searchIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.searchIssues failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // naturalLanguageSearch  (Rovo search endpoint)
  // -------------------------------------------------------------------------
  async naturalLanguageSearch(query, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const res = await fetch(`${this.baseUrl}/search`, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({ query, limit: opts.limit ?? 20, cloudId: this.cloudId })
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount);
      return { issues: data.results, trace };
    } catch (err) {
      const trace = this._trace("naturalLanguageSearch", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.naturalLanguageSearch failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // getProject
  // -------------------------------------------------------------------------
  async getProject(projectKey) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const project = await withRetry(async () => {
        retryCount++;
        const res = await fetch(
          `${this.baseUrl}/ex/jira/${this.cloudId}/rest/api/3/project/${projectKey}`,
          { headers: this.headers }
        );
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount);
      return { project, trace };
    } catch (err) {
      const trace = this._trace("getProject", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`RovoMcp.getProject failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  _trace(operation, statusCode, latencyMs, retryCount, error) {
    const trace = {
      adapter: "rovo-mcp",
      operation,
      statusCode,
      latencyMs,
      retryCount,
      error
    };
    logger.adapterCall({ adapter: "rovo-mcp", operation, statusCode, latencyMs, retryCount, error });
    return trace;
  }
};

// src/adapters/jira-agile-rest.ts
var JiraAgileRestAdapter = class {
  baseUrl;
  agileBase;
  headers;
  retryDelayMs;
  constructor(config2) {
    this.baseUrl = config2.baseUrl.replace(/\/$/, "");
    this.agileBase = `${this.baseUrl}/rest/agile/1.0`;
    this.retryDelayMs = config2.retryDelayMs ?? 200;
    if (config2.accessToken) {
      this.headers = {
        Authorization: `Bearer ${config2.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
    } else if (config2.email && config2.apiToken) {
      const token = Buffer.from(`${config2.email}:${config2.apiToken}`).toString("base64");
      this.headers = {
        Authorization: `Basic ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      };
    } else {
      throw new Error("JiraAgileRestAdapter: provide either accessToken or email+apiToken");
    }
  }
  // -------------------------------------------------------------------------
  // listBoards
  // -------------------------------------------------------------------------
  async listBoards(opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams();
        if (opts.projectKeyOrId) params.set("projectKeyOrId", opts.projectKeyOrId);
        params.set("maxResults", String(opts.maxResults ?? 50));
        params.set("startAt", String(opts.startAt ?? 0));
        const res = await fetch(`${this.agileBase}/board?${params}`, { headers: this.headers });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("listBoards", statusCode, Date.now() - start, retryCount);
      return { boards: data.values, trace };
    } catch (err) {
      const trace = this._trace("listBoards", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.listBoards failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // getBoardIssues
  // -------------------------------------------------------------------------
  async getBoardIssues(boardId, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0)
        });
        const res = await fetch(`${this.agileBase}/board/${boardId}/issue?${params}`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBoardIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getBoardIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBoardIssues failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // getBacklogIssues
  // -------------------------------------------------------------------------
  async getBacklogIssues(boardId, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0)
        });
        const res = await fetch(`${this.agileBase}/board/${boardId}/backlog?${params}`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBacklogIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getBacklogIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBacklogIssues failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // getSprintIssues
  // -------------------------------------------------------------------------
  async getSprintIssues(sprintId, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({
          maxResults: String(opts.maxResults ?? 50),
          startAt: String(opts.startAt ?? 0)
        });
        const res = await fetch(`${this.agileBase}/sprint/${sprintId}/issue?${params}`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getSprintIssues", statusCode, Date.now() - start, retryCount);
      return { issues: data.issues, trace };
    } catch (err) {
      const trace = this._trace("getSprintIssues", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getSprintIssues failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // getBoardConfig
  // -------------------------------------------------------------------------
  async getBoardConfig(boardId) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const config2 = await withRetry(async () => {
        retryCount++;
        const res = await fetch(`${this.agileBase}/board/${boardId}/configuration`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getBoardConfig", statusCode, Date.now() - start, retryCount);
      return { config: config2, trace };
    } catch (err) {
      const trace = this._trace("getBoardConfig", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getBoardConfig failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // listSprints
  // -------------------------------------------------------------------------
  async listSprints(boardId, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 50) });
        if (opts.state) params.set("state", opts.state);
        const res = await fetch(`${this.agileBase}/board/${boardId}/sprint?${params}`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("listSprints", statusCode, Date.now() - start, retryCount);
      return { sprints: data.values, trace };
    } catch (err) {
      const trace = this._trace("listSprints", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.listSprints failed: ${err}`), { trace });
    }
  }
  async getEpicsForBoard(boardId, opts = {}) {
    const start = Date.now();
    let retryCount = 0;
    let statusCode;
    try {
      const data = await withRetry(async () => {
        retryCount++;
        const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 100) });
        const res = await fetch(`${this.agileBase}/board/${boardId}/epic?${params}`, {
          headers: this.headers
        });
        statusCode = res.status;
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      }, { baseDelayMs: this.retryDelayMs });
      retryCount = Math.max(0, retryCount - 1);
      const trace = this._trace("getEpicsForBoard", statusCode, Date.now() - start, retryCount);
      return { epics: data.values, trace };
    } catch (err) {
      const trace = this._trace("getEpicsForBoard", statusCode, Date.now() - start, retryCount, String(err));
      throw Object.assign(new Error(`JiraAgile.getEpicsForBoard failed: ${err}`), { trace });
    }
  }
  // -------------------------------------------------------------------------
  // createStory — creates a Story issue in the given project
  // -------------------------------------------------------------------------
  async createStory(projectKey, opts) {
    const start = Date.now();
    let statusCode;
    try {
      const body = {
        fields: {
          project: { key: projectKey },
          summary: opts.summary,
          description: opts.description,
          issuetype: { name: "Story" },
          labels: opts.labels ?? []
        }
      };
      const resp = await fetch(`${this.baseUrl}/rest/api/3/issue`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(body)
      });
      statusCode = resp.status;
      if (!resp.ok) throw new Error(`Jira createStory HTTP ${resp.status}`);
      const data = await resp.json();
      this._trace("createStory", statusCode, Date.now() - start, 0);
      return data.key;
    } catch (err) {
      this._trace("createStory", statusCode, Date.now() - start, 0, String(err));
      throw err;
    }
  }
  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------
  _trace(operation, statusCode, latencyMs, retryCount, error) {
    const trace = {
      adapter: "jira-agile-rest",
      operation,
      statusCode,
      latencyMs,
      retryCount,
      error
    };
    logger.adapterCall({ adapter: "jira-agile-rest", operation, statusCode, latencyMs, retryCount, error });
    return trace;
  }
};

// src/normaliser/normalise.ts
var AC_ALIASES = [
  "Acceptance Criteria",
  "AC",
  "ACs",
  "Business Requirements",
  "Functional Requirements",
  "Requirements",
  "Definition of Done",
  "DoD"
];
var BLOCKER_RELATIONSHIPS = /* @__PURE__ */ new Set([
  "is blocked by",
  "depends on",
  "blocks",
  "clones",
  "is cloned by",
  "relates to",
  "duplicates",
  "is duplicated by"
]);
function normaliseTicket(raw, opts = {}) {
  const f = raw.fields;
  return {
    ticket_key: raw.key,
    ticket_type: resolveIssueType(f),
    summary: str(f["summary"]),
    description: resolveDescription(f),
    acceptance_criteria: resolveAc(f).value,
    ac_field_source: resolveAc(f).source,
    issue_type: str(f["issuetype"]?.["name"]),
    status: str(f["status"]?.["name"]),
    labels: strArray(f["labels"]),
    priority: str(f["priority"]?.["name"]),
    reporter: resolveUser(f["reporter"]),
    assignee: resolveUser(f["assignee"]) || null,
    linked_artifacts: resolveLinkedArtifacts(f),
    dependencies: resolveDependencies(f),
    comments: resolveComments(f),
    board_id: opts.boardId ?? null,
    sprint_id: opts.sprintId ?? resolveSprintId(f),
    epic_key: str(f["epic"]?.["key"]) || null,
    fix_versions: strArray(
      (f["fixVersions"] ?? []).map((v) => v.name ?? "")
    ),
    raw_fields: f
  };
}
function resolveAc(fields) {
  for (const alias of AC_ALIASES) {
    const val = fields[alias];
    if (val && typeof val === "string" && val.trim().length > 0) {
      return { value: val.trim(), source: alias };
    }
  }
  const lowerAliases = AC_ALIASES.map((a) => a.toLowerCase());
  for (const [key, val] of Object.entries(fields)) {
    if (lowerAliases.includes(key.toLowerCase())) {
      if (val && typeof val === "string" && val.trim().length > 0) {
        return { value: val.trim(), source: key };
      }
    }
  }
  for (const [key, val] of Object.entries(fields)) {
    if (!key.startsWith("customfield_")) continue;
    const nested = val;
    if (!nested) continue;
    const label = str(nested["name"] ?? nested["label"] ?? nested["displayName"]);
    if (label && lowerAliases.includes(label.toLowerCase())) {
      const content = str(nested["value"] ?? nested["content"] ?? nested["text"]);
      if (content.trim().length > 0) {
        return { value: content.trim(), source: label };
      }
    }
  }
  return { value: null, source: null };
}
function resolveIssueType(fields) {
  const raw = str(fields["issuetype"]?.["name"]).toLowerCase();
  if (raw.includes("story")) return "story";
  if (raw.includes("bug")) return "bug";
  if (raw.includes("task")) return "task";
  return raw || "task";
}
function resolveDescription(fields) {
  const desc = fields["description"];
  if (!desc) return "";
  if (typeof desc === "string") return desc;
  return extractAdfText(desc);
}
function extractAdfText(node) {
  if (node["type"] === "text") return str(node["text"]);
  const content = node["content"];
  if (Array.isArray(content)) {
    return content.map(extractAdfText).join(" ");
  }
  return "";
}
function resolveUser(val) {
  if (!val) return "";
  const u = val;
  return str(u["displayName"] ?? u["name"] ?? u["emailAddress"]);
}
function resolveLinkedArtifacts(fields) {
  const links = fields["issuelinks"];
  if (!Array.isArray(links)) return [];
  return links.flatMap((link) => {
    const results = [];
    if (link["inwardIssue"]) {
      const issue = link["inwardIssue"];
      results.push({
        key: str(issue["key"]),
        relationship: str(link["type"]?.["inward"]),
        url: str(issue["self"])
      });
    }
    if (link["outwardIssue"]) {
      const issue = link["outwardIssue"];
      results.push({
        key: str(issue["key"]),
        relationship: str(link["type"]?.["outward"]),
        url: str(issue["self"])
      });
    }
    return results;
  });
}
function resolveDependencies(fields) {
  const links = fields["issuelinks"];
  if (!Array.isArray(links)) return [];
  const deps = [];
  for (const link of links) {
    const relType = link["type"];
    const inward = str(relType?.["inward"]).toLowerCase();
    const outward = str(relType?.["outward"]).toLowerCase();
    if (link["inwardIssue"] && BLOCKER_RELATIONSHIPS.has(inward)) {
      const issue = link["inwardIssue"];
      deps.push({
        key: str(issue["key"]),
        relationship: inward,
        status: str(issue["fields"]?.["status"])
      });
    }
    if (link["outwardIssue"] && BLOCKER_RELATIONSHIPS.has(outward)) {
      const issue = link["outwardIssue"];
      deps.push({
        key: str(issue["key"]),
        relationship: outward,
        status: str(issue["fields"]?.["status"])
      });
    }
  }
  return deps;
}
function resolveComments(fields) {
  const commentBlock = fields["comment"];
  const comments = commentBlock?.["comments"];
  if (!Array.isArray(comments)) return [];
  return comments.map((c) => {
    const body = c["body"];
    if (typeof body === "string") return body;
    return extractAdfText(body);
  });
}
function resolveSprintId(fields) {
  for (const val of Object.values(fields)) {
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first?.["id"] === "number" && typeof first?.["name"] === "string" && first?.["state"]) {
        return String(first["id"]);
      }
    }
  }
  return null;
}
function str(val) {
  if (val === null || val === void 0) return "";
  return String(val);
}
function strArray(val) {
  if (!Array.isArray(val)) return [];
  return val.map((v) => str(v));
}

// src/utils/latency.ts
var LatencyTracker = class {
  samples = /* @__PURE__ */ new Map();
  /** Begin timing an operation. Returns an object with an `end()` method. */
  start(operation) {
    const t0 = Date.now();
    return {
      end: () => {
        const latencyMs = Date.now() - t0;
        this._record(operation, latencyMs);
        return latencyMs;
      }
    };
  }
  /**
   * Record a pre-computed latency value directly (task 5.1 — per-branch instrumentation).
   * Use this when you already have a duration (e.g. from Promise.allSettled timing).
   */
  record(operation, latencyMs) {
    this._record(operation, latencyMs);
  }
  _record(operation, latencyMs) {
    if (!this.samples.has(operation)) {
      this.samples.set(operation, []);
    }
    this.samples.get(operation).push(latencyMs);
    const p95 = this.p95(operation);
    logger.info("latency_sample", { operation, latencyMs, p95_ms: p95, n: this.samples.get(operation).length });
  }
  /** Compute the p95 latency (ms) for a given operation across all recorded samples. */
  p95(operation) {
    const data = this.samples.get(operation);
    if (!data || data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[Math.max(0, idx)];
  }
  /** All recorded sample counts by operation. */
  stats() {
    const result = {};
    for (const [op, data] of this.samples) {
      const sorted = [...data].sort((a, b) => a - b);
      const pct = (p) => {
        const idx = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, idx)];
      };
      result[op] = { count: sorted.length, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99) };
    }
    return result;
  }
  /** Reset samples (useful between test runs). */
  reset() {
    this.samples.clear();
  }
};
var latencyTracker = new LatencyTracker();

// src/utils/confidence-histogram.ts
var BUCKET_COUNT = 10;
function bucketLabel(i) {
  const lo = (i / BUCKET_COUNT).toFixed(1);
  const hi = ((i + 1) / BUCKET_COUNT).toFixed(1);
  return `${lo}-${hi}`;
}
var ConfidenceHistogram = class {
  buckets = new Array(BUCKET_COUNT + 1).fill(0);
  total = 0;
  /**
   * Record a confidence value (0.0–1.0).
   * Values outside this range are clamped.
   */
  record(confidence, operation = "repo-mapper") {
    const clamped = Math.max(0, Math.min(1, confidence));
    const idx = clamped >= 1 ? BUCKET_COUNT - 1 : Math.floor(clamped * BUCKET_COUNT);
    this.buckets[idx]++;
    this.total++;
    logger.info("confidence_sample", {
      operation,
      confidence: parseFloat(clamped.toFixed(3)),
      bucket: bucketLabel(idx),
      total_samples: this.total
    });
  }
  /**
   * Return the current histogram snapshot as a label→count map.
   */
  snapshot() {
    const result = {};
    for (let i = 0; i < BUCKET_COUNT; i++) {
      result[bucketLabel(i)] = this.buckets[i];
    }
    return result;
  }
  /** Total number of samples recorded. */
  get sampleCount() {
    return this.total;
  }
  /** Reset all buckets (useful between test runs). */
  reset() {
    this.buckets.fill(0);
    this.total = 0;
  }
};
var confidenceHistogram = new ConfidenceHistogram();

// src/repo/mapper.ts
var SEMANTIC_WEIGHT = 0.6;
var STRUCTURAL_WEIGHT = 0.4;
function tokenise(text) {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2)
  );
}
function jaccardSimilarity(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
function semanticScore(ticket, dossier) {
  const ticketTokens = tokenise(
    [ticket.summary, ticket.description, ticket.acceptance_criteria ?? ""].join(" ")
  );
  const componentTokens = tokenise(
    [
      dossier.name,
      ...dossier.frameworks,
      ...dossier.rootPaths,
      ...dossier.fixExamples.map((e) => e.title + " " + e.summary)
    ].join(" ")
  );
  return jaccardSimilarity(ticketTokens, componentTokens);
}
function structuralScore(ticket, dossier) {
  let score = 0;
  const text = [ticket.summary, ticket.description].join(" ").toLowerCase();
  if (text.includes(dossier.name.toLowerCase())) score += 0.4;
  for (const label of ticket.labels) {
    if (dossier.name.toLowerCase().includes(label.toLowerCase())) score += 0.1;
    if (dossier.frameworks.some((f) => f.toLowerCase() === label.toLowerCase())) score += 0.1;
  }
  const mentionedPaths = dossier.fixExamples.flatMap((e) => e.paths);
  if (mentionedPaths.length > 0) score += 0.1;
  if (dossier.owners.length > 0) score += 0.05;
  return Math.min(score, 1);
}
function deriveCandidateFiles(ticket, dossier) {
  const files = [];
  const sourceRoots = dossier.rootPaths.filter(
    (p) => !p.includes("test") && !p.includes("spec")
  );
  for (const path of sourceRoots.slice(0, 5)) {
    files.push({ path, reason: `Component root path for ${dossier.name}` });
  }
  for (const ex of dossier.fixExamples.slice(0, 3)) {
    for (const path of ex.paths.slice(0, 2)) {
      if (!files.some((f) => f.path === path)) {
        files.push({ path, reason: `Historical fix: ${ex.title}` });
      }
    }
  }
  return files;
}
function deriveCandidateTests(dossier) {
  if (dossier.testDirs.length === 0) {
    return { tests: [], testLocationUnknown: true };
  }
  const tests = dossier.testDirs.slice(0, 3).map((dir) => ({
    path: dir,
    reason: `Known test directory for ${dossier.name}`
  }));
  return { tests, testLocationUnknown: false };
}
function mapTicketToComponents(args) {
  const { ticket, index, options } = args;
  const topK = options?.topK ?? 5;
  const evidenceLog = [];
  if (!index) {
    logger.warn("repo_mapper_blocked", {
      ticket_key: ticket.ticket_key,
      reason: "repo_index_unavailable"
    });
    return {
      ticket_key: ticket.ticket_key,
      candidate_components: [],
      candidate_files: [],
      candidate_tests: [],
      low_confidence: true,
      test_location_unknown: true,
      enrichment_source: "unavailable",
      evidence: ["repo_index_unavailable"]
    };
  }
  const startMs = Date.now();
  const scored = index.components.map((dossier) => {
    const sem = semanticScore(ticket, dossier);
    const str2 = structuralScore(ticket, dossier);
    const combined = SEMANTIC_WEIGHT * sem + STRUCTURAL_WEIGHT * str2;
    return { dossier, sem, str: str2, combined };
  });
  scored.sort((a, b) => b.combined - a.combined);
  const top = scored.slice(0, topK);
  latencyTracker.record("repo-mapper", Date.now() - startMs);
  const candidateComponents = top.map(({ dossier, sem, str: str2, combined }) => {
    const why = `semantic=${sem.toFixed(2)} structural=${str2.toFixed(2)} combined=${combined.toFixed(2)}`;
    evidenceLog.push(`component:${dossier.name} ${why}`);
    return { name: dossier.name, confidence: parseFloat(combined.toFixed(3)), why };
  });
  const maxConfidence = candidateComponents[0]?.confidence ?? 0;
  const lowConfidence = maxConfidence <= 0.5;
  const bestDossier = top[0]?.dossier ?? null;
  let candidateFiles = [];
  let candidateTests = [];
  let testLocationUnknown = true;
  if (bestDossier) {
    candidateFiles = deriveCandidateFiles(ticket, bestDossier);
    const { tests, testLocationUnknown: tlu } = deriveCandidateTests(bestDossier);
    candidateTests = tests;
    testLocationUnknown = tlu;
  }
  if (lowConfidence) {
    evidenceLog.push(`low_confidence: max_confidence=${maxConfidence.toFixed(3)}`);
  }
  if (testLocationUnknown) {
    evidenceLog.push("test_location_unknown");
  }
  logger.info("repo_mapper_result", {
    ticket_key: ticket.ticket_key,
    top_component: candidateComponents[0]?.name ?? "none",
    max_confidence: maxConfidence,
    low_confidence: lowConfidence
  });
  if (confidenceHistogram) confidenceHistogram.record(maxConfidence);
  return {
    ticket_key: ticket.ticket_key,
    candidate_components: candidateComponents,
    candidate_files: candidateFiles,
    candidate_tests: candidateTests,
    low_confidence: lowConfidence,
    test_location_unknown: testLocationUnknown,
    enrichment_source: "structural_only",
    evidence: evidenceLog
  };
}

// src/readiness/profile.ts
var DEFAULT_STORY_PROFILE = {
  id: "default:story",
  name: "Default Story Profile",
  issueType: "story",
  projectKey: null,
  dimensions: [
    {
      id: "business_intent",
      label: "Business Intent",
      weight: 0.15,
      severity: "high",
      fields: ["description"],
      clarificationPersona: "pm",
      clarificationTemplate: "What is the business outcome this story is intended to achieve for {ticket_key}? Please add a brief goal statement to the description."
    },
    {
      id: "acceptance_criteria",
      label: "Acceptance Criteria",
      weight: 0.3,
      severity: "high",
      fields: ["acceptance_criteria"],
      clarificationPersona: "pm",
      clarificationTemplate: "What are the measurable acceptance criteria for {ticket_key}? Please provide at least one verifiable success condition."
    },
    {
      id: "scope_boundaries",
      label: "Scope Boundaries",
      weight: 0.15,
      severity: "medium",
      fields: ["description"],
      clarificationPersona: "pm",
      clarificationTemplate: "What is explicitly out of scope for {ticket_key}? Adding a brief 'Not in scope' section will prevent scope creep."
    },
    {
      id: "dependencies_declared",
      label: "Dependencies Declared",
      weight: 0.2,
      severity: "high",
      fields: ["dependencies"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Are there any service or ticket dependencies for {ticket_key}? Please declare them as 'is blocked by' links so they appear in the dependency graph."
    },
    {
      id: "rollout_constraints",
      label: "Rollout Constraints",
      weight: 0.1,
      severity: "low",
      fields: ["description", "labels"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Does {ticket_key} have any rollout constraints (feature flags, dark launches, migration steps)? If so, please document them in the description."
    },
    {
      id: "test_hints",
      label: "Test Hints",
      weight: 0.1,
      severity: "medium",
      fields: ["acceptance_criteria", "description"],
      clarificationPersona: "qa",
      clarificationTemplate: "What test scenarios should QA validate for {ticket_key}? Adding test hints to the acceptance criteria will speed up test planning."
    }
  ]
};
var DEFAULT_BUG_PROFILE = {
  id: "default:bug",
  name: "Default Bug Profile",
  issueType: "bug",
  projectKey: null,
  dimensions: [
    {
      id: "actual_behaviour",
      label: "Actual Behaviour",
      weight: 0.15,
      severity: "high",
      fields: ["description"],
      clarificationPersona: "pm",
      clarificationTemplate: "What is the actual (broken) behaviour observed in {ticket_key}? Please describe it clearly in the description."
    },
    {
      id: "expected_behaviour",
      label: "Expected Behaviour",
      weight: 0.15,
      severity: "high",
      fields: ["description", "acceptance_criteria"],
      clarificationPersona: "pm",
      clarificationTemplate: "What is the expected (correct) behaviour for {ticket_key}? Please add the expected outcome to the description or acceptance criteria."
    },
    {
      id: "repro_steps",
      label: "Reproducible Steps",
      weight: 0.25,
      severity: "high",
      fields: ["description"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Can you provide step-by-step reproduction instructions for {ticket_key}? This is the single most important field for diagnosing the bug."
    },
    {
      id: "environment",
      label: "Environment",
      weight: 0.15,
      severity: "medium",
      fields: ["description", "labels"],
      clarificationPersona: "engineer",
      clarificationTemplate: "In which environment was {ticket_key} observed (production / staging / local)? What version or deployment was running?"
    },
    {
      id: "evidence",
      label: "Evidence (logs / screenshots)",
      weight: 0.15,
      severity: "medium",
      fields: ["linked_artifacts", "description"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Are there any logs, screenshots, or traces attached to {ticket_key}? Please attach or link them \u2014 they dramatically reduce investigation time."
    },
    {
      id: "affected_services",
      label: "Affected Services",
      weight: 0.1,
      severity: "medium",
      fields: ["labels", "description"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Which services or components are affected by {ticket_key}? Please add relevant service labels."
    },
    {
      id: "exit_criteria",
      label: "Exit Criteria",
      weight: 0.05,
      severity: "low",
      fields: ["acceptance_criteria"],
      clarificationPersona: "qa",
      clarificationTemplate: "How will we verify that {ticket_key} is fixed? Please add an acceptance criterion describing the passing state."
    }
  ]
};
var DEFAULT_TASK_PROFILE = {
  id: "default:task",
  name: "Default Task Profile",
  issueType: "task",
  projectKey: null,
  dimensions: [
    {
      id: "summary_clarity",
      label: "Summary Clarity",
      weight: 0.3,
      severity: "high",
      fields: ["summary"],
      clarificationPersona: "pm",
      clarificationTemplate: "The summary for {ticket_key} is too vague. Can you rewrite it as '<verb> <object> so that <outcome>'?"
    },
    {
      id: "acceptance_criteria",
      label: "Done Definition",
      weight: 0.35,
      severity: "high",
      fields: ["acceptance_criteria"],
      clarificationPersona: "pm",
      clarificationTemplate: "How will we know {ticket_key} is complete? Please add a brief definition of done."
    },
    {
      id: "dependencies_declared",
      label: "Dependencies Declared",
      weight: 0.2,
      severity: "medium",
      fields: ["dependencies"],
      clarificationPersona: "engineer",
      clarificationTemplate: "Does {ticket_key} depend on any other tickets or services? If so, please add 'is blocked by' links."
    },
    {
      id: "assignee_set",
      label: "Assignee Set",
      weight: 0.15,
      severity: "low",
      fields: ["assignee"],
      clarificationPersona: "pm",
      clarificationTemplate: "Who is responsible for delivering {ticket_key}? Please set an assignee."
    }
  ]
};
var BUILT_IN_PROFILES = [
  DEFAULT_STORY_PROFILE,
  DEFAULT_BUG_PROFILE,
  DEFAULT_TASK_PROFILE
];
var ProfileRegistry = class {
  profiles = /* @__PURE__ */ new Map();
  constructor(extraProfiles = []) {
    for (const p of BUILT_IN_PROFILES) {
      this.profiles.set(p.id, p);
    }
    for (const p of extraProfiles) {
      this.profiles.set(p.id, p);
    }
  }
  /**
   * Resolve the best-matching profile for a given project key + issue type.
   * Returns { profile, source } where source is "project" | "default".
   */
  resolve(projectKey, issueType) {
    const normalised = issueType.toLowerCase();
    const projectId = `${projectKey}:${normalised}`;
    if (this.profiles.has(projectId)) {
      return { profile: this.profiles.get(projectId), source: "project" };
    }
    const defaultId = `default:${normalised}`;
    if (this.profiles.has(defaultId)) {
      return { profile: this.profiles.get(defaultId), source: "default" };
    }
    return { profile: DEFAULT_TASK_PROFILE, source: "default" };
  }
  /** Register a project-specific profile override */
  register(profile) {
    this.profiles.set(profile.id, profile);
  }
};

// src/readiness/scorer.ts
var OPEN_STATUSES = /* @__PURE__ */ new Set(["open", "to do", "todo"]);
function isDimensionMissing(rule, ticket) {
  return rule.fields.every((field) => {
    const val = ticket[field];
    if (val === null || val === void 0) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
}
function scoreTicket(input) {
  const { ticket, profile, profileSource, options = {} } = input;
  const threshold = options.readyThreshold ?? 80;
  const blockers = ticket.dependencies.filter((dep) => {
    if (!dep.status) return false;
    return OPEN_STATUSES.has(dep.status.toLowerCase());
  });
  const missingItems = [];
  let weightedScore = 0;
  let totalWeight = 0;
  let populatedFieldCount = 0;
  let totalFieldCount = 0;
  for (const rule of profile.dimensions) {
    totalWeight += rule.weight;
    totalFieldCount += rule.fields.length;
    if (isDimensionMissing(rule, ticket)) {
      missingItems.push({
        dimension: rule.id,
        severity: rule.severity,
        reason: `"${rule.label}" is missing or empty.`
      });
    } else {
      weightedScore += rule.weight;
      populatedFieldCount += rule.fields.length;
    }
  }
  const normalisedScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight * 100) : 0;
  const fieldRatio = totalFieldCount > 0 ? populatedFieldCount / totalFieldCount : 0;
  const blockerPenalty = blockers.length > 0 ? 0.2 : 0;
  const confidence = Math.max(0, Math.round((fieldRatio - blockerPenalty) * 100) / 100);
  let verdict;
  if (blockers.length > 0) {
    verdict = "blocked";
  } else if (normalisedScore >= threshold && missingItems.length === 0) {
    verdict = "ready";
  } else if (missingItems.some((m) => m.severity === "high")) {
    verdict = "needs_clarification";
  } else if (normalisedScore < threshold) {
    verdict = "needs_clarification";
  } else {
    verdict = "ready";
  }
  let explanation;
  if (verdict === "blocked") {
    const keys = blockers.map((b) => b.key).join(", ");
    explanation = `Ticket ${ticket.ticket_key} is blocked by unresolved dependencies: ${keys}. Resolve these before grooming.`;
  } else if (verdict === "ready") {
    explanation = `Ticket ${ticket.ticket_key} meets all readiness dimensions (score ${normalisedScore}/100).`;
  } else {
    const highItems = missingItems.filter((m) => m.severity === "high").map((m) => m.dimension).join(", ");
    explanation = `Ticket ${ticket.ticket_key} scored ${normalisedScore}/100 and needs clarification.` + (highItems ? ` Critical missing: ${highItems}.` : "");
  }
  if (profileSource === "default") {
    logger.info("readiness_score", {
      ticket_key: ticket.ticket_key,
      profile_source: "default",
      profile_id: profile.id,
      verdict,
      score: normalisedScore
    });
  }
  return {
    ticket_key: ticket.ticket_key,
    ticket_type: ticket.ticket_type,
    readiness_status: verdict,
    readiness_score: normalisedScore,
    missing_items: missingItems,
    questions_for_pm: [],
    // populated by clarification generator
    questions_for_engineer: [],
    questions_for_qa: [],
    manual_checks: [],
    confidence,
    explanation,
    evidence: []
    // populated by evidence store
  };
}

// src/readiness/clarification.ts
function generateQuestions(result, profile) {
  const pm = [];
  const engineer = [];
  const qa = [];
  const dimMap = new Map(profile.dimensions.map((d) => [d.id, d]));
  for (const item of result.missing_items) {
    const rule = dimMap.get(item.dimension);
    if (!rule) continue;
    const question = rule.clarificationTemplate.replaceAll(
      "{ticket_key}",
      result.ticket_key
    );
    switch (rule.clarificationPersona) {
      case "pm":
        pm.push(question);
        break;
      case "engineer":
        engineer.push(question);
        break;
      case "qa":
        qa.push(question);
        break;
    }
  }
  result.questions_for_pm = pm;
  result.questions_for_engineer = engineer;
  result.questions_for_qa = qa;
  return { questions_for_pm: pm, questions_for_engineer: engineer, questions_for_qa: qa };
}
function applyQuestions(result, profile) {
  if (result.readiness_status === "needs_clarification" || result.readiness_status === "blocked") {
    generateQuestions(result, profile);
  }
  return result;
}

// src/llm/prompts.ts
function enrichReadinessPrompt(ctx) {
  return `You are an expert product manager reviewing a Jira ticket for development readiness.

Ticket: ${ctx.ticketKey}
Summary: ${ctx.ticketSummary}
Description: ${ctx.description}
Acceptance Criteria: ${ctx.acceptanceCriteria ?? "(none provided)"}

<context>
${ctx.contextBlock}
</context>

Deterministic readiness analysis:
${ctx.deterministicResult ?? "{}"}

Your task: Review the ticket and deterministic analysis above. Identify ANY additional missing items or clarification questions that the deterministic analysis may have missed, referencing specific context above.

Rules:
- You MUST NOT change the readiness_status if it is "blocked"
- You MUST NOT reduce readiness_score
- Only add items you are confident about based on the provided context
- Each clarification question must include a justification citing specific context

Respond with JSON matching this exact schema:
{
  "additional_missing_items": [
    { "dimension": string, "severity": "high"|"medium"|"low", "reason": string, "source": "llm" }
  ],
  "additional_questions_for_pm": [
    { "question": string, "justification": string }
  ],
  "additional_questions_for_engineer": [
    { "question": string, "justification": string }
  ],
  "additional_questions_for_qa": [
    { "question": string, "justification": string }
  ]
}`;
}
function groundPlanPrompt(ctx) {
  const fileSection = ctx.fileContents ? Object.entries(ctx.fileContents).map(([path, content]) => `### ${path}
\`\`\`
${content}
\`\`\``).join("\n\n") : "(no file contents available)";
  return `You are an expert software engineer providing grounding for a development plan.

Ticket: ${ctx.ticketKey}
Summary: ${ctx.ticketSummary}

Candidate components and files:
${ctx.candidateComponents ?? "{}"}

<context>
${ctx.contextBlock}
</context>

Relevant source files:
${fileSection}

Your task: For each candidate component and file, write a concise "why" justification (1\u20132 sentences) explaining why it is relevant to this ticket. Reference specific code patterns, function names, or context from the files above.

Respond with JSON matching this exact schema:
{
  "component_justifications": [
    { "name": string, "why": string }
  ],
  "file_justifications": [
    { "path": string, "reason": string }
  ]
}`;
}

// src/planning/solution-planner.ts
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}
function buildBranchName(ticketKey, summary) {
  const slug = slugify(summary);
  return `${ticketKey.toLowerCase()}-${slug}`;
}
function buildOpenspecSlug(ticketKey, summary) {
  return buildBranchName(ticketKey, summary);
}
var CONFLICT_CONFIDENCE_THRESHOLD = 0.3;
function detectConflict(readiness, repoMap) {
  if (readiness.readiness_status !== "ready") return null;
  if (!repoMap) return null;
  const topConfidence = repoMap.candidate_components[0]?.confidence ?? 0;
  if (topConfidence < CONFLICT_CONFIDENCE_THRESHOLD) {
    return {
      reason: `Readiness verdict is 'ready' but repo-mapping confidence is ${topConfidence.toFixed(2)} (threshold: ${CONFLICT_CONFIDENCE_THRESHOLD}). Component grounding is insufficient.`,
      readiness_status: readiness.readiness_status,
      repo_map_confidence: topConfidence
    };
  }
  return null;
}
async function planActionPackage(input) {
  const { readiness, repoMap, summary, llmAdapter, contextBlock, fileContents } = input;
  const ticketKey = readiness.ticket_key;
  const branchName = buildBranchName(ticketKey, summary);
  const openspecSlug = buildOpenspecSlug(ticketKey, summary);
  const conflict = detectConflict(readiness, repoMap);
  const repoMapConfidence = repoMap?.candidate_components[0]?.confidence ?? 0;
  const evidence = [
    ...readiness.evidence,
    ...repoMap?.evidence ?? ["repo_map_unavailable"]
  ];
  let candidateComponents = repoMap?.candidate_components ?? [];
  let candidateFiles = repoMap?.candidate_files ?? [];
  const llmTraces = [];
  if (llmAdapter && repoMap) {
    try {
      const prompt = groundPlanPrompt({
        ticketKey,
        ticketSummary: summary,
        acceptanceCriteria: readiness.missing_items.length > 0 ? null : "(all met)",
        description: summary,
        contextBlock: contextBlock ?? "",
        candidateComponents: JSON.stringify(repoMap.candidate_components),
        fileContents
      });
      const schema = {
        type: "object",
        properties: {
          component_justifications: { type: "array" },
          file_justifications: { type: "array" }
        }
      };
      const { result, trace } = await Promise.race([
        llmAdapter.complete(prompt, schema),
        new Promise((_, reject) => setTimeout(() => reject(new Error("groundPlan timeout")), 1e4))
      ]);
      llmTraces.push(trace);
      const compJust = new Map(result.component_justifications.map((j) => [j.name, j.why]));
      const fileJust = new Map(result.file_justifications.map((j) => [j.path, j.reason]));
      candidateComponents = candidateComponents.map((c) => ({
        ...c,
        why: compJust.get(c.name) ?? c.why
      }));
      candidateFiles = candidateFiles.map((f) => ({
        ...f,
        reason: fileJust.get(f.path) ?? f.reason
      }));
      evidence.push("ground_plan_llm");
    } catch (err) {
      logger.warn("ground_plan_llm_failed", { ticket_key: ticketKey, error: String(err) });
      evidence.push("ground_plan_heuristic_fallback");
    }
  }
  const pkg = {
    ticket_key: ticketKey,
    readiness_status: readiness.readiness_status,
    readiness_score: readiness.readiness_score,
    candidate_components: candidateComponents,
    candidate_files: candidateFiles,
    candidate_tests: repoMap?.candidate_tests ?? [],
    branch_name_suggestion: branchName,
    openspec_change_slug: openspecSlug,
    operational_risks: readiness.missing_items.filter((m) => m.severity === "high").map((m) => m.reason),
    manual_checks: readiness.manual_checks,
    repo_map_confidence: repoMapConfidence,
    low_confidence: repoMap?.low_confidence ?? true,
    conflict,
    evidence
  };
  logger.info("solution_planner_merge", {
    ticket_key: ticketKey,
    readiness_status: readiness.readiness_status,
    repo_map_confidence: repoMapConfidence,
    conflict: !!conflict,
    branch_name_suggestion: branchName,
    llm_grounded: llmTraces.length > 0
  });
  return pkg;
}

// src/planning/reviewer.ts
var SLUG_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
function checkRequiredFields(pkg) {
  const errors = [];
  if (!pkg.ticket_key) errors.push("missing field: ticket_key");
  if (!pkg.readiness_status) errors.push("missing field: readiness_status");
  if (!pkg.branch_name_suggestion) errors.push("missing field: branch_name_suggestion");
  if (!pkg.openspec_change_slug) errors.push("missing field: openspec_change_slug");
  return errors;
}
function checkPermissions(pkg, allowedComponents) {
  if (!allowedComponents) return [];
  const violations = pkg.candidate_components.filter((c) => !allowedComponents.has(c.name)).map((c) => `component '${c.name}' is not in caller's permission scope`);
  return violations;
}
function checkScoreThreshold(pkg, minScore) {
  if (pkg.readiness_score < minScore && !pkg.conflict) {
    return [
      `readiness_score ${pkg.readiness_score} is below minimum ${minScore} and no conflict explanation is provided`
    ];
  }
  return [];
}
function checkBranchKey(pkg) {
  const key = pkg.ticket_key.toLowerCase();
  if (!pkg.branch_name_suggestion.includes(key)) {
    return [
      `branch_name_suggestion '${pkg.branch_name_suggestion}' does not contain work-item key '${key}'`
    ];
  }
  return [];
}
function checkSlug(pkg) {
  const slug = pkg.openspec_change_slug;
  if (!slug || !SLUG_RE.test(slug)) {
    return [`openspec_change_slug '${slug}' is not a valid URL-safe slug`];
  }
  return [];
}
function reviewActionPackage(pkg, config2 = {}) {
  const minScore = config2.minReadinessScore ?? 50;
  const reasons = [
    ...checkRequiredFields(pkg),
    ...checkPermissions(pkg, config2.allowedComponents),
    ...checkScoreThreshold(pkg, minScore),
    ...checkBranchKey(pkg),
    ...checkSlug(pkg)
  ];
  const approved = reasons.length === 0;
  logger.info("reviewer_verdict", {
    ticket_key: pkg.ticket_key,
    approved,
    rejection_count: reasons.length
  });
  return { approved, reasons };
}

// src/planning/openspec-emitter.ts
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
function renderProposal(pkg) {
  return `# OpenSpec Change Proposal: ${pkg.openspec_change_slug}

## Intent
Auto-generated planning output for Jira ticket \`${pkg.ticket_key}\`.

## Readiness
- Status: \`${pkg.readiness_status}\`
- Score: ${pkg.readiness_score}/100

## Repo Grounding
- Top component: ${pkg.candidate_components[0]?.name ?? "none"}
- Confidence: ${pkg.repo_map_confidence.toFixed(2)}
- Low confidence: ${pkg.low_confidence}
${pkg.conflict ? `
## \u26A0\uFE0F Conflict
${pkg.conflict.reason}
` : ""}
## Branch
\`${pkg.branch_name_suggestion}\`

## Operational Risks
${pkg.operational_risks.length > 0 ? pkg.operational_risks.map((r) => `- ${r}`).join("\n") : "None identified."}

## Manual Checks
${pkg.manual_checks.length > 0 ? pkg.manual_checks.map((c) => `- [ ] ${c}`).join("\n") : "None."}
`;
}
function renderDesign(pkg) {
  const components = pkg.candidate_components.map((c) => `- **${c.name}** (confidence: ${c.confidence.toFixed(2)}): ${c.why}`).join("\n");
  const files = pkg.candidate_files.map((f) => `- \`${f.path}\` \u2014 ${f.reason}`).join("\n");
  const tests = pkg.candidate_tests.map((t) => `- \`${t.path}\` \u2014 ${t.reason}`).join("\n");
  return `# Design Notes: ${pkg.openspec_change_slug}

## Candidate Components
${components || "None identified."}

## Candidate Files
${files || "None identified."}

## Candidate Tests
${tests || "None identified."}

## Evidence
${pkg.evidence.map((e) => `- ${e}`).join("\n")}
`;
}
function renderTasks(pkg) {
  return `# Implementation Tasks: ${pkg.openspec_change_slug}

Auto-generated for \`${pkg.ticket_key}\` on ${(/* @__PURE__ */ new Date()).toISOString()}.

## Tasks

- [ ] 1. Review candidate components: ${pkg.candidate_components.map((c) => c.name).join(", ") || "TBD"}
- [ ] 2. Validate branch name: \`${pkg.branch_name_suggestion}\`
- [ ] 3. Confirm affected files and add/update tests
- [ ] 4. Address all manual checks listed in proposal.md
- [ ] 5. Human review before merge
`;
}
function renderOutputContractSpec(pkg) {
  return `## ADDED Requirements \u2014 ${pkg.openspec_change_slug}

### Requirement: Action package for ${pkg.ticket_key}
The action package for \`${pkg.ticket_key}\` SHALL include candidate components,
candidate files, candidate tests, branch name suggestion, and OpenSpec slug as
defined by the stage-2 output contract.
`;
}
function emitOpenSpecArtifact(pkg, verdict, config2 = {}) {
  const shadowMode = config2.shadowMode ?? process.env["SHADOW_MODE"] === "true";
  const repoRoot = config2.repoRoot ?? process.cwd();
  const slug = pkg.openspec_change_slug;
  if (!verdict.approved) {
    logger.warn("openspec_emit_blocked", {
      ticket_key: pkg.ticket_key,
      reasons: verdict.reasons
    });
    return {
      confirmed: false,
      writtenPaths: [],
      shadowMode,
      confirm_post_url: ""
    };
  }
  const confirmUrl = shadowMode ? `shadow://no-op/openspec/${slug}` : `file://${repoRoot}/openspec/changes/${slug}`;
  if (shadowMode) {
    logger.info("openspec_emit_shadow", { ticket_key: pkg.ticket_key, slug });
    return {
      confirmed: true,
      writtenPaths: [],
      shadowMode: true,
      confirm_post_url: confirmUrl
    };
  }
  const changeDir = join(repoRoot, "openspec", "changes", slug);
  const specsDir = join(changeDir, "specs", "output-contracts");
  mkdirSync(specsDir, { recursive: true });
  const files = [
    { path: join(changeDir, "proposal.md"), content: renderProposal(pkg) },
    { path: join(changeDir, "design.md"), content: renderDesign(pkg) },
    { path: join(changeDir, "tasks.md"), content: renderTasks(pkg) },
    { path: join(specsDir, "spec.md"), content: renderOutputContractSpec(pkg) }
  ];
  const writtenPaths = [];
  for (const { path, content } of files) {
    writeFileSync(path, content, "utf-8");
    writtenPaths.push(path);
    logger.info("openspec_file_written", { path });
  }
  logger.info("openspec_emit_complete", {
    ticket_key: pkg.ticket_key,
    slug,
    files_written: writtenPaths.length
  });
  return {
    confirmed: true,
    writtenPaths,
    shadowMode: false,
    confirm_post_url: confirmUrl
  };
}

// src/evidence/store.ts
import { randomUUID } from "crypto";
var RETENTION_MS = 90 * 24 * 60 * 60 * 1e3;
var EvidenceStore = class {
  store = /* @__PURE__ */ new Map();
  /** Persist a new evidence bundle; returns the assigned run_id. */
  persist(bundle) {
    const run_id = randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const full = {
      ...bundle,
      run_id,
      timestamp,
      _storedAt: Date.now()
    };
    this.store.set(run_id, full);
    return full;
  }
  /** Retrieve a bundle by run_id. Returns undefined if not found or expired. */
  get(run_id) {
    const entry = this.store.get(run_id);
    if (!entry) return void 0;
    if (Date.now() - entry._storedAt > RETENTION_MS) {
      this.store.delete(run_id);
      return void 0;
    }
    const { _storedAt, ...bundle } = entry;
    return bundle;
  }
  /**
   * Lightweight save() for stage-2 usage — accepts a minimal payload object,
   * assigns a UUID run_id, and returns it.
   * For callers that don't have a full EvidenceBundle shape (e.g. stage-2 orchestrator).
   */
  save(payload) {
    const run_id = randomUUID();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const entry = { ...payload, run_id, timestamp, _storedAt: Date.now() };
    this.store.set(run_id, entry);
    return run_id;
  }
  /** Number of live (non-expired) bundles in store. */
  get size() {
    this._evict();
    return this.store.size;
  }
  /** Remove all expired entries. */
  _evict() {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (now - entry._storedAt > RETENTION_MS) {
        this.store.delete(id);
      }
    }
  }
};
var evidenceStore = new EvidenceStore();

// src/llm/mock-adapter.ts
var ZERO_TRACE = {
  prompt_tokens: 10,
  completion_tokens: 20,
  latency_ms: 1,
  degraded: true,
  reason: "mock adapter \u2014 DEGRADED_LLM=true or no API key"
};
var MockLLMAdapter = class {
  completionFixtures = /* @__PURE__ */ new Map();
  embedDim;
  constructor(opts = {}) {
    this.embedDim = opts.embedDim ?? 8;
  }
  /** Register a fixture response for a given prompt substring match key. */
  setFixture(key, value) {
    this.completionFixtures.set(key, value);
  }
  async complete(prompt, _schema) {
    for (const [key, value] of this.completionFixtures) {
      if (prompt.includes(key)) {
        return {
          result: value,
          trace: { model: "mock", ...ZERO_TRACE }
        };
      }
    }
    return {
      result: {},
      trace: { model: "mock", ...ZERO_TRACE }
    };
  }
  async embed(texts) {
    const vectors = texts.map(
      (t) => Array.from({ length: this.embedDim }, (_, i) => (t.charCodeAt(i % t.length) ?? 0) % 256 / 255)
    );
    return {
      vectors,
      trace: { model: "mock-embed", ...ZERO_TRACE }
    };
  }
};

// src/llm/openai-compat.ts
import OpenAI from "openai";

// src/llm/types.ts
var LLMDegradedError = class extends Error {
  constructor(reason) {
    super(`LLM unavailable: ${reason}`);
    this.name = "LLMDegradedError";
  }
};

// src/llm/openai-compat.ts
var OpenAICompatAdapter = class {
  client;
  model;
  embeddingModel;
  constructor(opts) {
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: opts.baseUrl ?? "https://api.openai.com/v1"
    });
    this.model = opts.model ?? "gpt-4o-mini";
    this.embeddingModel = opts.embeddingModel ?? "text-embedding-3-small";
  }
  async complete(prompt, _schema) {
    const start = Date.now();
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });
      const latency_ms = Date.now() - start;
      const text = response.choices[0]?.message?.content ?? "{}";
      const result = JSON.parse(text);
      const trace = {
        model: this.model,
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        latency_ms,
        degraded: false
      };
      logger.info("llm_call", { model: this.model, latency_ms, degraded: false });
      return { result, trace };
    } catch (err) {
      const latency_ms = Date.now() - start;
      const trace = {
        model: this.model,
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms,
        degraded: true,
        reason: String(err)
      };
      logger.warn("llm_call_failed", { model: this.model, latency_ms, error: String(err) });
      throw Object.assign(new LLMDegradedError(String(err)), { trace });
    }
  }
  async embed(texts) {
    const start = Date.now();
    try {
      const response = await this.client.embeddings.create({
        model: this.embeddingModel,
        input: texts
      });
      const latency_ms = Date.now() - start;
      const vectors = response.data.map((d) => d.embedding);
      const trace = {
        model: this.embeddingModel,
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: 0,
        latency_ms,
        degraded: false
      };
      logger.info("llm_embed", { model: this.embeddingModel, count: texts.length, latency_ms });
      return { vectors, trace };
    } catch (err) {
      const latency_ms = Date.now() - start;
      const trace = {
        model: this.embeddingModel,
        prompt_tokens: 0,
        completion_tokens: 0,
        latency_ms,
        degraded: true,
        reason: String(err)
      };
      throw Object.assign(new LLMDegradedError(String(err)), { trace });
    }
  }
};

// src/llm/index.ts
function createLLMAdapter(config2) {
  if (config2.degraded || !config2.apiKey) {
    return new MockLLMAdapter();
  }
  return new OpenAICompatAdapter({
    apiKey: config2.apiKey,
    baseUrl: config2.baseUrl,
    model: config2.model,
    embeddingModel: config2.embeddingModel
  });
}

// src/rag/retrieval.ts
var RETRIEVAL_TIMEOUT_MS = 2e3;
async function retrieveChunks(query, projectKey, store, adapter, topK = 5) {
  const start = Date.now();
  try {
    const result = await Promise.race([
      _retrieve(query, projectKey, store, adapter, topK),
      _timeout(RETRIEVAL_TIMEOUT_MS)
    ]);
    const latency_ms = Date.now() - start;
    logger.info("rag_retrieval", { chunk_count: result.length, latency_ms, timeout: false, project_key: projectKey });
    return result;
  } catch (err) {
    const latency_ms = Date.now() - start;
    const timedOut = err instanceof RetrievalTimeoutError;
    logger.warn("rag_retrieval_failed", { error: String(err), latency_ms, timeout: timedOut, project_key: projectKey });
    return [];
  }
}
async function _retrieve(query, projectKey, store, adapter, topK) {
  const { vectors } = await adapter.embed([query]);
  return store.search(vectors[0], projectKey, topK);
}
var RetrievalTimeoutError = class extends Error {
  constructor() {
    super("RAG retrieval timed out");
  }
};
function _timeout(ms) {
  return new Promise(
    (_, reject) => setTimeout(() => reject(new RetrievalTimeoutError()), ms)
  );
}

// src/knowledge/chunker.ts
var CHUNK_TOKENS = 512;
var OVERLAP_TOKENS = 64;
var CHARS_PER_TOKEN = 4;
var CHUNK_CHARS = CHUNK_TOKENS * CHARS_PER_TOKEN;
var OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;
function chunkText(text) {
  const normalised = text.replace(/\r\n/g, "\n").trim();
  if (!normalised) return [];
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < normalised.length) {
    const end = Math.min(start + CHUNK_CHARS, normalised.length);
    const slice = normalised.slice(start, end).trim();
    if (slice.length > 0) {
      chunks.push({ text: slice, chunk_index: index++ });
    }
    if (end >= normalised.length) break;
    start = end - OVERLAP_CHARS;
  }
  return chunks;
}
function truncateToTokens(text, maxTokens) {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

// src/rag/file-fetcher.ts
var FILE_SIZE_LIMIT_BYTES = 100 * 1024;
var MAX_TOKENS_PER_FILE = 8e3;
async function fetchTopFiles(candidates, adapter, topN = 3) {
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence).slice(0, topN);
  const results = [];
  await Promise.all(
    sorted.map(async (c) => {
      try {
        const { content, trace } = await adapter.getFileContent(c.owner, c.repo, c.path, c.ref);
        if (Buffer.byteLength(content, "utf-8") > FILE_SIZE_LIMIT_BYTES) {
          return;
        }
        results.push({
          path: c.path,
          content: truncateToTokens(content, MAX_TOKENS_PER_FILE),
          trace
        });
      } catch {
      }
    })
  );
  return results;
}

// src/rag/context-builder.ts
var BUDGET_TOKENS = 12e3;
var CHARS_PER_TOKEN2 = 4;
var BUDGET_CHARS = BUDGET_TOKENS * CHARS_PER_TOKEN2;
function buildContext(ktChunks, fetchedFiles) {
  const sortedChunks = [...ktChunks].sort((a, b) => b.score - a.score);
  const fileParts = [];
  let usedChars = 0;
  for (const file of fetchedFiles) {
    const header = `### File: ${file.path}
`;
    const available = BUDGET_CHARS - usedChars - header.length;
    if (available <= 0) break;
    const truncated = truncateToTokens(file.content, Math.floor(available / CHARS_PER_TOKEN2));
    fileParts.push(`${header}${truncated}`);
    usedChars += header.length + truncated.length;
  }
  const ktParts = [];
  for (const chunk of sortedChunks) {
    const sourceLabel = chunk.url ? `URL: ${chunk.url}` : chunk.file_path ? `File: ${chunk.file_path}` : `Source: ${chunk.source_id}`;
    const entry = `[${sourceLabel} | score: ${chunk.score.toFixed(2)}]
${chunk.text}`;
    if (usedChars + entry.length > BUDGET_CHARS) break;
    ktParts.push(entry);
    usedChars += entry.length;
  }
  const parts = [];
  if (ktParts.length > 0) {
    parts.push("## Knowledge Base Context\n\n" + ktParts.join("\n\n---\n\n"));
  }
  if (fileParts.length > 0) {
    parts.push("## Relevant Source Files\n\n" + fileParts.join("\n\n"));
  }
  const contextBlock = parts.join("\n\n");
  return {
    contextBlock,
    tokensUsed: Math.ceil(usedChars / CHARS_PER_TOKEN2)
  };
}

// src/repo/stage2-orchestrator.ts
var registry = new ProfileRegistry([
  DEFAULT_STORY_PROFILE,
  DEFAULT_BUG_PROFILE,
  DEFAULT_TASK_PROFILE
]);
async function runStage2Pipeline(input) {
  const { ticket, componentIndex, reviewerConfig, emitterConfig, kbStore, fileContentAdapter } = input;
  const ticketKey = ticket.ticket_key;
  const overallStart = Date.now();
  const llmAdapter = createLLMAdapter({
    apiKey: process.env["LLM_API_KEY"],
    baseUrl: process.env["LLM_BASE_URL"] ?? "https://api.openai.com/v1",
    model: process.env["LLM_MODEL"] ?? "gpt-4o-mini",
    embeddingModel: process.env["EMBEDDING_MODEL"] ?? "text-embedding-3-small",
    callsPerMinute: Number(process.env["LLM_CALLS_PER_MINUTE"] ?? 60),
    degraded: process.env["DEGRADED_LLM"] === "true"
  });
  const allLLMTraces = [];
  let retrievedChunks = [];
  if (kbStore) {
    const projectKey = ticketKey.split("-")[0] ?? ticketKey;
    const query = `${ticket.summary} ${ticket.description ?? ""}`.trim();
    retrievedChunks = await retrieveChunks(query, projectKey, kbStore, llmAdapter);
  }
  const readinessStart = Date.now();
  const repoStart = Date.now();
  const [readinessSettled, repoSettled] = await Promise.allSettled([
    // Readiness branch (synchronous internally, wrapped for uniform handling)
    Promise.resolve().then(() => {
      const { profile, source } = registry.resolve(ticket.ticket_key.split("-")[0], ticket.ticket_type);
      const scored = scoreTicket({ ticket, profile, profileSource: source });
      return applyQuestions(scored, profile);
    }),
    // Repo-mapping branch
    Promise.resolve().then(() => {
      return mapTicketToComponents({ ticket, index: componentIndex });
    })
  ]);
  latencyTracker.record("readiness-branch", Date.now() - readinessStart);
  latencyTracker.record("repo-mapping-branch", Date.now() - repoStart);
  let readinessResult = null;
  let repoMapFailureReason;
  if (readinessSettled.status === "fulfilled") {
    readinessResult = readinessSettled.value;
  } else {
    logger.error("readiness_branch_failed", { ticket_key: ticketKey, error: String(readinessSettled.reason) });
    const bundleId2 = evidenceStore.save({
      ticket_key: ticketKey,
      readiness: null,
      draft: null,
      traces: [],
      metadata: { stage2_failure: "readiness_branch_failed", reason: String(readinessSettled.reason) }
    });
    return {
      ticket_key: ticketKey,
      actionPackage: null,
      reviewerVerdict: null,
      emitResult: null,
      evidenceBundleId: bundleId2,
      repoMapFailureReason: "readiness_branch_failed",
      llm_traces: [],
      retrieved_chunks: retrievedChunks
    };
  }
  let repoMap = null;
  if (repoSettled.status === "fulfilled") {
    repoMap = repoSettled.value;
  } else {
    repoMapFailureReason = String(repoSettled.reason);
    logger.warn("repo_mapping_branch_failed", { ticket_key: ticketKey, error: repoMapFailureReason });
  }
  const contextBlock = buildContext(retrievedChunks, []).contextBlock;
  if (!readinessResult.readiness_status || readinessResult.readiness_status !== "blocked") {
    try {
      const enrichSchema = {
        type: "object",
        properties: {
          additional_missing_items: { type: "array" },
          additional_questions_for_pm: { type: "array" },
          additional_questions_for_engineer: { type: "array" },
          additional_questions_for_qa: { type: "array" }
        }
      };
      const prompt = enrichReadinessPrompt({
        ticketKey,
        ticketSummary: ticket.summary,
        acceptanceCriteria: ticket.acceptance_criteria,
        description: ticket.description,
        contextBlock,
        deterministicResult: JSON.stringify(readinessResult)
      });
      const { result, trace } = await Promise.race([
        llmAdapter.complete(prompt, enrichSchema),
        new Promise((_, reject) => setTimeout(() => reject(new Error("LLM enrichment timeout")), 1e4))
      ]);
      allLLMTraces.push(trace);
      if (result.additional_missing_items?.length > 0) {
        readinessResult = {
          ...readinessResult,
          missing_items: [
            ...readinessResult.missing_items,
            ...result.additional_missing_items.map((item) => ({
              dimension: item.dimension,
              severity: item.severity ?? "medium",
              reason: item.reason,
              source: "llm"
            }))
          ]
        };
      }
      if (result.additional_questions_for_pm?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_pm: [
            ...readinessResult.questions_for_pm,
            ...result.additional_questions_for_pm.map((q) => q.question)
          ]
        };
      }
      if (result.additional_questions_for_engineer?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_engineer: [
            ...readinessResult.questions_for_engineer,
            ...result.additional_questions_for_engineer.map((q) => q.question)
          ]
        };
      }
      if (result.additional_questions_for_qa?.length > 0) {
        readinessResult = {
          ...readinessResult,
          questions_for_qa: [
            ...readinessResult.questions_for_qa,
            ...result.additional_questions_for_qa.map((q) => q.question)
          ]
        };
      }
    } catch (err) {
      logger.warn("llm_enrichment_failed", { ticket_key: ticketKey, error: String(err) });
    }
  }
  let fetchedFileContents = {};
  if (fileContentAdapter && repoMap && repoMap.candidate_files.length > 0) {
    const candidates = repoMap.candidate_files.map((f) => {
      const parts = f.path.split("/");
      return {
        owner: "unknown",
        repo: parts[0] ?? "unknown",
        path: f.path,
        confidence: repoMap.candidate_components[0]?.confidence ?? 0.5
      };
    });
    try {
      const fetched = await fetchTopFiles(candidates, fileContentAdapter, 3);
      fetchedFileContents = Object.fromEntries(fetched.map((f) => [f.path, f.content]));
    } catch (err) {
      logger.warn("fetch_top_files_failed", { ticket_key: ticketKey, error: String(err) });
    }
  }
  const actionPackage = await planActionPackage({
    readiness: readinessResult,
    repoMap,
    summary: ticket.summary,
    llmAdapter,
    contextBlock,
    fileContents: fetchedFileContents
  });
  const verdict = reviewActionPackage(actionPackage, reviewerConfig);
  const emitResult = emitOpenSpecArtifact(actionPackage, verdict, emitterConfig);
  const bundleId = evidenceStore.save({
    ticket_key: ticketKey,
    readiness: readinessResult,
    draft: null,
    traces: [],
    llm_traces: allLLMTraces,
    retrieved_chunks: retrievedChunks,
    metadata: {
      stage: "stage2",
      reviewer_approved: verdict.approved,
      repo_map_failure: repoMapFailureReason ?? null,
      latency_ms: Date.now() - overallStart
    }
  });
  logger.info("stage2_pipeline_complete", {
    ticket_key: ticketKey,
    readiness_status: readinessResult.readiness_status,
    reviewer_approved: verdict.approved,
    repo_map_confidence: actionPackage.repo_map_confidence,
    llm_traces: allLLMTraces.length,
    retrieved_chunks: retrievedChunks.length,
    latency_ms: Date.now() - overallStart
  });
  return {
    ticket_key: ticketKey,
    actionPackage,
    reviewerVerdict: verdict,
    emitResult,
    evidenceBundleId: bundleId,
    repoMapFailureReason,
    llm_traces: allLLMTraces,
    retrieved_chunks: retrievedChunks
  };
}

// src/output/comment-draft.ts
function emitCommentDraft(result, run_id, opts = {}) {
  const baseUrl = opts.baseUrl ?? "https://product-overlord.internal";
  const confirm_post_url = `${baseUrl}/confirm-post/${run_id}/${result.ticket_key}`;
  const shadowMode = process.env["SHADOW_MODE"] === "true";
  const effectiveConfirmUrl = shadowMode ? `${baseUrl}/shadow-mode-no-op/${run_id}` : confirm_post_url;
  if (shadowMode) {
    process.stdout.write(
      JSON.stringify({ level: "info", message: "shadow_mode_draft", context: { run_id, ticket_key: result.ticket_key }, timestamp: (/* @__PURE__ */ new Date()).toISOString() }) + "\n"
    );
  }
  const lines = [];
  lines.push(`h3. Readiness Analysis \u2014 ${result.ticket_key}`);
  lines.push("");
  const verdictIcon = result.readiness_status === "ready" ? "\u2705" : result.readiness_status === "blocked" ? "\u{1F6AB}" : "\u26A0\uFE0F";
  lines.push(
    `*Verdict:* ${verdictIcon} ${result.readiness_status.toUpperCase().replace("_", " ")}  | *Score:* ${result.readiness_score}/100  | *Confidence:* ${Math.round(result.confidence * 100)}%`
  );
  lines.push("");
  lines.push(`_${result.explanation}_`);
  lines.push("");
  if (result.missing_items.length > 0) {
    lines.push("*Missing / incomplete:*");
    for (const item of result.missing_items) {
      const icon = item.severity === "high" ? "\u{1F534}" : item.severity === "medium" ? "\u{1F7E1}" : "\u{1F7E2}";
      lines.push(`* ${icon} *${item.dimension}* (${item.severity}) \u2014 ${item.reason}`);
    }
    lines.push("");
  }
  if (result.questions_for_pm.length > 0) {
    lines.push("*Questions for PM:*");
    for (const q of result.questions_for_pm) {
      lines.push(`# ${q}`);
    }
    lines.push("");
  }
  if (result.questions_for_engineer.length > 0) {
    lines.push("*Questions for Engineer:*");
    for (const q of result.questions_for_engineer) {
      lines.push(`# ${q}`);
    }
    lines.push("");
  }
  if (result.questions_for_qa.length > 0) {
    lines.push("*Questions for QA:*");
    for (const q of result.questions_for_qa) {
      lines.push(`# ${q}`);
    }
    lines.push("");
  }
  if (result.manual_checks.length > 0) {
    lines.push("*Manual checks required:*");
    for (const check of result.manual_checks) {
      lines.push(`* ${check}`);
    }
    lines.push("");
  }
  lines.push("----");
  lines.push(
    `_Generated by product-overlord \xB7 run_id: \`${run_id}\` \xB7 This comment requires human approval before posting._`
  );
  return {
    run_id,
    ticket_key: result.ticket_key,
    body: lines.join("\n"),
    confirm_post_url: effectiveConfirmUrl
  };
}

// src/forge/endpoints.ts
var PAYLOAD_LIMIT_BYTES = 4.5 * 1024 * 1024;
var ENDPOINT_TIMEOUT_MS = 3e4;
var DEFAULT_BASE_URL = process.env["PLANNING_TOOL_BASE_URL"] ?? "https://product-overlord.internal";
var csrfTokens = /* @__PURE__ */ new Map();
function buildDeepLink(base, runId) {
  return `${base}/runs/${runId}`;
}
function buildConfirmUrl(base, runId) {
  return `${base}/forge/output/confirm/${runId}`;
}
function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}
function buildSummary(pkg) {
  const operational = pkg.operational_risks?.slice(0, 3).join(", ") ?? "";
  const raw = `[${pkg.readiness_status.toUpperCase()}] score=${pkg.readiness_score} | ticket=${pkg.ticket_key}${operational ? ` | risks: ${operational}` : ""}${pkg.conflict ? " | \u26A0 conflict" : ""}`;
  return raw.slice(0, 500);
}
function toEnvelope(pkg, runId, base) {
  const topMissing = [
    ...pkg.manual_checks.slice(0, 3).map((c) => ({ dimension: c, severity: "medium" })),
    ...pkg.operational_risks.slice(0, 3).map((r) => ({ dimension: r, severity: "high" }))
  ].slice(0, 3);
  return {
    run_id: runId,
    summary: buildSummary(pkg),
    verdict: pkg.readiness_status,
    score: pkg.readiness_score,
    top_missing_items: topMissing,
    deep_link: buildDeepLink(base, runId),
    confirm_post_url: buildConfirmUrl(base, runId),
    status: "ok"
  };
}
function applySizeGuard(response, runId) {
  if (byteLength(response) <= PAYLOAD_LIMIT_BYTES) return response;
  const truncated = { ...response };
  delete truncated.action_package;
  truncated.status = "truncated";
  truncated.next_cursor = runId;
  logger.warn("forge_payload_size_guard_triggered", {
    run_id: runId,
    original_bytes: byteLength(response)
  });
  return truncated;
}
async function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}
var _orchestrator = null;
function getOrchestrator() {
  if (!_orchestrator) {
    const baseUrl = process.env["JIRA_BASE_URL"] ?? "https://atlassian.example.com";
    const accessToken = process.env["JIRA_ACCESS_TOKEN"] ?? "";
    const cloudId = process.env["JIRA_CLOUD_ID"] ?? "cloud-default";
    _orchestrator = new IngestionOrchestrator(
      new RovoMcpAdapter({ baseUrl: `${baseUrl}/mcp`, accessToken, cloudId }),
      new JiraAgileRestAdapter({ baseUrl, accessToken })
    );
  }
  return _orchestrator;
}
function unauthorized() {
  return { status: 401, body: { error: "Unauthorized \u2014 Forge token required" } };
}
function isAuthorized(req) {
  const auth = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
  return auth.length > 0;
}
async function handleIngestIssue(req) {
  if (!isAuthorized(req)) return unauthorized();
  const body = req.body;
  const issueKey = body?.issue_key?.trim();
  if (!issueKey) {
    return {
      status: 400,
      body: { run_id: "", summary: "issue_key is required", verdict: "blocked", score: 0, top_missing_items: [], deep_link: "", confirm_post_url: "" }
    };
  }
  const base = body?.base_url ?? DEFAULT_BASE_URL;
  const start = Date.now();
  const result = await withTimeout(
    (async () => {
      const orchestrator = getOrchestrator();
      const { issues } = await orchestrator.ingestIssue(issueKey);
      const canonical = normaliseTicket(issues[0]);
      const stage2 = await runStage2Pipeline({ ticket: canonical, componentIndex: null });
      const { actionPackage, reviewerVerdict, evidenceBundleId } = stage2;
      if (!actionPackage) {
        const envelope2 = {
          run_id: evidenceBundleId,
          summary: "Analysis failed \u2014 no action package produced",
          verdict: "blocked",
          score: 0,
          top_missing_items: [],
          deep_link: buildDeepLink(base, evidenceBundleId),
          confirm_post_url: buildConfirmUrl(base, evidenceBundleId),
          status: "ok"
        };
        return { ...envelope2 };
      }
      const csrfToken = randomUUID2();
      csrfTokens.set(evidenceBundleId, csrfToken);
      const envelope = toEnvelope(actionPackage, evidenceBundleId, base);
      const response = {
        ...envelope,
        action_package: actionPackage,
        reviewer_verdict: reviewerVerdict ?? void 0
      };
      return applySizeGuard(response, evidenceBundleId);
    })(),
    ENDPOINT_TIMEOUT_MS
  );
  latencyTracker.record("forge/ingest/issue", Date.now() - start);
  if (!result) {
    const runId = randomUUID2();
    logger.warn("forge_ingest_issue_timeout", { issue_key: issueKey });
    const envelope = {
      run_id: runId,
      summary: "Orchestrator timed out \u2014 retry via deep_link",
      verdict: "blocked",
      score: 0,
      top_missing_items: [],
      deep_link: buildDeepLink(base, runId),
      confirm_post_url: buildConfirmUrl(base, runId),
      status: "timeout"
    };
    return { status: 200, body: envelope };
  }
  return { status: 200, body: result };
}
async function handleIngestBoard(req) {
  if (!isAuthorized(req)) return unauthorized();
  const boardId = Number(req.params?.["id"] ?? req.query?.["id"] ?? "0");
  if (!boardId) {
    return {
      status: 400,
      body: { run_id: "", board_id: 0, issues: [], total_issues_on_page: 0, status: "ok" }
    };
  }
  const base = req.query?.["base_url"] ?? DEFAULT_BASE_URL;
  const pageSize = Math.min(Number(req.query?.["page_size"] ?? "25"), 50);
  const cursor = req.query?.["cursor"];
  const start = Date.now();
  const result = await withTimeout(
    (async () => {
      const orchestrator = getOrchestrator();
      const { issues: rawIssues } = await orchestrator.ingestBoard(boardId);
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const page = rawIssues.slice(offset, offset + pageSize);
      const hasMore = offset + pageSize < rawIssues.length;
      const nextCursor = hasMore ? String(offset + pageSize) : void 0;
      const envelopes = [];
      for (let i = 0; i < page.length; i++) {
        const raw = page[i];
        const canonical = normaliseTicket(raw);
        const stage2 = await runStage2Pipeline({ ticket: canonical, componentIndex: null });
        const { actionPackage, evidenceBundleId } = stage2;
        if (!actionPackage) {
          envelopes.push({
            run_id: evidenceBundleId,
            summary: `Analysis failed for ${canonical.ticket_key}`,
            verdict: "blocked",
            score: 0,
            top_missing_items: [],
            deep_link: buildDeepLink(base, evidenceBundleId),
            confirm_post_url: buildConfirmUrl(base, evidenceBundleId),
            status: "ok",
            issue_index: offset + i
          });
          continue;
        }
        const csrfToken = randomUUID2();
        csrfTokens.set(evidenceBundleId, csrfToken);
        const env = toEnvelope(actionPackage, evidenceBundleId, base);
        envelopes.push({ ...env, issue_index: offset + i });
      }
      const runId = randomUUID2();
      const response = {
        run_id: runId,
        board_id: boardId,
        issues: envelopes,
        next_cursor: nextCursor,
        total_issues_on_page: envelopes.length,
        status: "ok"
      };
      if (byteLength(response) > PAYLOAD_LIMIT_BYTES) {
        logger.warn("forge_board_payload_truncated", { board_id: boardId, run_id: runId });
        return { ...response, status: "truncated", next_cursor: nextCursor ?? String(offset + pageSize) };
      }
      return response;
    })(),
    ENDPOINT_TIMEOUT_MS
  );
  latencyTracker.record("forge/ingest/board", Date.now() - start);
  if (!result) {
    logger.warn("forge_ingest_board_timeout", { board_id: boardId });
    return {
      status: 200,
      body: {
        run_id: randomUUID2(),
        board_id: boardId,
        issues: [],
        total_issues_on_page: 0,
        status: "timeout"
      }
    };
  }
  return { status: 200, body: result };
}
async function handleGetPlan(req) {
  if (!isAuthorized(req)) return unauthorized();
  const runId = req.params?.["run_id"] ?? req.query?.["run_id"] ?? "";
  if (!runId) {
    return { status: 400, body: { run_id: "", found: false, error: "run_id is required" } };
  }
  const base = req.query?.["base_url"] ?? DEFAULT_BASE_URL;
  const bundle = evidenceStore.get(runId);
  if (!bundle) {
    return { status: 404, body: { run_id: runId, found: false, error: "run not found or expired" } };
  }
  const meta = bundle.metadata;
  const actionPackage = meta?.action_package ?? void 0;
  const envelope = actionPackage ? toEnvelope(actionPackage, runId, base) : void 0;
  const response = {
    run_id: runId,
    found: true,
    action_package: actionPackage,
    envelope
  };
  return { status: 200, body: applySizeGuard(response, runId) };
}
async function handleConfirmPost(req) {
  if (!isAuthorized(req)) return unauthorized();
  const runId = req.params?.["run_id"] ?? "";
  if (!runId) {
    return { status: 400, body: { run_id: "", outcome: "error", error: "run_id is required" } };
  }
  const body = req.body;
  const csrfToken = body?.csrf_token ?? "";
  const approverId = body?.approver_account_id ?? "";
  if (!csrfToken || !approverId) {
    return {
      status: 400,
      body: { run_id: runId, outcome: "error", error: "csrf_token and approver_account_id are required" }
    };
  }
  const storedToken = csrfTokens.get(runId);
  if (!storedToken || storedToken !== csrfToken) {
    logger.warn("forge_confirm_post_csrf_mismatch", { run_id: runId });
    return { status: 403, body: { run_id: runId, outcome: "error", error: "Invalid or expired CSRF token" } };
  }
  const bundle = evidenceStore.get(runId);
  if (!bundle) {
    return { status: 404, body: { run_id: runId, outcome: "error", error: "run not found or expired" } };
  }
  const readinessResult = bundle.scorer_output;
  if (!readinessResult) {
    return { status: 422, body: { run_id: runId, outcome: "error", error: "No readiness result found for this run \u2014 cannot draft comment" } };
  }
  const draft = emitCommentDraft(readinessResult, runId);
  const jiraCommentId = randomUUID2();
  logger.info("forge_confirm_post_approved", {
    run_id: runId,
    approver: approverId,
    ticket_key: draft.ticket_key,
    jira_comment_id: jiraCommentId
  });
  csrfTokens.delete(runId);
  return {
    status: 200,
    body: { run_id: runId, outcome: "posted", jira_comment_id: jiraCommentId }
  };
}

// src/knowledge/index.ts
import { randomUUID as randomUUID4 } from "crypto";

// src/knowledge/types.ts
var FileTooLargeError = class extends Error {
  constructor(name, sizeBytes, limitBytes) {
    super(
      `File "${name}" (${(sizeBytes / 1024 / 1024).toFixed(1)} MB) exceeds the ${(limitBytes / 1024 / 1024).toFixed(0)} MB upload limit`
    );
    this.name = "FileTooLargeError";
  }
};
var StoreFullError = class extends Error {
  constructor(currentGb, maxGb) {
    super(`KB store is full: ${currentGb.toFixed(2)} GB used of ${maxGb} GB limit`);
    this.name = "StoreFullError";
  }
};
var UnsupportedFormatError = class extends Error {
  constructor(ext) {
    super(`Unsupported file format: "${ext}". Supported: pdf, md, txt`);
    this.name = "UnsupportedFormatError";
  }
};

// src/knowledge/parser.ts
async function parseBuffer(buffer, filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return { text: data.text, format: "pdf", name: filename };
  }
  if (ext === "md" || ext === "markdown") {
    return { text: buffer.toString("utf-8"), format: "markdown", name: filename };
  }
  if (ext === "txt") {
    return { text: buffer.toString("utf-8"), format: "text", name: filename };
  }
  throw new UnsupportedFormatError(ext || "(no extension)");
}
async function parseHtml(html, url) {
  const { load } = await import("cheerio");
  const $ = load(html);
  $("script, style, nav, header, footer, [aria-hidden='true']").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  return { text, format: "html", name: url };
}

// src/knowledge/embedder.ts
var BATCH_SIZE = 32;
async function embedTexts(texts, adapter) {
  const vectors = [];
  const traces = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { vectors: batchVectors, trace } = await adapter.embed(batch);
    vectors.push(...batchVectors);
    traces.push(trace);
  }
  return { vectors, traces };
}

// src/knowledge/store.ts
import { randomUUID as randomUUID3 } from "crypto";
var TABLE_NAME = "kb_chunks";
var SOURCES_TABLE = "kb_sources";
async function getLanceDB() {
  return await import("@lancedb/lancedb");
}
var KBStore = class {
  storePath;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = null;
  constructor(storePath) {
    this.storePath = storePath;
  }
  async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }
  /** Ingest pre-embedded chunks into the store. */
  async ingest(source, chunks) {
    const db = await this.getDb();
    const rows = chunks.map((c) => ({
      chunk_id: c.chunk_id,
      source_id: c.source_id,
      source_type: c.source_type,
      project_key: c.project_key,
      text: c.text,
      chunk_index: c.chunk_index,
      file_path: c.file_path ?? null,
      url: c.url ?? null,
      vector: c.vector ?? []
    }));
    const tableNames = await db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      await table.add(rows);
    } else {
      await db.createTable(TABLE_NAME, rows);
    }
    const sourceRow = {
      source_id: source.source_id,
      project_key: source.project_key,
      source_type: source.source_type,
      format: source.format,
      name: source.name,
      origin: source.origin,
      chunk_count: source.chunk_count,
      indexed_at: source.indexed_at,
      size_bytes: source.size_bytes
    };
    if (tableNames.includes(SOURCES_TABLE)) {
      const tbl = await db.openTable(SOURCES_TABLE);
      await tbl.add([sourceRow]);
    } else {
      await db.createTable(SOURCES_TABLE, [sourceRow]);
    }
  }
  /** ANN search for top-K chunks matching the query vector, filtered by project_key. */
  async search(queryVector, projectKey, topK = 5) {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return [];
    const table = await db.openTable(TABLE_NAME);
    const results = await table.search(queryVector).where(`project_key = '${projectKey}'`).limit(topK).execute();
    return results.map((r) => ({
      source_id: r.source_id,
      source_type: r.source_type,
      file_path: r.file_path ?? void 0,
      url: r.url ?? void 0,
      text: r.text,
      score: r._distance !== void 0 ? Math.max(0, 1 - r._distance) : 0
    }));
  }
  /** List all sources for a project. */
  async listSources(projectKey) {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(SOURCES_TABLE)) return [];
    const table = await db.openTable(SOURCES_TABLE);
    const rows = await table.filter(`project_key = '${projectKey}'`).execute();
    return rows;
  }
  /** Delete all chunks and source record for a given source_id. */
  async deleteSource(sourceId) {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      await table.delete(`source_id = '${sourceId}'`);
    }
    if (tableNames.includes(SOURCES_TABLE)) {
      const table = await db.openTable(SOURCES_TABLE);
      await table.delete(`source_id = '${sourceId}'`);
    }
  }
  /** Approximate total size in bytes of all stored data. */
  async sizeBytes() {
    const db = await this.getDb();
    const tableNames = await db.tableNames();
    if (!tableNames.includes(SOURCES_TABLE)) return 0;
    const table = await db.openTable(SOURCES_TABLE);
    const rows = await table.query().execute();
    return rows.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0);
  }
};
function makeSourceId() {
  return randomUUID3();
}

// src/knowledge/crawler.ts
var FETCH_TIMEOUT_MS = 3e4;
var MAX_DEPTH = 3;
async function crawlUrl(startUrl, depth = 1) {
  const clampedDepth = Math.min(Math.max(depth, 1), MAX_DEPTH);
  const visited = /* @__PURE__ */ new Set();
  const pages = [];
  await crawlPage(startUrl, clampedDepth, visited, pages);
  return { url: startUrl, pages };
}
async function crawlPage(url, remainingDepth, visited, pages) {
  if (visited.has(url)) return;
  visited.add(url);
  const html = await fetchWithTimeout(url);
  if (!html) return;
  const parsed = await parseHtml(html, url);
  pages.push(parsed);
  if (remainingDepth <= 1) return;
  const links = extractLinks(html, url);
  await Promise.all(
    links.slice(0, 10).map(
      (link) => crawlPage(link, remainingDepth - 1, visited, pages)
    )
  );
}
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function extractLinks(html, base) {
  const origin = new URL(base).origin;
  const pattern = /href=["']([^"']+)["']/gi;
  const links = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const resolved = new URL(match[1], base).href;
      if (resolved.startsWith(origin)) links.push(resolved);
    } catch {
    }
  }
  return [...new Set(links)];
}

// src/knowledge/index.ts
var UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024;
var KnowledgeBase = class {
  store;
  adapter;
  maxSizeBytes;
  constructor(opts) {
    this.store = new KBStore(opts.storePath);
    this.adapter = opts.adapter;
    this.maxSizeBytes = opts.maxSizeGb * 1024 * 1024 * 1024;
  }
  /** Ingest a file buffer. */
  async ingestFile(buffer, filename, projectKey) {
    if (buffer.byteLength > UPLOAD_LIMIT_BYTES) {
      throw new FileTooLargeError(filename, buffer.byteLength, UPLOAD_LIMIT_BYTES);
    }
    await this._guardStoreSize(buffer.byteLength);
    const parsed = await parseBuffer(buffer, filename);
    const rawChunks = chunkText(parsed.text);
    const sourceId = makeSourceId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const texts = rawChunks.map((c) => c.text);
    const { vectors } = await embedTexts(texts, this.adapter);
    const chunks = rawChunks.map((c, i) => ({
      chunk_id: randomUUID4(),
      source_id: sourceId,
      source_type: "kt",
      project_key: projectKey,
      text: c.text,
      chunk_index: c.chunk_index,
      vector: vectors[i]
    }));
    const source = {
      source_id: sourceId,
      project_key: projectKey,
      source_type: "kt",
      format: parsed.format,
      name: filename,
      origin: filename,
      chunk_count: chunks.length,
      indexed_at: now,
      size_bytes: buffer.byteLength
    };
    await this.store.ingest(source, chunks);
    return { source_id: sourceId, chunk_count: chunks.length, size_bytes: buffer.byteLength, indexed_at: now };
  }
  /** Crawl a URL and ingest all pages. */
  async crawlUrl(url, projectKey, depth = 1) {
    const { pages } = await crawlUrl(url, depth);
    const combinedText = pages.map((p) => p.text).join("\n\n");
    const sizeBytes = Buffer.byteLength(combinedText, "utf-8");
    await this._guardStoreSize(sizeBytes);
    const rawChunks = chunkText(combinedText);
    const sourceId = makeSourceId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const texts = rawChunks.map((c) => c.text);
    const { vectors } = await embedTexts(texts, this.adapter);
    const chunks = rawChunks.map((c, i) => ({
      chunk_id: randomUUID4(),
      source_id: sourceId,
      source_type: "kt",
      project_key: projectKey,
      text: c.text,
      chunk_index: c.chunk_index,
      url,
      vector: vectors[i]
    }));
    const source = {
      source_id: sourceId,
      project_key: projectKey,
      source_type: "kt",
      format: "html",
      name: url,
      origin: url,
      chunk_count: chunks.length,
      indexed_at: now,
      size_bytes: sizeBytes
    };
    await this.store.ingest(source, chunks);
    return { source_id: sourceId, chunk_count: chunks.length, size_bytes: sizeBytes, indexed_at: now };
  }
  async listSources(projectKey) {
    return this.store.listSources(projectKey);
  }
  async deleteSource(sourceId) {
    return this.store.deleteSource(sourceId);
  }
  async sizeBytes() {
    return this.store.sizeBytes();
  }
  // Expose store for RAG retrieval
  getStore() {
    return this.store;
  }
  async _guardStoreSize(incomingBytes) {
    const current = await this.store.sizeBytes();
    if (current + incomingBytes > this.maxSizeBytes) {
      throw new StoreFullError(
        (current + incomingBytes) / 1e9,
        this.maxSizeBytes / 1e9
      );
    }
  }
};

// src/server/app.ts
import { z as z2 } from "zod";

// src/connections/SecretStore.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { existsSync as existsSync2, mkdirSync as mkdirSync2, readFileSync, writeFileSync as writeFileSync2, unlinkSync } from "fs";
import { join as join2 } from "path";
import os from "os";
var STORE_DIR = process.env.CREDENTIAL_STORE_PATH ?? join2(os.homedir(), ".overlord", "credentials");
var ALGO = "aes-256-gcm";
var SALT_FILE = join2(STORE_DIR, ".salt");
function ensureDir() {
  if (!existsSync2(STORE_DIR)) mkdirSync2(STORE_DIR, { recursive: true, mode: 448 });
}
function getMachineKey() {
  ensureDir();
  let salt;
  if (existsSync2(SALT_FILE)) {
    salt = Buffer.from(readFileSync(SALT_FILE, "utf8"), "hex");
  } else {
    salt = randomBytes(32);
    writeFileSync2(SALT_FILE, salt.toString("hex"), { mode: 384 });
  }
  const passphrase = `${os.hostname()}-${process.getuid?.() ?? 0}`;
  return scryptSync(passphrase, salt, 32);
}
function secretSave(key, value) {
  ensureDir();
  const masterKey = getMachineKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const record = {
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
    ciphertext: ciphertext.toString("hex")
  };
  writeFileSync2(join2(STORE_DIR, `${encodeURIComponent(key)}.enc`), JSON.stringify(record), { mode: 384 });
}
function secretLoad(key) {
  ensureDir();
  const filePath = join2(STORE_DIR, `${encodeURIComponent(key)}.enc`);
  if (!existsSync2(filePath)) return null;
  try {
    const masterKey = getMachineKey();
    const record = JSON.parse(readFileSync(filePath, "utf8"));
    const decipher = createDecipheriv(ALGO, masterKey, Buffer.from(record.iv, "hex"));
    decipher.setAuthTag(Buffer.from(record.authTag, "hex"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, "hex")),
      decipher.final()
    ]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}

// src/connections/ConnectionManager.ts
var SECRET_FIELDS = {
  jira: ["token"],
  openai: ["apiKey"],
  github: ["pat", "privateKey"]
};
function maskConfig(provider, config2) {
  const masked = { ...config2 };
  for (const field of SECRET_FIELDS[provider]) {
    if (masked[field]) masked[field] = "***";
  }
  return masked;
}
function configKey(provider) {
  return `overlord.connection.${provider}`;
}
var ConnectionManager = class _ConnectionManager {
  static _instance;
  static get instance() {
    if (!this._instance) this._instance = new _ConnectionManager();
    return this._instance;
  }
  // ── Static delegates (proxy to singleton) ─────────────────────────────────
  static async save(provider, config2) {
    return _ConnectionManager.instance.save(provider, config2);
  }
  static async load(provider) {
    return _ConnectionManager.instance.load(provider);
  }
  static async loadRaw(provider) {
    return _ConnectionManager.instance.loadRaw(provider);
  }
  static async test(provider) {
    return _ConnectionManager.instance.test(provider);
  }
  // ── Instance methods ───────────────────────────────────────────────────────
  async save(provider, config2) {
    await secretSave(configKey(provider), JSON.stringify(config2));
  }
  async load(provider) {
    const raw = await secretLoad(configKey(provider));
    if (!raw) return null;
    const config2 = JSON.parse(raw);
    return maskConfig(provider, config2);
  }
  async loadRaw(provider) {
    const raw = await secretLoad(configKey(provider));
    if (!raw) return null;
    return JSON.parse(raw);
  }
  async test(provider) {
    const config2 = await this.loadRaw(provider);
    if (!config2) return { ok: false, latency_ms: 0, error: "No configuration saved" };
    const start = Date.now();
    try {
      switch (provider) {
        case "jira": {
          const { testJira: testJira2 } = await Promise.resolve().then(() => (init_JiraProvider(), JiraProvider_exports));
          await testJira2(config2);
          break;
        }
        case "openai": {
          const { testOpenAI: testOpenAI2 } = await Promise.resolve().then(() => (init_OpenAIProvider(), OpenAIProvider_exports));
          await testOpenAI2(config2);
          break;
        }
        case "github": {
          const { testGitHub: testGitHub2 } = await Promise.resolve().then(() => (init_GitHubProvider(), GitHubProvider_exports));
          await testGitHub2(config2);
          break;
        }
      }
      return { ok: true, latency_ms: Date.now() - start };
    } catch (err) {
      return { ok: false, latency_ms: Date.now() - start, error: String(err) };
    }
  }
};

// src/agents/AgentEventBus.ts
var RING_SIZE = 2e3;
var AgentEventBusImpl = class {
  ring = [];
  subscribers = /* @__PURE__ */ new Set();
  emit(event) {
    if (this.ring.length >= RING_SIZE) this.ring.shift();
    this.ring.push(event);
    for (const sub of this.subscribers) {
      try {
        sub(event);
      } catch {
      }
    }
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  /** Returns a snapshot of recent events, optionally filtered by agent name. */
  replay(agentFilter) {
    if (!agentFilter) return [...this.ring];
    return this.ring.filter((e) => e.agent === agentFilter);
  }
  /** Helper to build a typed event and emit it. */
  start(agent, run_id, parent_run_id) {
    this.emit({ event: "start", agent, run_id, ts: (/* @__PURE__ */ new Date()).toISOString(), ...parent_run_id ? { parent_run_id } : {} });
  }
  progress(agent, run_id, pct, msg) {
    this.emit({ event: "progress", agent, run_id, pct, msg, ts: (/* @__PURE__ */ new Date()).toISOString() });
  }
  delay(agent, run_id, reason, retry_in_ms) {
    this.emit({ event: "delay", agent, run_id, reason, retry_in_ms, ts: (/* @__PURE__ */ new Date()).toISOString() });
  }
  finish(agent, run_id, status, duration_ms) {
    this.emit({ event: "finish", agent, run_id, status, duration_ms, ts: (/* @__PURE__ */ new Date()).toISOString() });
  }
  finding(agent, run_id, finding_id, severity, message) {
    this.emit({ event: "finding", agent, run_id, finding_id, severity, message, ts: (/* @__PURE__ */ new Date()).toISOString() });
  }
};
var AgentEventBus = new AgentEventBusImpl();

// src/agents/AgentRegistry.ts
var AgentRegistryImpl = class {
  byRunId = /* @__PURE__ */ new Map();
  byName = /* @__PURE__ */ new Map();
  // name → run_ids
  register(name, run_id, parent_run_id) {
    const controller = new AbortController();
    const record = { name, run_id, started_at: (/* @__PURE__ */ new Date()).toISOString(), parent_run_id, controller };
    this.byRunId.set(run_id, record);
    if (!this.byName.has(name)) this.byName.set(name, /* @__PURE__ */ new Set());
    this.byName.get(name).add(run_id);
    return controller;
  }
  deregister(run_id) {
    const record = this.byRunId.get(run_id);
    if (record) {
      this.byName.get(record.name)?.delete(run_id);
      this.byRunId.delete(run_id);
    }
  }
  stopRun(run_id) {
    const record = this.byRunId.get(run_id);
    if (!record) return false;
    record.controller.abort();
    return true;
  }
  stopAgent(name) {
    const runIds = this.byName.get(name) ?? /* @__PURE__ */ new Set();
    let count = 0;
    for (const run_id of runIds) {
      if (this.stopRun(run_id)) count++;
    }
    return count;
  }
  listAgents() {
    return [...this.byName.keys()];
  }
  listRuns() {
    return [...this.byRunId.values()].map((r) => ({ ...r, controller: r.controller }));
  }
  getSignal(run_id) {
    return this.byRunId.get(run_id)?.controller.signal;
  }
};
var AgentRegistry = new AgentRegistryImpl();

// src/decisions/DecisionQueue.ts
import { randomUUID as randomUUID5 } from "crypto";
var MAX_SIZE = 500;
var DecisionQueueImpl = class {
  queue = /* @__PURE__ */ new Map();
  resolvers = /* @__PURE__ */ new Map();
  subscribers = /* @__PURE__ */ new Set();
  enqueue(agent, run_id, type, payload) {
    if (this.queue.size >= MAX_SIZE) {
      for (const [id, d] of this.queue) {
        if (d.status === "pending") {
          this.queue.delete(id);
          break;
        }
      }
    }
    const decision = {
      id: randomUUID5(),
      agent,
      run_id,
      type,
      payload,
      requires_review: true,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: "pending"
    };
    this.queue.set(decision.id, decision);
    this.broadcast(decision);
    AgentEventBus.emit({ event: "decision", agent, run_id, decision_id: decision.id, ts: decision.created_at });
    return new Promise((resolve) => {
      this.resolvers.set(decision.id, resolve);
    });
  }
  approve(id) {
    return this.resolve(id, "approved");
  }
  reject(id, reason) {
    return this.resolve(id, "rejected", { reason });
  }
  modify(id, patch) {
    return this.resolve(id, "modified", { patch });
  }
  resolve(id, status, extra) {
    const d = this.queue.get(id);
    if (!d || d.status !== "pending") return null;
    d.status = status;
    d.resolution = { ...extra, resolved_at: (/* @__PURE__ */ new Date()).toISOString() };
    this.broadcast(d);
    this.resolvers.get(id)?.(d);
    this.resolvers.delete(id);
    return d;
  }
  subscribe(fn) {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }
  broadcast(d) {
    for (const sub of this.subscribers) {
      try {
        sub(d);
      } catch {
      }
    }
  }
  list(statusFilter) {
    const all = [...this.queue.values()];
    return statusFilter ? all.filter((d) => d.status === statusFilter) : all;
  }
  get(id) {
    return this.queue.get(id);
  }
  /** Test helper — clears all state. */
  _resetForTests() {
    this.queue.clear();
    this.resolvers.clear();
    this.subscribers.clear();
  }
};
var DecisionQueue = new DecisionQueueImpl();

// src/workflows/WorkflowEngine.ts
import { randomUUID as randomUUID6 } from "crypto";
var STAGE_REGISTRY = {};
function registerStage(stage) {
  STAGE_REGISTRY[stage.name] = stage;
}
function makeStub(name, avgRecords = 20) {
  return {
    name,
    async run(_ctx, signal) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 200);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      const records = Math.floor(Math.random() * avgRecords) + 5;
      return { name, records, new: Math.floor(records * 0.3), updated: Math.floor(records * 0.4), unchanged: Math.floor(records * 0.3), token_estimate: records * 150 };
    }
  };
}
["crawl-docs", "crawl-jira", "crawl-github", "normalise", "enrich", "embed", "upsert-lancedb"].forEach((n) => registerStage(makeStub(n)));
var TOKEN_COST_PER_1K = 0.01;
var WorkflowEngineImpl = class {
  runs = /* @__PURE__ */ new Map();
  async plan(stages) {
    const diffs = [];
    for (const name of stages) {
      const stage = STAGE_REGISTRY[name];
      if (!stage) continue;
      const ctrl = new AbortController();
      const diff = await stage.run({ runId: "plan", stages, planMode: true }, ctrl.signal);
      diffs.push(diff);
    }
    const estimated_tokens = diffs.reduce((s, d) => s + d.token_estimate, 0);
    return { stages: diffs, estimated_tokens, estimated_cost_usd: estimated_tokens / 1e3 * TOKEN_COST_PER_1K };
  }
  async run(stages) {
    const run_id = randomUUID6();
    const controller = new AbortController();
    const runRecord = {
      run_id,
      stages,
      status: "running",
      started_at: (/* @__PURE__ */ new Date()).toISOString(),
      records_processed: 0,
      error_count: 0,
      controller
    };
    this.runs.set(run_id, runRecord);
    (async () => {
      const startMs = Date.now();
      AgentEventBus.start("workflow", run_id);
      let pct = 0;
      for (const name of stages) {
        if (controller.signal.aborted) {
          runRecord.status = "stopped";
          break;
        }
        const stage = STAGE_REGISTRY[name];
        if (!stage) continue;
        try {
          AgentEventBus.progress("workflow", run_id, pct, `Running stage: ${name}`);
          const diff = await stage.run({ runId: run_id, stages, planMode: false }, controller.signal);
          runRecord.records_processed += diff.records;
          pct = Math.min(100, pct + Math.floor(100 / stages.length));
        } catch (err) {
          if (err.name === "AbortError") {
            runRecord.status = "stopped";
            break;
          }
          runRecord.error_count++;
        }
      }
      if (runRecord.status === "running") runRecord.status = "completed";
      runRecord.finished_at = (/* @__PURE__ */ new Date()).toISOString();
      AgentEventBus.finish("workflow", run_id, runRecord.status === "completed" ? "ok" : runRecord.status === "stopped" ? "stopped" : "error", Date.now() - startMs);
    })();
    return run_id;
  }
  stop(run_id) {
    const run = this.runs.get(run_id);
    if (!run) return false;
    run.controller.abort();
    run.status = "stopped";
    run.finished_at = (/* @__PURE__ */ new Date()).toISOString();
    return true;
  }
  listRuns() {
    return [...this.runs.values()].map(({ controller: _c, ...r }) => r);
  }
  getRun(run_id) {
    const run = this.runs.get(run_id);
    if (!run) return void 0;
    const { controller: _c, ...r } = run;
    return r;
  }
};
var WorkflowEngine = new WorkflowEngineImpl();

// src/workflows/WorkflowScheduler.ts
import cron from "node-cron";
import { randomUUID as randomUUID7 } from "crypto";
import { existsSync as existsSync3, mkdirSync as mkdirSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync3 } from "fs";
import { join as join3 } from "path";
var SCHEDULES_PATH = process.env.SCHEDULES_PATH ?? join3("data", "workflows", "schedules.json");
var WorkflowSchedulerImpl = class {
  schedules = /* @__PURE__ */ new Map();
  tasks = /* @__PURE__ */ new Map();
  load() {
    try {
      if (!existsSync3(SCHEDULES_PATH)) return;
      const data = JSON.parse(readFileSync2(SCHEDULES_PATH, "utf8"));
      for (const s of data) {
        this.schedules.set(s.id, s);
        if (s.enabled) this.startTask(s);
      }
    } catch {
    }
  }
  save() {
    try {
      const dir = SCHEDULES_PATH.split("/").slice(0, -1).join("/");
      if (dir) mkdirSync3(dir, { recursive: true });
      writeFileSync3(SCHEDULES_PATH, JSON.stringify([...this.schedules.values()], null, 2));
    } catch {
    }
  }
  startTask(schedule) {
    if (!cron.validate(schedule.cron_expr)) return;
    const task = cron.schedule(schedule.cron_expr, async () => {
      schedule.last_run = (/* @__PURE__ */ new Date()).toISOString();
      await WorkflowEngine.run(schedule.stages);
      this.save();
    });
    this.tasks.set(schedule.id, task);
  }
  upsert(data) {
    const existing = [...this.schedules.values()].find((s) => s.name === data.name);
    const id = existing?.id ?? randomUUID7();
    if (existing) {
      this.tasks.get(id)?.stop();
      this.tasks.delete(id);
    }
    const schedule = { ...data, id, created_at: existing?.created_at ?? (/* @__PURE__ */ new Date()).toISOString() };
    this.schedules.set(id, schedule);
    if (schedule.enabled) this.startTask(schedule);
    this.save();
    return schedule;
  }
  delete(id) {
    if (!this.schedules.has(id)) return false;
    this.tasks.get(id)?.stop();
    this.tasks.delete(id);
    this.schedules.delete(id);
    this.save();
    return true;
  }
  list() {
    return [...this.schedules.values()];
  }
};
var WorkflowScheduler = new WorkflowSchedulerImpl();

// src/orchestrators/OrchestratorTeam.ts
import { randomUUID as randomUUID8 } from "crypto";
import { appendFileSync, mkdirSync as mkdirSync4, existsSync as existsSync4 } from "fs";
var FINDINGS_PATH = process.env.FINDINGS_PATH ?? "data/orchestrators/findings.jsonl";
var THRASH_WINDOW_MS = 3e4;
var THRASH_THRESHOLD = 10;
var STALL_TIMEOUT_MS = Number(process.env.ORCHESTRATOR_STALL_TIMEOUT_S ?? 60) * 1e3;
var TICK_MS = 5e3;
var OrchestratorTeamImpl = class {
  findings = /* @__PURE__ */ new Map();
  eventCounts = /* @__PURE__ */ new Map();
  lastProgress = /* @__PURE__ */ new Map();
  // run_id → timestamp
  tickInterval;
  unsubscribe;
  start() {
    this.unsubscribe = AgentEventBus.subscribe((e) => this.handleEvent(e));
    this.tickInterval = setInterval(() => this.tick(), TICK_MS);
  }
  stop() {
    this.unsubscribe?.();
    if (this.tickInterval) clearInterval(this.tickInterval);
  }
  handleEvent(e) {
    const key = `${e.agent}:${e.run_id}`;
    if (e.event === "progress") {
      this.lastProgress.set(e.run_id, Date.now());
    }
    if (e.event === "start" || e.event === "progress") {
      const entry = this.eventCounts.get(key) ?? { count: 0, windowStart: Date.now() };
      if (Date.now() - entry.windowStart > THRASH_WINDOW_MS) {
        entry.count = 1;
        entry.windowStart = Date.now();
      } else {
        entry.count++;
        if (entry.count > THRASH_THRESHOLD) {
          this.emitFinding(
            e.agent,
            e.run_id,
            "critical",
            "thrash",
            `Agent ${e.agent} triggered ${entry.count} events in ${THRASH_WINDOW_MS / 1e3}s window (thrashing)`
          );
          entry.count = 0;
          entry.windowStart = Date.now();
        }
      }
      this.eventCounts.set(key, entry);
    }
    if (e.event === "finish") {
      this.lastProgress.delete(e.run_id);
      this.eventCounts.delete(key);
    }
  }
  tick() {
    const now = Date.now();
    for (const [run_id, lastMs] of this.lastProgress) {
      if (now - lastMs > STALL_TIMEOUT_MS) {
        const runs = AgentRegistry.listRuns();
        const run = runs.find((r) => r.run_id === run_id);
        if (run) {
          this.emitFinding(
            run.name,
            run_id,
            "warn",
            "stall",
            `Agent ${run.name} (run ${run_id}) has not emitted a progress event for ${STALL_TIMEOUT_MS / 1e3}s`
          );
          this.lastProgress.delete(run_id);
        }
      }
    }
  }
  emitFinding(agent, run_id, severity, type, message) {
    const id = randomUUID8();
    const finding = {
      id,
      agent,
      run_id,
      severity,
      type,
      message,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: "open"
    };
    this.findings.set(id, finding);
    AgentEventBus.finding(agent, run_id, id, severity, message);
    this.persist(finding);
  }
  persist(finding) {
    try {
      const dir = FINDINGS_PATH.split("/").slice(0, -1).join("/");
      if (dir && !existsSync4(dir)) mkdirSync4(dir, { recursive: true });
      appendFileSync(FINDINGS_PATH, JSON.stringify(finding) + "\n");
    } catch {
    }
  }
  ack(id) {
    const f = this.findings.get(id);
    if (!f) return null;
    f.status = "acked";
    return f;
  }
  escalate(id) {
    const f = this.findings.get(id);
    if (!f) return null;
    f.status = "escalated";
    return f;
  }
  list(status) {
    const all = [...this.findings.values()];
    return status ? all.filter((f) => f.status === status) : all;
  }
  get(id) {
    return this.findings.get(id);
  }
};
var OrchestratorTeam = new OrchestratorTeamImpl();

// src/forge/instrumentation.ts
var ForgeInstrumentation = class {
  actionMetrics = [];
  deepLinkEvents = [];
  llmCallEvents = [];
  ragRetrievalEvents = [];
  // Task 13.2 — SSE subscriber list for /api/metrics fan-out
  sseSubscribers = [];
  // Task 13.3 — UI action counters
  uiActionCounters = /* @__PURE__ */ new Map();
  /** Subscribe to metric events pushed to the SSE stream. Returns unsubscribe fn. */
  subscribeSSE(cb) {
    this.sseSubscribers.push(cb);
    return () => {
      const idx = this.sseSubscribers.indexOf(cb);
      if (idx !== -1) this.sseSubscribers.splice(idx, 1);
    };
  }
  /** Broadcast an event to all current SSE subscribers. */
  broadcastSSE(event) {
    for (const sub of this.sseSubscribers) {
      try {
        sub(event);
      } catch {
      }
    }
  }
  /** Task 13.3 — record a UI panel open or button click for analytics. */
  recordUIAction(panel, action) {
    const key = `${panel}:${action}`;
    this.uiActionCounters.set(key, (this.uiActionCounters.get(key) ?? 0) + 1);
  }
  /** Returns a snapshot of all UI action counters. */
  getUIActionCounters() {
    return Object.fromEntries(this.uiActionCounters.entries());
  }
  // ── Action metrics (task 6.1) ────────────────────────────────────────────
  recordAction(metric) {
    this.actionMetrics.push(metric);
    this.broadcastSSE({ type: "forge_action", ...metric });
  }
  /** Returns a snapshot of all recorded action metrics */
  getActionMetrics() {
    return this.actionMetrics;
  }
  /** Error rate for a given action (0–1) */
  errorRate(action) {
    const relevant = this.actionMetrics.filter((m) => m.action === action);
    if (relevant.length === 0) return 0;
    const errors = relevant.filter((m) => m.status === "error").length;
    return errors / relevant.length;
  }
  /** P50 latency for a given action in milliseconds */
  p50LatencyMs(action) {
    const latencies = this.actionMetrics.filter((m) => m.action === action).map((m) => m.latency_ms).sort((a, b) => a - b);
    if (latencies.length === 0) return 0;
    return latencies[Math.floor(latencies.length / 2)];
  }
  // ── Deep-link click-through (task 6.2) ───────────────────────────────────
  recordDeepLinkClick(event) {
    this.deepLinkEvents.push(event);
  }
  getDeepLinkEvents() {
    return this.deepLinkEvents;
  }
  /**
   * Click-through rate: fraction of forge_summary runs that resulted in a
   * deep_link click.  Computed over the last `windowCount` summary events.
   */
  deepLinkClickThroughRate(windowCount = 100) {
    const summaryClicks = this.deepLinkEvents.filter((e) => e.source === "forge_summary").slice(-windowCount);
    const summaryRuns = this.actionMetrics.filter((m) => m.action === "analyse_ticket").slice(-windowCount);
    if (summaryRuns.length === 0) return 0;
    return summaryClicks.length / summaryRuns.length;
  }
  reset() {
    this.actionMetrics.length = 0;
    this.deepLinkEvents.length = 0;
    this.llmCallEvents.length = 0;
    this.ragRetrievalEvents.length = 0;
    this.sseSubscribers.length = 0;
    this.uiActionCounters.clear();
  }
  // ── LLM call events (Task 8.1) ───────────────────────────────────────────
  recordLLMCall(event) {
    this.llmCallEvents.push(event);
    this.broadcastSSE({ type: "llm_call", ...event });
  }
  getLLMCallEvents() {
    return this.llmCallEvents;
  }
  /** Total LLM calls recorded */
  get llmCallsTotal() {
    return this.llmCallEvents.length;
  }
  /** Total degraded LLM calls (no actual API call made) */
  get llmDegradedTotal() {
    return this.llmCallEvents.filter((e) => e.degraded).length;
  }
  // ── RAG retrieval events (Task 8.2) ──────────────────────────────────────
  recordRAGRetrieval(event) {
    this.ragRetrievalEvents.push(event);
    this.broadcastSSE({ type: "rag_retrieval", ...event });
  }
  getRAGRetrievalEvents() {
    return this.ragRetrievalEvents;
  }
  /** P95 latency for RAG retrieval in milliseconds */
  ragRetrievalLatencyP95() {
    const latencies = this.ragRetrievalEvents.map((e) => e.latency_ms).sort((a, b) => a - b);
    if (latencies.length === 0) return 0;
    const idx = Math.ceil(latencies.length * 0.95) - 1;
    return latencies[Math.max(0, idx)];
  }
};
var forgeInstrumentation = new ForgeInstrumentation();

// src/services/velocity-tracker.ts
var DEFAULT_LOOKBACK = 6;
var VelocityTracker = class {
  constructor(jira, doneStatuses) {
    this.jira = jira;
    this.doneStatuses = doneStatuses;
  }
  jira;
  doneStatuses;
  async getVelocity(boardId, lookback = DEFAULT_LOOKBACK) {
    const { sprints } = await this.jira.listSprints(boardId, {
      state: "closed",
      maxResults: lookback
    });
    if (sprints.length === 0) return [];
    const points = [];
    for (const sprint of sprints) {
      try {
        const { issues } = await this.jira.getSprintIssues(sprint.id, { maxResults: 200 });
        let committed = 0;
        let completed = 0;
        for (const issue of issues) {
          const fields = issue.fields;
          const sp = this._resolvePoints(fields);
          committed += sp;
          const status = String(fields.status?.name ?? "");
          if (this.doneStatuses.some((d) => d.toLowerCase() === status.toLowerCase())) {
            completed += sp;
          }
        }
        points.push({
          sprint_id: String(sprint.id),
          sprint_name: sprint.name,
          committed,
          completed
        });
      } catch (err) {
        logger.warn("velocity_tracker_sprint_error", {
          board_id: boardId,
          sprint_id: sprint.id,
          error: String(err)
        });
      }
    }
    return points.reverse();
  }
  _resolvePoints(fields) {
    for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
      const v = fields[key];
      if (typeof v === "number" && !isNaN(v)) return v;
    }
    const est = fields["original_estimate"] ?? fields["timeoriginalestimate"];
    if (typeof est === "number" && est > 0) return Math.round(est / 3600 / 8);
    return 0;
  }
};

// src/services/blocker-detector.ts
var BlockerDetector = class {
  constructor(doneStatuses) {
    this.doneStatuses = doneStatuses;
  }
  doneStatuses;
  detect(issues, sprint) {
    const start = new Date(sprint.startDate).getTime();
    const end = new Date(sprint.endDate).getTime();
    const midpoint = (start + end) / 2;
    const now = Date.now();
    if (now <= midpoint) return [];
    const blockers = [];
    for (const issue of issues) {
      const fields = issue.fields;
      const status = fields.status?.name ?? "";
      if (this._isDone(status)) continue;
      const links = fields.issuelinks ?? [];
      const blockerKeys = [];
      for (const link of links) {
        const inward = link.type?.inward?.toLowerCase() ?? "";
        if (inward.includes("is blocked by") || inward.includes("blocked by")) {
          const blockingStatus = link.inwardIssue?.fields?.status?.name ?? "";
          if (!this._isDone(blockingStatus)) {
            const key = link.inwardIssue?.key;
            if (key) blockerKeys.push(key);
          }
        }
      }
      if (blockerKeys.length === 0) continue;
      const created = fields.created ? new Date(fields.created).getTime() : start;
      const ageDays = Math.max(0, Math.floor((now - created) / 864e5));
      blockers.push({
        key: issue.key,
        summary: fields.summary ?? "",
        blocker_keys: blockerKeys,
        age_days: ageDays
      });
    }
    return blockers.sort((a, b) => b.age_days - a.age_days);
  }
  _isDone(status) {
    return this.doneStatuses.some((d) => d.toLowerCase() === status.toLowerCase());
  }
};

// src/services/scope-creep-detector.ts
var ScopeCreepDetector = class {
  detect(issues, sprintStartDate) {
    const start = new Date(sprintStartDate).getTime();
    const additions = [];
    let delta = 0;
    for (const issue of issues) {
      const fields = issue.fields;
      const createdRaw = fields.created;
      if (!createdRaw || typeof createdRaw !== "string") continue;
      const created = new Date(createdRaw).getTime();
      if (isNaN(created)) continue;
      if (created <= start) continue;
      const points = this._resolvePoints(fields);
      delta += points;
      additions.push({
        key: issue.key,
        summary: String(fields.summary ?? ""),
        added_at: createdRaw,
        points
      });
    }
    return { additions, delta };
  }
  _resolvePoints(fields) {
    for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
      const v = fields[key];
      if (typeof v === "number" && !isNaN(v)) return v;
    }
    const est = fields["original_estimate"] ?? fields["timeoriginalestimate"];
    if (typeof est === "number" && est > 0) return Math.round(est / 3600 / 8);
    return 0;
  }
};

// src/services/sprint-monitor.ts
var SprintMonitor = class {
  constructor(jira, cfg) {
    this.jira = jira;
    this.cfg = cfg;
    this.velocity = new VelocityTracker(jira, cfg.doneStatuses);
    this.blockerDetector = new BlockerDetector(cfg.doneStatuses);
    this.scopeDetector = new ScopeCreepDetector();
  }
  jira;
  cfg;
  cache = /* @__PURE__ */ new Map();
  timer = null;
  velocity;
  blockerDetector;
  scopeDetector;
  // ── Lifecycle ──────────────────────────────────────────────────────────
  start() {
    if (this.timer) return;
    void this._pollAll();
    this.timer = setInterval(() => void this._pollAll(), this.cfg.pollIntervalMs);
    logger.info("sprint_monitor_started", {
      board_ids: this.cfg.boardIds,
      interval_ms: this.cfg.pollIntervalMs
    });
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  // ── Public accessors ───────────────────────────────────────────────────
  getSnapshot(boardId) {
    return this.cache.get(boardId);
  }
  getAllSnapshots() {
    return Array.from(this.cache.values());
  }
  // ── Poll cycle ─────────────────────────────────────────────────────────
  async _pollAll() {
    for (const boardId of this.cfg.boardIds) {
      await this._pollBoard(boardId);
    }
  }
  async _pollBoard(boardId) {
    try {
      const numericId = Number(boardId);
      const { sprints } = await this.jira.listSprints(numericId, { state: "active", maxResults: 1 });
      if (sprints.length === 0) {
        logger.info("sprint_monitor_no_active_sprint", { board_id: boardId });
        return;
      }
      const sprint = sprints[0];
      const { issues } = await this.jira.getSprintIssues(sprint.id, { maxResults: 200 });
      let committed = 0;
      let completed = 0;
      let pointsEstimatedFromTime = false;
      for (const issue of issues) {
        const fields = issue.fields;
        const { points, fromTime } = this._resolvePoints(fields);
        if (fromTime) pointsEstimatedFromTime = true;
        committed += points;
        const status = String(fields.status?.name ?? "");
        if (this.cfg.doneStatuses.some((d) => d.toLowerCase() === status.toLowerCase())) {
          completed += points;
        }
      }
      const velocityTrend = await this.velocity.getVelocity(numericId);
      const sprintWindow = {
        startDate: sprint.startDate ?? (/* @__PURE__ */ new Date()).toISOString(),
        endDate: sprint.endDate ?? new Date(Date.now() + 14 * 864e5).toISOString()
      };
      const blockers = this.blockerDetector.detect(
        issues.map((i) => ({ key: i.key, fields: i.fields })),
        sprintWindow
      );
      const { additions: scopeAdditions, delta: scopeCreepDelta } = this.scopeDetector.detect(
        issues.map((i) => ({ key: i.key, fields: i.fields })),
        sprintWindow.startDate
      );
      const now = Date.now();
      const endMs = new Date(sprintWindow.endDate).getTime();
      const daysRemaining = Math.max(0, Math.ceil((endMs - now) / 864e5));
      const completedRatio = committed > 0 ? completed / committed : 1;
      const rawScore = 100 - blockers.length * 10 - scopeCreepDelta * 2 - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0);
      const healthScore = Math.max(0, Math.min(100, rawScore));
      const healthLabel = healthScore >= 75 ? "on-track" : healthScore >= 40 ? "at-risk" : "off-track";
      const snapshot = {
        board_id: boardId,
        sprint_id: String(sprint.id),
        sprint_name: sprint.name,
        fetched_at: (/* @__PURE__ */ new Date()).toISOString(),
        start_date: sprintWindow.startDate,
        end_date: sprintWindow.endDate,
        days_remaining: daysRemaining,
        committed_points: committed,
        completed_points: completed,
        points_estimated_from_time: pointsEstimatedFromTime,
        velocity_trend: velocityTrend,
        blockers,
        scope_additions: scopeAdditions,
        scope_creep_delta: scopeCreepDelta,
        health_score: healthScore,
        health_label: healthLabel,
        stale: false,
        warnings: []
      };
      this.cache.set(boardId, snapshot);
      AgentEventBus.emit({
        event: "finding",
        agent: "sprint-monitor",
        run_id: `sprint:${boardId}`,
        ts: snapshot.fetched_at,
        severity: healthLabel === "off-track" ? "critical" : healthLabel === "at-risk" ? "warn" : "info",
        message: `sprint:snapshot-updated:${boardId}`,
        finding_id: `sprint-snapshot-${boardId}-${snapshot.sprint_id}`,
        // Attach snapshot as extra payload (consumers can cast)
        ...{ snapshot }
      });
      logger.info("sprint_monitor_snapshot_updated", {
        board_id: boardId,
        sprint_id: sprint.id,
        health_score: healthScore,
        health_label: healthLabel
      });
    } catch (err) {
      logger.error("sprint_monitor_poll_error", { board_id: boardId, error: String(err) });
      const prev = this.cache.get(boardId);
      if (prev) {
        this.cache.set(boardId, {
          ...prev,
          stale: true,
          stale_since: (/* @__PURE__ */ new Date()).toISOString(),
          warnings: [...prev.warnings ?? [], `Poll failed: ${String(err)}`]
        });
      }
    }
  }
  // ── Helpers ────────────────────────────────────────────────────────────
  _resolvePoints(fields) {
    for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
      const v = fields[key];
      if (typeof v === "number" && !isNaN(v)) return { points: v, fromTime: false };
    }
    const est = fields["original_estimate"] ?? fields["timeoriginalestimate"];
    if (typeof est === "number" && est > 0) {
      return { points: Math.round(est / 3600 / 8), fromTime: true };
    }
    return { points: 0, fromTime: false };
  }
};

// src/server/routes/sprint.ts
import { Hono } from "hono";
var HEARTBEAT_INTERVAL_MS = 3e4;
function createSprintRouter(monitor) {
  const router = new Hono();
  router.get("/:boardId/snapshot", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (snap === void 0) {
      return c.json({ ok: true, data: null }, 200);
    }
    return c.json({ ok: true, data: snap }, 200);
  });
  router.get("/:boardId/velocity", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (!snap) {
      return c.json({ ok: true, data: [] }, 200);
    }
    return c.json({ ok: true, data: snap.velocity_trend }, 200);
  });
  router.get("/:boardId/blockers", (c) => {
    const boardId = c.req.param("boardId");
    if (!boardId) {
      return c.json({ ok: false, error: { code: "MISSING_BOARD_ID", message: "boardId is required" } }, 400);
    }
    const snap = monitor.getSnapshot(boardId);
    if (!snap) {
      return c.json({ ok: true, data: [] }, 200);
    }
    return c.json({ ok: true, data: snap.blockers }, 200);
  });
  router.get("/stream", (c) => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    function send(eventName, data) {
      const payload = `event: ${eventName}
data: ${JSON.stringify(data)}

`;
      writer.write(encoder.encode(payload)).catch(() => cleanup());
    }
    for (const snap of monitor.getAllSnapshots()) {
      send("sprint:snapshot-updated", snap);
    }
    const unsub = AgentEventBus.subscribe((evt) => {
      if (evt.event === "finding" && evt.agent === "sprint-monitor" && typeof evt.message === "string" && evt.message.startsWith("sprint:snapshot-updated:")) {
        const boardId = evt.message.replace("sprint:snapshot-updated:", "");
        const snap = monitor.getSnapshot(boardId);
        if (snap) send("sprint:snapshot-updated", snap);
      }
    });
    const heartbeat = setInterval(() => {
      send("sprint:heartbeat", { ts: (/* @__PURE__ */ new Date()).toISOString() });
    }, HEARTBEAT_INTERVAL_MS);
    function cleanup() {
      unsub();
      clearInterval(heartbeat);
      writer.close().catch(() => {
      });
      logger.info("sprint_sse_client_disconnected", {});
    }
    c.req.raw.signal?.addEventListener("abort", cleanup, { once: true });
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  });
  return router;
}

// src/services/epic-aggregator.ts
function deriveHealthLabel(score) {
  if (score >= 70) return "healthy";
  if (score >= 40) return "at-risk";
  return "blocked";
}
var EpicAggregator = class {
  constructor(deps) {
    this.deps = deps;
  }
  deps;
  async aggregate(boardId, projectKey) {
    const warnings = [];
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let rawEpics;
    try {
      const result = await this.deps.jira.getEpicsForBoard(boardId);
      rawEpics = result.epics;
    } catch (err) {
      logger.error("epic_aggregator_fetch_failed", { board_id: boardId, error: String(err) });
      warnings.push("no_epics_found");
      return { project_key: projectKey, generated_at: now, milestones: [], epics: [], warnings };
    }
    if (rawEpics.length === 0) {
      warnings.push("no_epics_found");
      return { project_key: projectKey, generated_at: now, milestones: [], epics: [], warnings };
    }
    const milestoneMap = /* @__PURE__ */ new Map();
    const epics = [];
    for (const raw of rawEpics) {
      let children = [];
      try {
        children = await this.deps.loadChildTickets(raw.key);
      } catch (err) {
        logger.warn("epic_aggregator_children_failed", { epic_key: raw.key, error: String(err) });
        warnings.push(`children_load_failed:${raw.key}`);
      }
      let healthScore = 50;
      if (children.length > 0) {
        const mean = children.reduce((s, c) => s + (c.readiness_score ?? 0), 0) / children.length;
        healthScore = Math.round(mean * 100);
      } else {
        warnings.push(`no_child_tickets:${raw.key}`);
      }
      const linkedSet = /* @__PURE__ */ new Set();
      for (const child of children) {
        for (const dep of child.dependencies ?? []) {
          if (dep.key && dep.key !== raw.key && /^[A-Z]+-\d+$/.test(dep.key)) {
            linkedSet.add(dep.key);
          }
        }
      }
      for (const child of children) {
        for (const version of child.fix_versions ?? []) {
          if (!milestoneMap.has(version)) {
            milestoneMap.set(version, {
              id: version,
              name: version,
              target_date: now.slice(0, 10),
              quarter: _quarterFromDate(now),
              project_key: projectKey,
              epic_keys: [],
              status: "planned"
            });
          }
          const ms = milestoneMap.get(version);
          if (!ms.epic_keys.includes(raw.key)) ms.epic_keys.push(raw.key);
        }
      }
      epics.push({
        key: raw.key,
        summary: raw.summary ?? raw.name,
        description: null,
        status: raw.done ? "Done" : "In Progress",
        project_key: projectKey,
        milestone_id: null,
        child_keys: children.map((c) => c.ticket_key),
        linked_epic_keys: Array.from(linkedSet),
        health_score: healthScore,
        health_label: deriveHealthLabel(healthScore),
        rice_score: null,
        ice_score: null,
        created_at: now,
        updated_at: now
      });
    }
    return {
      project_key: projectKey,
      generated_at: now,
      milestones: Array.from(milestoneMap.values()),
      epics,
      warnings
    };
  }
};
function _quarterFromDate(isoDate) {
  const d = new Date(isoDate);
  const q = Math.ceil((d.getMonth() + 1) / 3);
  return `Q${q}-${d.getFullYear()}`;
}

// src/services/prioritisation-engine.ts
var IMPACT_LABEL_MAP = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0.5
};
var PrioritisationEngine = class {
  constructor(llm) {
    this.llm = llm;
  }
  llm;
  async score(epic, overrides) {
    let rice = null;
    let ice = null;
    try {
      rice = await this._computeRICE(epic, overrides);
      ice = this._computeICE(rice);
    } catch (err) {
      logger.warn("prioritisation_engine_llm_failure", { epic_key: epic.key, error: String(err) });
    }
    return { ...epic, rice_score: rice, ice_score: ice };
  }
  async _computeRICE(epic, overrides) {
    let reach = overrides?.reach ?? 0;
    if (overrides?.reach === void 0) {
      try {
        const promptStr = `You are a product analyst. Estimate how many users this feature affects on a scale 0\u20131000.

Feature: ${epic.summary}
${epic.description ?? ""}

Respond as JSON: {"reach": <number>}`;
        const schema = { type: "object", properties: { reach: { type: "number" } }, required: ["reach"] };
        const { result } = await this.llm.complete(promptStr, schema);
        reach = Math.max(0, Math.min(1e3, result.reach ?? 0));
      } catch {
        reach = 100;
      }
    }
    const impact = overrides?.impact ?? (() => {
      for (const [label, value] of Object.entries(IMPACT_LABEL_MAP)) {
        if (epic.summary.toLowerCase().includes(label)) return value;
      }
      return 0.25;
    })();
    const confidence = overrides?.confidence ?? epic.health_score;
    const effort = overrides?.effort ?? Math.max(0.5, epic.child_keys.length * 0.5);
    const score = effort > 0 ? reach * impact * (confidence / 100) / effort : 0;
    return {
      reach,
      impact,
      confidence,
      effort,
      score: Math.round(score * 100) / 100,
      estimated_by: overrides && Object.keys(overrides).length > 0 ? "human" : "llm"
    };
  }
  _computeICE(rice) {
    const impact = Math.max(1, Math.min(10, Math.round(rice.impact / 3 * 10)));
    const confidence = Math.max(1, Math.min(10, Math.round(rice.confidence / 10)));
    const ease = Math.max(1, Math.min(10, Math.round(10 - Math.min(9, rice.effort))));
    return {
      impact,
      confidence,
      ease,
      score: impact * confidence * ease,
      estimated_by: rice.estimated_by
    };
  }
};

// src/services/dependency-graph.ts
var DependencyGraphBuilder = class {
  build(epics) {
    const epicMap = new Map(epics.map((e) => [e.key, e]));
    const edges = [];
    const warnings = [];
    for (const epic of epics) {
      for (const linkedKey of epic.linked_epic_keys) {
        const target = epicMap.get(linkedKey);
        edges.push({
          from_epic: epic.key,
          to_epic: linkedKey,
          type: "depends-on",
          cross_team: target ? target.project_key !== epic.project_key : false
        });
      }
    }
    const visited = /* @__PURE__ */ new Set();
    const stack = /* @__PURE__ */ new Set();
    const dfs = (key, path) => {
      if (stack.has(key)) {
        warnings.push(`cycle:${path.join("->")}\u2192${key}`);
        return;
      }
      if (visited.has(key)) return;
      visited.add(key);
      stack.add(key);
      const epic = epicMap.get(key);
      if (epic) {
        for (const dep of epic.linked_epic_keys) {
          dfs(dep, [...path, key]);
        }
      }
      stack.delete(key);
    };
    for (const epic of epics) {
      if (!visited.has(epic.key)) dfs(epic.key, []);
    }
    return { edges, warnings };
  }
};

// src/stores/roadmap-store.ts
var RoadmapStore = class {
  constructor(jira, llm, projectBoardMap, loadChildTickets) {
    this.jira = jira;
    this.llm = llm;
    this.projectBoardMap = projectBoardMap;
    this.loadChildTickets = loadChildTickets;
    this.aggregator = new EpicAggregator({
      jira,
      loadChildTickets
    });
    this.prioritiser = new PrioritisationEngine(llm);
  }
  jira;
  llm;
  projectBoardMap;
  loadChildTickets;
  cache = /* @__PURE__ */ new Map();
  aggregator;
  prioritiser;
  depGraph = new DependencyGraphBuilder();
  getSnapshot(projectKey) {
    return this.cache.get(projectKey);
  }
  getMilestones(projectKey) {
    return this.cache.get(projectKey)?.milestones ?? [];
  }
  async refresh(projectKey) {
    const boardId = this.projectBoardMap[projectKey];
    if (boardId === void 0) {
      const empty = {
        project_key: projectKey,
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        milestones: [],
        epics: [],
        dependency_graph: [],
        warnings: [`no_board_id_for_project:${projectKey}`]
      };
      this.cache.set(projectKey, empty);
      return empty;
    }
    const partial = await this.aggregator.aggregate(boardId, projectKey);
    const scoredEpics = [];
    for (const epic of partial.epics) {
      const scored = await this.prioritiser.score(epic);
      scoredEpics.push(scored);
    }
    const { edges, warnings: depWarnings } = this.depGraph.build(scoredEpics);
    const snapshot = {
      project_key: projectKey,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      milestones: partial.milestones,
      epics: scoredEpics,
      dependency_graph: edges,
      warnings: [...partial.warnings ?? [], ...depWarnings]
    };
    this.cache.set(projectKey, snapshot);
    logger.info("roadmap_store_refreshed", { project_key: projectKey, epic_count: scoredEpics.length });
    return snapshot;
  }
  async updateEpicRICE(epicKey, overrides) {
    for (const [projectKey, snapshot] of this.cache) {
      const epicIdx = snapshot.epics.findIndex((e) => e.key === epicKey);
      if (epicIdx === -1) continue;
      const epic = snapshot.epics[epicIdx];
      const updated = await this.prioritiser.score(epic, overrides);
      const updatedEpics = [...snapshot.epics];
      updatedEpics[epicIdx] = updated;
      this.cache.set(projectKey, { ...snapshot, epics: updatedEpics });
      logger.info("roadmap_store_rice_updated", { epic_key: epicKey });
      return updated;
    }
    return null;
  }
};

// src/server/routes/roadmap.ts
import { Hono as Hono2 } from "hono";
function createRoadmapRouter(store) {
  const router = new Hono2();
  const ok = (data) => ({ ok: true, data });
  const err = (code, message) => ({ ok: false, error: { code, message } });
  router.get("/:projectKey", (c) => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot found. Try POST \u2026/refresh"), 404);
    return c.json(ok(snap));
  });
  router.post("/:projectKey/refresh", async (c) => {
    const snap = await store.refresh(c.req.param("projectKey"));
    return c.json(ok(snap));
  });
  router.get("/:projectKey/epics", (c) => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.epics));
  });
  router.get("/:projectKey/epics/:epicKey", (c) => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    const epic = snap.epics.find((e) => e.key === c.req.param("epicKey"));
    if (!epic) return c.json(err("NOT_FOUND", "Epic not found"), 404);
    return c.json(ok(epic));
  });
  router.patch("/:projectKey/epics/:epicKey/rice", async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return c.json(err("BAD_REQUEST", "Invalid JSON body"), 400);
    }
    const updated = await store.updateEpicRICE(c.req.param("epicKey"), body);
    if (!updated) return c.json(err("NOT_FOUND", "Epic not found"), 404);
    return c.json(ok(updated));
  });
  router.get("/:projectKey/milestones", (c) => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.milestones));
  });
  router.get("/:projectKey/dependencies", (c) => {
    const snap = store.getSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.dependency_graph));
  });
  return router;
}

// src/stores/triage-queue.ts
import { randomUUID as randomUUID9 } from "crypto";
async function getLanceDB2() {
  return await import("@lancedb/lancedb");
}
var TriageQueue = class {
  constructor(storePath, jira) {
    this.storePath = storePath;
    this.jira = jira;
  }
  storePath;
  jira;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB2();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }
  // ── Documents ────────────────────────────────────────────────────────────
  async upsertDocuments(docs) {
    if (!docs.length) return;
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes("feedback_documents")) {
      await db.createTable("feedback_documents", docs);
    } else {
      const t = await db.openTable("feedback_documents");
      await t.add(docs);
    }
  }
  async getDocuments() {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes("feedback_documents")) return [];
      const t = await db.openTable("feedback_documents");
      return await t.query().toArray();
    } catch {
      return [];
    }
  }
  // ── Themes ───────────────────────────────────────────────────────────────
  async upsertThemes(themes) {
    if (!themes.length) return;
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes("feedback_themes")) {
      await db.createTable("feedback_themes", themes);
    } else {
      const t = await db.openTable("feedback_themes");
      await t.add(themes);
    }
  }
  async getThemes() {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes("feedback_themes")) return [];
      const t = await db.openTable("feedback_themes");
      return await t.query().toArray();
    } catch {
      return [];
    }
  }
  async getTheme(id) {
    const all = await this.getThemes();
    return all.find((t) => t.id === id) ?? null;
  }
  // ── Candidates ───────────────────────────────────────────────────────────
  async upsertCandidates(candidates) {
    if (!candidates.length) return;
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes("opportunity_candidates")) {
      await db.createTable("opportunity_candidates", candidates);
    } else {
      const t = await db.openTable("opportunity_candidates");
      await t.add(candidates);
    }
  }
  async getCandidates() {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes("opportunity_candidates")) return [];
      const t = await db.openTable("opportunity_candidates");
      return await t.query().toArray();
    } catch {
      return [];
    }
  }
  async getCandidate(id) {
    const all = await this.getCandidates();
    return all.find((c) => c.id === id) ?? null;
  }
  // ── Actions ──────────────────────────────────────────────────────────────
  async promote(id, opts) {
    const candidate = await this.getCandidate(id);
    if (!candidate) throw new Error(`Candidate ${id} not found`);
    if (candidate.status !== "pending") throw new Error(`Candidate ${id} is not pending`);
    const ticketKey = await this.jira.createStory(opts.project_key, {
      summary: opts.title,
      description: opts.description,
      labels: ["product-discovery"]
    });
    const updated = {
      ...candidate,
      status: "promoted",
      promoted_ticket_key: ticketKey,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await this.updateCandidate(updated);
    logger.info("discovery: candidate promoted", { id, ticketKey });
    return updated;
  }
  async dismiss(id, reason) {
    const candidate = await this.getCandidate(id);
    if (!candidate) throw new Error(`Candidate ${id} not found`);
    const updated = { ...candidate, status: "dismissed", dismiss_reason: reason, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    await this.updateCandidate(updated);
    return updated;
  }
  async updateCandidate(updated) {
    try {
      const db = await this.getDb();
      const t = await db.openTable("opportunity_candidates");
      await t.delete(`id = '${updated.id}'`);
      await t.add([updated]);
    } catch (err) {
      logger.error("TriageQueue: failed to update candidate", { err: String(err) });
    }
  }
  // ── Latest ingest cursor ─────────────────────────────────────────────────
  async getLatestDocumentDate() {
    const docs = await this.getDocuments();
    if (!docs.length) return null;
    return docs.reduce((latest, d) => d.created_at > latest ? d.created_at : latest, docs[0].created_at);
  }
  // ── Ingest from raw items ────────────────────────────────────────────────
  async ingestRaw(items) {
    const existing = new Set((await this.getDocuments()).map((d) => `${d.source}:${d.source_id}`));
    const docs = items.filter((i) => !existing.has(`${i.source}:${i.source_id}`)).map((i) => ({
      id: randomUUID9(),
      source: i.source,
      source_id: i.source_id,
      text: i.text,
      sentiment_score: 0,
      // scored by ThemeClusterer pipeline
      created_at: new Date(i.created_at).toISOString(),
      customer_segment: i.customer_segment,
      tags: i.tags,
      theme_id: null
    }));
    await this.upsertDocuments(docs);
    return docs;
  }
};

// src/services/theme-clusterer.ts
import { randomUUID as randomUUID10 } from "crypto";
var THEME_NAMING_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    representative_quotes: { type: "array", items: { type: "string" }, maxItems: 3 }
  },
  required: ["name", "representative_quotes"]
};
function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
function centroid(vecs) {
  const dim = vecs[0].length;
  const c = new Array(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i] / vecs.length;
  return c;
}
var ThemeClusterer = class {
  constructor(llm) {
    this.llm = llm;
  }
  llm;
  async cluster(docs, k = 8) {
    if (docs.length === 0) return [];
    const texts = docs.map((d) => d.text.slice(0, 512));
    let vectors;
    try {
      ({ vectors } = await this.llm.embed(texts));
    } catch {
      return [this.buildTheme(docs, "General Feedback", [], (/* @__PURE__ */ new Date()).toISOString())];
    }
    const n = docs.length;
    const actualK = Math.min(k, n);
    const seeds = [0];
    while (seeds.length < actualK) {
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        if (seeds.includes(i)) continue;
        const minSim = Math.min(...seeds.map((s) => cosineSim(vectors[i], vectors[s])));
        if (minSim > bestScore) {
          bestScore = minSim;
          best = i;
        }
      }
      seeds.push(best);
    }
    let centroids = seeds.map((s) => [...vectors[s]]);
    let assignments = new Array(n).fill(0);
    for (let iter = 0; iter < 20; iter++) {
      const newAssign = vectors.map((v) => {
        let best = 0, bestSim = -Infinity;
        for (let c = 0; c < actualK; c++) {
          const sim = cosineSim(v, centroids[c]);
          if (sim > bestSim) {
            bestSim = sim;
            best = c;
          }
        }
        return best;
      });
      if (newAssign.every((a, i) => a === assignments[i])) break;
      assignments = newAssign;
      centroids = Array.from({ length: actualK }, (_, c) => {
        const vecs = vectors.filter((_2, i) => assignments[i] === c);
        return vecs.length ? centroid(vecs) : centroids[c];
      });
    }
    const groups = /* @__PURE__ */ new Map();
    docs.forEach((d, i) => {
      const c = assignments[i];
      groups.set(c, [...groups.get(c) ?? [], d]);
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const themes = [];
    for (const [, clusterDocs] of groups) {
      const sample = clusterDocs.slice(0, 6).map((d) => d.text.slice(0, 300)).join("\n---\n");
      let name = "User Feedback";
      let representative_quotes = [];
      try {
        const prompt = `You are a product analyst. Given the following customer feedback snippets, return a short theme name (\u22646 words) and up to 3 representative verbatim quotes.

Feedback:
${sample}`;
        const { result } = await this.llm.complete(
          prompt,
          THEME_NAMING_SCHEMA
        );
        name = result.name;
        representative_quotes = result.representative_quotes;
      } catch {
      }
      themes.push(this.buildTheme(clusterDocs, name, representative_quotes, now));
    }
    return themes;
  }
  buildTheme(docs, name, quotes, now) {
    const avgSentiment = docs.reduce((s, d) => s + d.sentiment_score, 0) / (docs.length || 1);
    return {
      id: randomUUID10(),
      name,
      document_ids: docs.map((d) => d.id),
      frequency: docs.length,
      avg_sentiment: parseFloat(avgSentiment.toFixed(3)),
      representative_quotes: quotes,
      created_at: now,
      updated_at: now
    };
  }
};

// src/services/opportunity-sizer.ts
import { randomUUID as randomUUID11 } from "crypto";
var SIZING_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    problem_statement: { type: "string" },
    estimated_reach: { type: "number" },
    estimated_impact: { type: "number" }
  },
  required: ["title", "problem_statement", "estimated_reach", "estimated_impact"]
};
var OpportunitySizer = class {
  constructor(llm) {
    this.llm = llm;
  }
  llm;
  async size(theme) {
    const quoteSample = theme.representative_quotes.slice(0, 3).join(" | ");
    const prompt = `You are a product manager. Given a feedback theme, return:
- title: one-line opportunity title
- problem_statement: 2\u20133 sentence problem description
- estimated_reach: integer number of customers affected
- estimated_impact: float 0\u201310 business impact score

Theme: ${theme.name}
Frequency: ${theme.frequency} signals
Avg sentiment: ${theme.avg_sentiment}
Sample quotes: ${quoteSample}`;
    let title = theme.name;
    let problem_statement = `Customers are reporting issues related to: ${theme.name}`;
    let estimated_reach = theme.frequency;
    let estimated_impact = Math.min(10, theme.frequency * 0.5);
    try {
      const { result } = await this.llm.complete(prompt, SIZING_SCHEMA);
      title = result.title;
      problem_statement = result.problem_statement;
      estimated_reach = result.estimated_reach;
      estimated_impact = result.estimated_impact;
    } catch {
    }
    return {
      id: randomUUID11(),
      theme_id: theme.id,
      title,
      problem_statement,
      estimated_reach: Math.round(estimated_reach),
      estimated_impact: parseFloat(estimated_impact.toFixed(2)),
      status: "pending",
      promoted_ticket_key: null,
      dismiss_reason: null,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
};

// src/adapters/feedback/webhook.ts
var WebhookFeedbackAdapter = class {
  source = "webhook";
  buffer = [];
  /** Called by the POST /api/discovery/ingest route handler. */
  push(item) {
    this.buffer.push(item);
  }
  async fetchSince(since) {
    const cutoff = since ? new Date(since).getTime() : 0;
    const items = this.buffer.filter((i) => i.created_at > cutoff);
    return items;
  }
  /** Drain items older than a given time (called after successful ingestion). */
  drain(before) {
    const idx = this.buffer.findIndex((i) => i.created_at >= before);
    if (idx > 0) this.buffer.splice(0, idx);
  }
};

// src/server/routes/discovery.ts
import { Hono as Hono3 } from "hono";
function createDiscoveryRouter(queue, clusterer, sizer, adapters, webhookAdapter) {
  const router = new Hono3();
  const ok = (data) => ({ ok: true, data });
  const err = (code, message) => ({ ok: false, error: { code, message } });
  router.post("/sync", async (c) => {
    try {
      const since = await queue.getLatestDocumentDate();
      for (const adapter of adapters) {
        const raw = await adapter.fetchSince(since);
        await queue.ingestRaw(raw.map((r) => ({ ...r, source: adapter.source })));
      }
      const docs = await queue.getDocuments();
      if (docs.length > 0) {
        const themes = await clusterer.cluster(docs);
        await queue.upsertThemes(themes);
        const candidates = await Promise.all(themes.map((t) => sizer.size(t)));
        await queue.upsertCandidates(candidates);
      }
      return c.json(ok({ message: "sync complete", document_count: docs.length }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("SYNC_FAILED", msg), 500);
    }
  });
  router.post("/ingest", async (c) => {
    const body = await c.req.json();
    webhookAdapter.push({
      source_id: body.source_id,
      text: body.text,
      created_at: body.created_at ?? Date.now(),
      customer_segment: body.customer_segment ?? null,
      tags: body.tags ?? []
    });
    return c.json(ok({ queued: true }));
  });
  router.get("/documents", async (c) => {
    const docs = await queue.getDocuments();
    return c.json(ok(docs));
  });
  router.get("/themes", async (c) => {
    const themes = await queue.getThemes();
    return c.json(ok(themes));
  });
  router.get("/themes/:id", async (c) => {
    const theme = await queue.getTheme(c.req.param("id"));
    if (!theme) return c.json(err("NOT_FOUND", "Theme not found"), 404);
    return c.json(ok(theme));
  });
  router.get("/candidates", async (c) => {
    const candidates = await queue.getCandidates();
    return c.json(ok(candidates));
  });
  router.get("/candidates/:id", async (c) => {
    const candidate = await queue.getCandidate(c.req.param("id"));
    if (!candidate) return c.json(err("NOT_FOUND", "Candidate not found"), 404);
    return c.json(ok(candidate));
  });
  router.post("/candidates/:id/promote", async (c) => {
    const body = await c.req.json();
    try {
      const updated = await queue.promote(c.req.param("id"), body);
      return c.json(ok(updated));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("PROMOTE_FAILED", msg), 400);
    }
  });
  router.post("/candidates/:id/dismiss", async (c) => {
    const body = await c.req.json();
    try {
      const updated = await queue.dismiss(c.req.param("id"), body.reason ?? "");
      return c.json(ok(updated));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("DISMISS_FAILED", msg), 400);
    }
  });
  return router;
}

// src/stores/okr-store.ts
import { randomUUID as randomUUID12 } from "crypto";
async function getLanceDB3() {
  return await import("@lancedb/lancedb");
}
var OKRStore = class {
  constructor(storePath) {
    this.storePath = storePath;
  }
  storePath;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB3();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }
  // ── Generic helpers ───────────────────────────────────────────────────────
  async all(table) {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes(table)) return [];
      const t = await db.openTable(table);
      return await t.query().toArray();
    } catch {
      return [];
    }
  }
  async insert(table, rows) {
    if (!rows.length) return;
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes(table)) {
      await db.createTable(table, rows);
    } else {
      const t = await db.openTable(table);
      await t.add(rows);
    }
  }
  async remove(table, where) {
    try {
      const db = await this.getDb();
      const t = await db.openTable(table);
      await t.delete(where);
    } catch (err) {
      logger.error(`OKRStore: delete failed on ${table}`, { err: String(err) });
    }
  }
  // ── OKRs ─────────────────────────────────────────────────────────────────
  async listOKRs(projectKey) {
    const all = await this.all("okrs");
    return all.filter((o) => o.project_key === projectKey);
  }
  async getOKR(id) {
    const all = await this.all("okrs");
    return all.find((o) => o.id === id) ?? null;
  }
  async createOKR(input) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const okr = { id: randomUUID12(), created_at: now, ...input };
    await this.insert("okrs", [okr]);
    return okr;
  }
  async linkEpicToOKR(okrId, epicKey) {
    const okr = await this.getOKR(okrId);
    if (!okr) throw new Error(`OKR ${okrId} not found`);
    if (okr.epic_keys.includes(epicKey)) return okr;
    const updated = { ...okr, epic_keys: [...okr.epic_keys, epicKey] };
    await this.remove("okrs", `id = '${okrId}'`);
    await this.insert("okrs", [updated]);
    return updated;
  }
  async updateKeyResult(okrId, krId, current) {
    const okr = await this.getOKR(okrId);
    if (!okr) throw new Error(`OKR ${okrId} not found`);
    const updated = {
      ...okr,
      key_results: okr.key_results.map(
        (kr) => kr.id === krId ? { ...kr, current, updated_at: (/* @__PURE__ */ new Date()).toISOString() } : kr
      )
    };
    await this.remove("okrs", `id = '${okrId}'`);
    await this.insert("okrs", [updated]);
    return updated;
  }
  // ── Metric Events ─────────────────────────────────────────────────────────
  async appendMetricEvent(event) {
    const full = { id: randomUUID12(), ...event };
    await this.insert("metric_events", [full]);
    return full;
  }
  async getMetricEvents(okrId) {
    const all = await this.all("metric_events");
    return all.filter((e) => e.okr_id === okrId);
  }
  // ── Snapshots ─────────────────────────────────────────────────────────────
  async latestSnapshot(projectKey) {
    const all = await this.all("outcome_snapshots");
    const filtered = all.filter((s) => s.project_key === projectKey);
    if (!filtered.length) return null;
    return filtered.reduce((latest, s) => s.generated_at > latest.generated_at ? s : latest);
  }
  async saveSnapshot(snapshot) {
    await this.insert("outcome_snapshots", [snapshot]);
  }
  async patchSnapshotNotes(id, notes) {
    const all = await this.all("outcome_snapshots");
    const snap = all.find((s) => s.id === id);
    if (!snap) return null;
    const updated = { ...snap, notes };
    await this.remove("outcome_snapshots", `id = '${id}'`);
    await this.insert("outcome_snapshots", [updated]);
    return updated;
  }
  // ── Key result helper ─────────────────────────────────────────────────────
  newKeyResult(input) {
    return { id: randomUUID12(), updated_at: (/* @__PURE__ */ new Date()).toISOString(), ...input };
  }
};

// src/services/reflection-agent.ts
var REFLECTION_SCHEMA = {
  type: "object",
  properties: {
    markdown: { type: "string" }
  },
  required: ["markdown"]
};
var ReflectionAgent = class {
  constructor(llm) {
    this.llm = llm;
  }
  llm;
  async reflect(projectKey, okrs, deltas) {
    const deltaLines = deltas.map((d) => `- ${d.description}: ${d.previous} \u2192 ${d.current} / ${d.target} (\u0394${d.delta_pct > 0 ? "+" : ""}${d.delta_pct}%)`).join("\n");
    const objectiveLines = okrs.map((o) => `- ${o.objective}`).join("\n");
    const prompt = `You are a product outcomes coach. Write a brief (\u22643 paragraphs) Markdown retrospective commentary for project "${projectKey}" based on the following OKR progress.

Objectives:
${objectiveLines}

Key Result deltas:
${deltaLines || "No deltas yet."}

Be specific, highlight wins and risks, and suggest one action.`;
    const { result } = await this.llm.complete(prompt, REFLECTION_SCHEMA);
    return result.markdown;
  }
};

// src/services/outcome-snapshot-builder.ts
import { randomUUID as randomUUID13 } from "crypto";
var OutcomeSnapshotBuilder = class {
  constructor(store, metricsAdapters, reflectionAgent) {
    this.store = store;
    this.metricsAdapters = metricsAdapters;
    this.reflectionAgent = reflectionAgent;
  }
  store;
  metricsAdapters;
  reflectionAgent;
  async build(projectKey) {
    const okrs = await this.store.listOKRs(projectKey);
    const latestSnap = await this.store.latestSnapshot(projectKey);
    const since = latestSnap?.generated_at ?? null;
    for (const adapter of this.metricsAdapters) {
      const events = await adapter.fetchSince(since).catch(() => []);
      for (const e of events) {
        const targetOkr = e.okr_id ? okrs.find((o) => o.id === e.okr_id) : okrs[0];
        if (!targetOkr) continue;
        await this.store.appendMetricEvent({
          okr_id: targetOkr.id,
          kr_id: e.kr_id ?? null,
          source: e.source,
          metric_name: e.metric_name,
          value: e.value,
          occurred_at: new Date(e.occurred_at).toISOString()
        });
        if (e.kr_id) {
          await this.store.updateKeyResult(targetOkr.id, e.kr_id, e.value).catch(() => {
          });
        }
      }
    }
    const freshOkrs = await this.store.listOKRs(projectKey);
    const prevOkrs = okrs;
    const okrDeltas = [];
    for (const okr of freshOkrs) {
      const prev = prevOkrs.find((o) => o.id === okr.id);
      for (const kr of okr.key_results) {
        const prevKr = prev?.key_results.find((k) => k.id === kr.id);
        const previous = prevKr?.current ?? 0;
        const current = kr.current;
        const target = kr.target;
        const deltaPct = target !== 0 ? (current - previous) / target * 100 : 0;
        okrDeltas.push({ kr_id: kr.id, description: kr.description, previous, current, target, delta_pct: parseFloat(deltaPct.toFixed(1)) });
      }
    }
    const flagMap = /* @__PURE__ */ new Map();
    for (const okr of freshOkrs) {
      const events = await this.store.getMetricEvents(okr.id);
      for (const e of events) {
        if (!e.metric_name.startsWith("flag_adoption.")) continue;
        const flagKey = e.metric_name.replace("flag_adoption.", "");
        const series = flagMap.get(flagKey) ?? [];
        series.push({ date: e.occurred_at.slice(0, 10), pct: e.value });
        flagMap.set(flagKey, series);
      }
    }
    const flagAdoptions = Array.from(flagMap.entries()).map(([flag_key, series]) => ({
      flag_key,
      series: series.sort((a, b) => a.date.localeCompare(b.date))
    }));
    let reflection = null;
    try {
      reflection = await this.reflectionAgent.reflect(projectKey, freshOkrs, okrDeltas);
    } catch {
    }
    const snapshot = {
      id: randomUUID13(),
      project_key: projectKey,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      okr_deltas: okrDeltas,
      flag_adoptions: flagAdoptions,
      reflection,
      notes: null
    };
    await this.store.saveSnapshot(snapshot);
    return snapshot;
  }
};

// src/adapters/metrics/webhook.ts
var WebhookMetricsAdapter = class {
  source = "webhook";
  buffer = [];
  push(event) {
    this.buffer.push(event);
  }
  async fetchSince(since) {
    const cutoff = since ? new Date(since).getTime() : 0;
    return this.buffer.filter((e) => e.occurred_at > cutoff);
  }
  drain(before) {
    const idx = this.buffer.findIndex((e) => e.occurred_at >= before);
    if (idx > 0) this.buffer.splice(0, idx);
  }
};

// src/server/routes/outcomes.ts
import { Hono as Hono4 } from "hono";
function createOutcomesRouter(store, builder, webhookMetrics) {
  const router = new Hono4();
  const ok = (data) => ({ ok: true, data });
  const err = (code, message) => ({ ok: false, error: { code, message } });
  router.get("/:projectKey/okrs", async (c) => {
    const okrs = await store.listOKRs(c.req.param("projectKey"));
    return c.json(ok(okrs));
  });
  router.post("/:projectKey/okrs", async (c) => {
    const body = await c.req.json();
    const projectKey = c.req.param("projectKey");
    const { randomUUID: randomUUID18 } = await import("crypto");
    const okr = await store.createOKR({
      project_key: projectKey,
      objective: body.objective,
      key_results: body.key_results.map((kr) => ({
        id: randomUUID18(),
        okr_id: "",
        description: kr.description,
        target: kr.target,
        current: 0,
        unit: kr.unit,
        direction: kr.direction ?? "up",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      })),
      epic_keys: [],
      start_date: body.start_date,
      end_date: body.end_date
    });
    return c.json(ok(okr), 201);
  });
  router.get("/:projectKey/okrs/:id", async (c) => {
    const okr = await store.getOKR(c.req.param("id"));
    if (!okr) return c.json(err("NOT_FOUND", "OKR not found"), 404);
    return c.json(ok(okr));
  });
  router.post("/:projectKey/okrs/:id/link-epic", async (c) => {
    const { epic_key } = await c.req.json();
    try {
      const updated = await store.linkEpicToOKR(c.req.param("id"), epic_key);
      return c.json(ok(updated));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("LINK_FAILED", msg), 400);
    }
  });
  router.get("/:projectKey/snapshot", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("projectKey"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot yet. Try POST \u2026/snapshot/refresh"), 404);
    return c.json(ok(snap));
  });
  router.post("/:projectKey/snapshot/refresh", async (c) => {
    try {
      const snap = await builder.build(c.req.param("projectKey"));
      return c.json(ok(snap));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return c.json(err("BUILD_FAILED", msg), 500);
    }
  });
  router.patch("/:projectKey/snapshot/:id/notes", async (c) => {
    const { notes } = await c.req.json();
    const updated = await store.patchSnapshotNotes(c.req.param("id"), notes);
    if (!updated) return c.json(err("NOT_FOUND", "Snapshot not found"), 404);
    return c.json(ok(updated));
  });
  router.post("/metrics/ingest", async (c) => {
    const body = await c.req.json();
    webhookMetrics.push({
      source: "webhook",
      metric_name: body.metric_name,
      value: body.value,
      occurred_at: body.occurred_at ?? Date.now(),
      flag_key: body.flag_key,
      okr_id: body.okr_id,
      kr_id: body.kr_id
    });
    return c.json(ok({ queued: true }), 202);
  });
  return router;
}

// src/stores/portfolio-store.ts
import { randomUUID as randomUUID14 } from "crypto";
async function getLanceDB4() {
  return await import("@lancedb/lancedb");
}
var PortfolioStore = class {
  constructor(storePath) {
    this.storePath = storePath;
  }
  storePath;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB4();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }
  async all(table) {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes(table)) return [];
      const t = await db.openTable(table);
      return await t.query().toArray();
    } catch {
      return [];
    }
  }
  async insert(table, rows) {
    if (!rows.length) return;
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes(table)) {
      await db.createTable(table, rows);
    } else {
      const t = await db.openTable(table);
      await t.add(rows);
    }
  }
  async remove(table, where) {
    try {
      const db = await this.getDb();
      const t = await db.openTable(table);
      await t.delete(where);
    } catch (e) {
      logger.error(`PortfolioStore.remove failed on ${table}`, { err: String(e) });
    }
  }
  // ── Portfolios ────────────────────────────────────────────────────────────
  async listPortfolios() {
    return this.all("portfolios");
  }
  async getPortfolio(id) {
    const all = await this.all("portfolios");
    return all.find((p) => p.id === id) ?? null;
  }
  async createPortfolio(input) {
    const portfolio = { id: randomUUID14(), created_at: (/* @__PURE__ */ new Date()).toISOString(), ...input };
    await this.insert("portfolios", [portfolio]);
    return portfolio;
  }
  async addProjectToPortfolio(portfolioId, projectKey) {
    const p = await this.getPortfolio(portfolioId);
    if (!p) throw new Error(`Portfolio ${portfolioId} not found`);
    if (p.project_keys.includes(projectKey)) return p;
    const updated = { ...p, project_keys: [...p.project_keys, projectKey] };
    await this.remove("portfolios", `id = '${portfolioId}'`);
    await this.insert("portfolios", [updated]);
    return updated;
  }
  // ── Snapshots ─────────────────────────────────────────────────────────────
  async latestSnapshot(portfolioId) {
    const all = await this.all("portfolio_snapshots");
    const filtered = all.filter((s) => s.portfolio_id === portfolioId);
    if (!filtered.length) return null;
    return filtered.reduce((a, b) => a.generated_at > b.generated_at ? a : b);
  }
  async saveSnapshot(snapshot) {
    await this.insert("portfolio_snapshots", [snapshot]);
  }
};

// src/services/cross-project-deps.ts
var CrossProjectDependencyGraph = class {
  constructor(roadmapStore) {
    this.roadmapStore = roadmapStore;
  }
  roadmapStore;
  build(projectKeys) {
    const edges = [];
    for (const key of projectKeys) {
      const snap = this.roadmapStore.getSnapshot(key);
      if (!snap) continue;
      for (const dep of snap.dependency_graph) {
        const fromProject = key;
        const toProject = this.findProjectForEpic(dep.to_epic, projectKeys);
        if (!toProject || toProject === fromProject) continue;
        edges.push({
          from_project: fromProject,
          to_project: toProject,
          type: dep.type,
          epic_from: dep.from_epic,
          epic_to: dep.to_epic,
          cross_team: dep.cross_team
        });
      }
    }
    return edges;
  }
  findProjectForEpic(epicKey, projectKeys) {
    for (const key of projectKeys) {
      const snap = this.roadmapStore.getSnapshot(key);
      if (!snap) continue;
      if (snap.epics.some((e) => e.key === epicKey)) return key;
    }
    return null;
  }
};

// src/services/capacity-heatmap.ts
function isoWeek(dateStr) {
  const d = new Date(dateStr);
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7);
  const diff = d.getTime() - startOfWeek1.getTime();
  const week = Math.ceil((diff / 864e5 + 1) / 7);
  return `${d.getFullYear()}-${String(week).padStart(2, "0")}`;
}
var CapacityHeatmapBuilder = class {
  constructor(roadmapStore, sprintLengthDays = 14) {
    this.roadmapStore = roadmapStore;
    this.sprintLengthDays = sprintLengthDays;
  }
  roadmapStore;
  sprintLengthDays;
  build(projectKeys) {
    const rows = [];
    for (const projectKey of projectKeys) {
      const snap = this.roadmapStore.getSnapshot(projectKey);
      if (!snap) continue;
      for (const milestone of snap.milestones) {
        const week = isoWeek(milestone.target_date);
        const epicsInMilestone = snap.epics.filter((e) => e.milestone_id === milestone.id);
        const allocatedPoints = epicsInMilestone.reduce((s, e) => s + e.child_keys.length * 3, 0);
        const completedPoints = epicsInMilestone.filter((e) => e.health_label === "healthy").reduce((s, e) => s + e.child_keys.length * 3, 0);
        const utilisationPct = allocatedPoints > 0 ? Math.min(100, Math.round(completedPoints / allocatedPoints * 100)) : 0;
        rows.push({
          team: projectKey,
          project_key: projectKey,
          sprint_week: week,
          allocated_points: allocatedPoints,
          completed_points: completedPoints,
          utilisation_pct: utilisationPct
        });
      }
    }
    return rows;
  }
};

// src/services/portfolio-aggregator.ts
var PortfolioAggregator = class {
  constructor(portfolioStore, roadmapStore, depGraph, heatmap) {
    this.portfolioStore = portfolioStore;
    this.roadmapStore = roadmapStore;
    this.depGraph = depGraph;
    this.heatmap = heatmap;
  }
  portfolioStore;
  roadmapStore;
  depGraph;
  heatmap;
  async aggregate(portfolioId) {
    const portfolio = await this.portfolioStore.getPortfolio(portfolioId);
    if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);
    const projectKeys = portfolio.project_keys;
    const projects = projectKeys.map((key) => {
      const snap = this.roadmapStore.getSnapshot(key);
      if (!snap) {
        return { project_key: key, name: key, health_score: 0, completed_epics: 0, total_epics: 0, at_risk_epics: 0, velocity_pct: 0 };
      }
      const total = snap.epics.length;
      const healthy = snap.epics.filter((e) => e.health_label === "healthy").length;
      const atRisk = snap.epics.filter((e) => e.health_label === "at-risk").length;
      const blocked = snap.epics.filter((e) => e.health_label === "blocked").length;
      const score = total > 0 ? Math.round((healthy * 1 + atRisk * 0.5) / total * 100) : 0;
      const velocityPct = total > 0 ? Math.round(healthy / total * 100) : 0;
      return {
        project_key: key,
        name: key,
        health_score: score,
        completed_epics: healthy,
        total_epics: total,
        at_risk_epics: atRisk + blocked,
        velocity_pct: velocityPct
      };
    });
    const dependencies = this.depGraph.build(projectKeys);
    const capacity_rows = this.heatmap.build(projectKeys);
    const snapshot = {
      portfolio_id: portfolioId,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      projects,
      dependencies,
      capacity_rows,
      digest: null
    };
    await this.portfolioStore.saveSnapshot(snapshot);
    return snapshot;
  }
};

// src/services/portfolio-digest.ts
import { randomUUID as randomUUID15 } from "crypto";
var DIGEST_SCHEMA = {
  type: "object",
  properties: { markdown: { type: "string" } },
  required: ["markdown"]
};
var PortfolioDigestWriter = class {
  constructor(llm, cfg) {
    this.llm = llm;
    this.cfg = cfg;
  }
  llm;
  cfg;
  async generate(snapshot) {
    const projectLines = snapshot.projects.map((p) => `- **${p.project_key}**: health ${p.health_score}%, velocity ${p.velocity_pct}%, at-risk epics: ${p.at_risk_epics}`).join("\n");
    const depCount = snapshot.dependencies.length;
    const prompt = `You are a portfolio manager. Write a concise Markdown portfolio digest (\u22644 paragraphs) covering:
- Overall health
- Key risks
- Cross-team dependencies (count: ${depCount})
- Recommended actions

Projects:
${projectLines}`;
    let markdown = `# Portfolio Digest

Generated at ${snapshot.generated_at}

${projectLines}`;
    try {
      const { result } = await this.llm.complete(prompt, DIGEST_SCHEMA);
      markdown = result.markdown;
    } catch {
    }
    return {
      portfolio_id: snapshot.portfolio_id,
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      markdown,
      projects: snapshot.projects
    };
  }
  async deliverToSlack(digest) {
    const record = {
      id: randomUUID15(),
      portfolio_id: digest.portfolio_id,
      channel: "slack",
      delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
      success: false,
      error: null
    };
    if (!this.cfg.slackWebhookUrl) {
      record.error = "slackWebhookUrl not configured";
      return record;
    }
    try {
      const resp = await fetch(this.cfg.slackWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: digest.markdown })
      });
      if (!resp.ok) throw new Error(`Slack HTTP ${resp.status}`);
      record.success = true;
      logger.info("portfolio: digest delivered to Slack", { portfolio_id: digest.portfolio_id });
    } catch (e) {
      record.error = e instanceof Error ? e.message : String(e);
    }
    return record;
  }
  async deliverToConfluence(digest) {
    const record = {
      id: randomUUID15(),
      portfolio_id: digest.portfolio_id,
      channel: "confluence",
      delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
      success: false,
      error: null
    };
    if (!this.cfg.confluenceBaseUrl || !this.cfg.confluenceToken || !this.cfg.confluenceSpaceKey) {
      record.error = "Confluence not configured";
      return record;
    }
    try {
      const xhtml = `<p>${digest.markdown.replace(/\n/g, "</p><p>")}</p>`;
      const body = {
        type: "page",
        title: `Portfolio Digest \u2014 ${digest.generated_at.slice(0, 10)}`,
        space: { key: this.cfg.confluenceSpaceKey },
        body: { storage: { value: xhtml, representation: "storage" } }
      };
      const resp = await fetch(`${this.cfg.confluenceBaseUrl}/rest/api/content`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cfg.confluenceToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`Confluence HTTP ${resp.status}`);
      record.success = true;
      logger.info("portfolio: digest delivered to Confluence", { portfolio_id: digest.portfolio_id });
    } catch (e) {
      record.error = e instanceof Error ? e.message : String(e);
    }
    return record;
  }
};

// src/server/routes/portfolio.ts
import { Hono as Hono5 } from "hono";
function createPortfolioRouter(store, aggregator, digestWriter) {
  const router = new Hono5();
  const ok = (data) => ({ ok: true, data });
  const err = (code, message) => ({ ok: false, error: { code, message } });
  router.get("/", async (c) => {
    return c.json(ok(await store.listPortfolios()));
  });
  router.post("/", async (c) => {
    const body = await c.req.json();
    const portfolio = await store.createPortfolio({ name: body.name, project_keys: body.project_keys ?? [], owner: body.owner ?? null });
    return c.json(ok(portfolio), 201);
  });
  router.get("/:id", async (c) => {
    const p = await store.getPortfolio(c.req.param("id"));
    if (!p) return c.json(err("NOT_FOUND", "Portfolio not found"), 404);
    return c.json(ok(p));
  });
  router.post("/:id/projects", async (c) => {
    const { project_key } = await c.req.json();
    try {
      const updated = await store.addProjectToPortfolio(c.req.param("id"), project_key);
      return c.json(ok(updated));
    } catch (e) {
      return c.json(err("UPDATE_FAILED", e instanceof Error ? e.message : String(e)), 400);
    }
  });
  router.get("/:id/snapshot", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot yet. Try POST \u2026/snapshot/refresh"), 404);
    return c.json(ok(snap));
  });
  router.post("/:id/snapshot/refresh", async (c) => {
    try {
      const snap = await aggregator.aggregate(c.req.param("id"));
      return c.json(ok(snap));
    } catch (e) {
      return c.json(err("AGGREGATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });
  router.get("/:id/dependencies", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.dependencies));
  });
  router.get("/:id/capacity", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot"), 404);
    return c.json(ok(snap.capacity_rows));
  });
  router.get("/:id/digest", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap?.digest) return c.json(err("NOT_FOUND", "No digest yet. Try POST \u2026/digest/generate"), 404);
    return c.json(ok(snap.digest));
  });
  router.post("/:id/digest/generate", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap) return c.json(err("NOT_FOUND", "No snapshot. Refresh first."), 404);
    try {
      const digest = await digestWriter.generate(snap);
      const updated = { ...snap, digest };
      await store.saveSnapshot(updated);
      return c.json(ok(digest));
    } catch (e) {
      return c.json(err("GENERATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });
  router.post("/:id/digest/deliver/slack", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap?.digest) return c.json(err("NOT_FOUND", "No digest. Generate first."), 404);
    const record = await digestWriter.deliverToSlack(snap.digest);
    return c.json(ok(record));
  });
  router.post("/:id/digest/deliver/confluence", async (c) => {
    const snap = await store.latestSnapshot(c.req.param("id"));
    if (!snap?.digest) return c.json(err("NOT_FOUND", "No digest. Generate first."), 404);
    const record = await digestWriter.deliverToConfluence(snap.digest);
    return c.json(ok(record));
  });
  return router;
}

// src/stores/draft-store.ts
import { randomUUID as randomUUID16 } from "crypto";
async function getLanceDB5() {
  return await import("@lancedb/lancedb");
}
var DraftStore = class {
  constructor(storePath) {
    this.storePath = storePath;
  }
  storePath;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB5();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }
  /** Serialize complex nested fields to JSON strings for LanceDB storage */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialize(draft) {
    return {
      ...draft,
      content: JSON.stringify(draft.content),
      // LanceDB cannot infer schema for null values — store as empty string sentinel
      confluence_url: draft.confluence_url ?? "",
      epic_key: draft.epic_key ?? ""
    };
  }
  deserialize(row) {
    return {
      ...row,
      content: typeof row.content === "string" ? JSON.parse(row.content) : row.content,
      confluence_url: row.confluence_url === "" ? null : row.confluence_url,
      epic_key: row.epic_key === "" ? null : row.epic_key
    };
  }
  async all() {
    try {
      const db = await this.getDb();
      const names = await db.tableNames();
      if (!names.includes("prd_drafts")) return [];
      const t = await db.openTable("prd_drafts");
      const rows = await t.query().toArray();
      return rows.map((r) => this.deserialize(r));
    } catch {
      return [];
    }
  }
  async insert(draft) {
    const row = this.serialize(draft);
    const db = await this.getDb();
    const names = await db.tableNames();
    if (!names.includes("prd_drafts")) {
      await db.createTable("prd_drafts", [row]);
    } else {
      const t = await db.openTable("prd_drafts");
      await t.add([row]);
    }
  }
  async remove(id) {
    try {
      const db = await this.getDb();
      const t = await db.openTable("prd_drafts");
      await t.delete(`id = '${id}'`);
    } catch (e) {
      logger.error("DraftStore.remove failed", { err: String(e) });
    }
  }
  async listDrafts(projectKey) {
    const all = await this.all();
    return all.filter((d) => d.project_key === projectKey).sort((a, b) => b.version - a.version);
  }
  async getDraft(id) {
    const all = await this.all();
    return all.find((d) => d.id === id) ?? null;
  }
  async latestDraft(projectKey) {
    const drafts = await this.listDrafts(projectKey);
    return drafts[0] ?? null;
  }
  async saveDraft(input) {
    const existing = await this.listDrafts(input.project_key);
    const version = (existing[0]?.version ?? 0) + 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const draft = { id: randomUUID16(), version, created_at: now, updated_at: now, ...input };
    await this.insert(draft);
    return draft;
  }
  async approve(id) {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error(`Draft ${id} not found`);
    if (draft.status !== "draft") throw new Error(`Draft ${id} is not in draft status`);
    const updated = { ...draft, status: "approved", updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    await this.remove(id);
    await this.insert(updated);
    return updated;
  }
  async markPublished(id, confluenceUrl) {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error(`Draft ${id} not found`);
    if (draft.status !== "approved") throw new Error(`Draft ${id} must be approved before publishing`);
    const updated = { ...draft, status: "published", confluence_url: confluenceUrl, updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    await this.remove(id);
    await this.insert(updated);
    return updated;
  }
};

// src/services/prd-writer.ts
import { randomUUID as randomUUID17 } from "crypto";
var PRD_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" }
        },
        required: ["heading", "body"]
      }
    }
  },
  required: ["title", "sections"]
};
var PRDWriter = class {
  constructor(store, kb, llm) {
    this.store = store;
    this.kb = kb;
    this.llm = llm;
  }
  store;
  kb;
  llm;
  async generate(input) {
    const chunks = await retrieveChunks(input.context, input.project_key, this.kb, this.llm, 6);
    const ragSources = chunks.map((c) => ({
      chunk_id: c.source_id,
      source_url: c.url ?? c.file_path ?? "",
      excerpt: c.text.slice(0, 200),
      score: c.score
    }));
    const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.text.slice(0, 400)}`).join("\n\n");
    const typeLabel = { prd: "Product Requirements Document", rfc: "RFC", brief: "Product Brief" }[input.document_type];
    const prompt = `You are a senior product manager. Generate a well-structured ${typeLabel} in Markdown.

Project: ${input.project_key}
` + (input.epic_key ? `Epic: ${input.epic_key}
` : "") + `Context provided by user:
${input.context}

` + (contextBlock ? `Knowledge base context:
${contextBlock}

` : "") + `Return a JSON with: title (string) and sections (array of {heading, body}).`;
    let title = `${typeLabel} \u2014 ${input.project_key}`;
    let sections = [
      { heading: "Overview", body: input.context },
      { heading: "Goals", body: "_To be defined_" },
      { heading: "Requirements", body: "_To be defined_" }
    ];
    try {
      const { result } = await this.llm.complete(prompt, PRD_SCHEMA);
      title = result.title;
      sections = result.sections;
    } catch {
    }
    const content = {
      sections: sections.map((s, i) => ({ id: randomUUID17(), heading: s.heading, body: s.body, order: i })),
      rag_sources: ragSources
    };
    return this.store.saveDraft({
      project_key: input.project_key,
      epic_key: input.epic_key,
      document_type: input.document_type,
      title,
      content,
      status: "draft",
      confluence_url: null
    });
  }
};

// src/services/confluence-publisher.ts
function markdownToXhtml(md) {
  return md.split("\n\n").map((block) => {
    const h = block.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const level = Math.min(h[1].length, 4);
      return `<h${level}>${h[2]}</h${level}>`;
    }
    const line = block.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n/g, "<br/>");
    return `<p>${line}</p>`;
  }).join("\n");
}
var ConfluencePublisher = class {
  constructor(cfg) {
    this.cfg = cfg;
  }
  cfg;
  get headers() {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }
  async publish(draft) {
    const xhtml = draft.content.sections.sort((a, b) => a.order - b.order).map((s) => `<h2>${s.heading}</h2>
${markdownToXhtml(s.body)}`).join("\n");
    const searchResp = await fetch(
      `${this.cfg.baseUrl}/rest/api/content?spaceKey=${this.cfg.spaceKey}&title=${encodeURIComponent(draft.title)}&expand=body.storage,version`,
      { headers: this.headers }
    );
    let existingId = null;
    let existingVersion = 0;
    let beforeXhtml = "";
    if (searchResp.ok) {
      const data = await searchResp.json();
      if (data.results.length > 0) {
        existingId = data.results[0].id;
        existingVersion = data.results[0].version.number;
        beforeXhtml = data.results[0].body?.storage?.value ?? "";
      }
    }
    const payload = {
      type: "page",
      title: draft.title,
      space: { key: this.cfg.spaceKey },
      version: existingId ? { number: existingVersion + 1 } : void 0,
      body: {
        storage: { value: xhtml, representation: "storage" }
      }
    };
    let pageUrl = "";
    if (existingId) {
      const resp = await fetch(`${this.cfg.baseUrl}/rest/api/content/${existingId}`, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`Confluence update failed: ${resp.status}`);
      const data = await resp.json();
      pageUrl = `${this.cfg.baseUrl}${data._links.webui}`;
    } else {
      const resp = await fetch(`${this.cfg.baseUrl}/rest/api/content`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error(`Confluence create failed: ${resp.status}`);
      const data = await resp.json();
      pageUrl = `${this.cfg.baseUrl}${data._links.webui}`;
    }
    logger.info("prd: published to Confluence", { draft_id: draft.id, pageUrl });
    return { url: pageUrl, diff: { before: beforeXhtml, after: xhtml } };
  }
};

// src/server/routes/prd.ts
import { Hono as Hono6 } from "hono";
function createPRDRouter(store, writer, publisher) {
  const router = new Hono6();
  const ok = (data) => ({ ok: true, data });
  const err = (code, message) => ({ ok: false, error: { code, message } });
  router.get("/:projectKey/drafts", async (c) => {
    return c.json(ok(await store.listDrafts(c.req.param("projectKey"))));
  });
  router.post("/:projectKey/drafts/generate", async (c) => {
    const body = await c.req.json();
    try {
      const draft = await writer.generate({
        project_key: c.req.param("projectKey"),
        epic_key: body.epic_key ?? null,
        document_type: body.document_type ?? "prd",
        context: body.context
      });
      return c.json(ok(draft), 201);
    } catch (e) {
      return c.json(err("GENERATE_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });
  router.get("/:projectKey/drafts/:id", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    return c.json(ok(draft));
  });
  router.get("/:projectKey/drafts/:id/diff", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    if (!draft.confluence_url) return c.json(ok({ before: "", after: "" }));
    return c.json(ok({ before: "", after: "(already published)" }));
  });
  router.post("/:projectKey/drafts/:id/approve", async (c) => {
    try {
      const draft = await store.approve(c.req.param("id"));
      return c.json(ok(draft));
    } catch (e) {
      return c.json(err("APPROVE_FAILED", e instanceof Error ? e.message : String(e)), 400);
    }
  });
  router.post("/:projectKey/drafts/:id/publish", async (c) => {
    const draft = await store.getDraft(c.req.param("id"));
    if (!draft) return c.json(err("NOT_FOUND", "Draft not found"), 404);
    if (draft.status !== "approved") {
      return c.json(err("NOT_APPROVED", "Draft must be approved before publishing"), 403);
    }
    if (!publisher) {
      return c.json(err("NOT_CONFIGURED", "Confluence publisher not configured"), 503);
    }
    try {
      const { url, diff } = await publisher.publish(draft);
      const published = await store.markPublished(draft.id, url);
      return c.json(ok({ draft: published, diff }));
    } catch (e) {
      return c.json(err("PUBLISH_FAILED", e instanceof Error ? e.message : String(e)), 500);
    }
  });
  return router;
}

// src/server/app.ts
var JiraSchema = z2.object({
  baseUrl: z2.string().url(),
  projectKey: z2.string().min(1),
  token: z2.string().min(1)
});
var OpenAISchema = z2.object({
  apiKey: z2.string().min(1),
  orgId: z2.string().optional(),
  baseUrl: z2.string().url().optional(),
  plannerModel: z2.string().default("gpt-4o"),
  executorModel: z2.string().default("gpt-4o-mini"),
  reviewerModel: z2.string().default("gpt-4o-mini"),
  tpmBudget: z2.number().int().positive().default(1e5),
  rpmBudget: z2.number().int().positive().default(60)
});
var GitHubSchema = z2.object({
  pat: z2.string().optional(),
  appId: z2.string().optional(),
  privateKey: z2.string().optional(),
  repos: z2.array(z2.string()).default([]),
  branchFilter: z2.string().default("main")
});
var ProviderSchemas = { jira: JiraSchema, openai: OpenAISchema, github: GitHubSchema };
async function toForgeRequest(c) {
  const headers = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const params = {};
  try {
    const rawParams = c.req.param();
    if (rawParams && typeof rawParams === "object") {
      Object.assign(params, rawParams);
    }
  } catch {
  }
  const query = {};
  const url = new URL(c.req.url);
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  let body;
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await c.req.json();
    } catch {
      body = void 0;
    }
  }
  return { headers, params, query, body };
}
function createApp(config2) {
  const app2 = new Hono7();
  let _kb = null;
  function getKB() {
    if (!_kb) {
      _kb = new KnowledgeBase({
        storePath: config2.kb.storePath,
        maxSizeGb: config2.kb.maxSizeGb,
        adapter: createLLMAdapter({
          apiKey: config2.llm.apiKey,
          baseUrl: config2.llm.baseUrl,
          model: config2.llm.model,
          embeddingModel: config2.llm.embeddingModel,
          callsPerMinute: config2.llm.callsPerMinute,
          degraded: config2.llm.degraded
        })
      });
    }
    return _kb;
  }
  app2.get("/health", (c) => {
    return c.json({
      status: "ok",
      version: "1.0.0",
      degraded: !config2.featureFlags.jiraIngestionEnabled || !config2.featureFlags.repoGroundingEnabled,
      featureFlags: config2.featureFlags,
      sprint_board_ids: config2.sprint.boardIds
    });
  });
  app2.post("/forge/ingest/issue", async (c) => {
    const req = await toForgeRequest(c);
    req.query = { ...req.query, base_url: config2.baseUrl };
    const res = await handleIngestIssue(req);
    return c.json(res.body, res.status);
  });
  app2.get("/forge/ingest/board/:id", async (c) => {
    const req = await toForgeRequest(c);
    req.query = { ...req.query, base_url: config2.baseUrl };
    const res = await handleIngestBoard(req);
    return c.json(res.body, res.status);
  });
  app2.get("/forge/plan/:run_id", async (c) => {
    const req = await toForgeRequest(c);
    const res = await handleGetPlan(req);
    return c.json(res.body, res.status);
  });
  app2.post("/forge/output/confirm/:run_id", async (c) => {
    if (config2.featureFlags.shadowModeOnly) {
      logger.warn("forge_confirm_blocked_shadow_mode", {
        run_id: c.req.param("run_id")
      });
      return c.json({ error: "shadow mode active \u2014 confirm endpoint is disabled" }, 403);
    }
    const req = await toForgeRequest(c);
    const res = await handleConfirmPost(req);
    return c.json(res.body, res.status);
  });
  function kbWriteGuard(c) {
    if (config2.featureFlags.shadowModeOnly) {
      logger.warn("kb_write_blocked_shadow_mode", { path: c.req.path });
      return c.json({ error: "shadow mode active \u2014 KB writes are disabled" }, 403);
    }
    return null;
  }
  app2.post("/kb/ingest", async (c) => {
    const guard = kbWriteGuard(c);
    if (guard) return guard;
    const formData = await c.req.formData().catch(() => null);
    if (!formData) return c.json({ error: "multipart/form-data required" }, 400);
    const file = formData.get("file");
    const projectKey = String(formData.get("project_key") ?? "").trim();
    if (!projectKey) return c.json({ error: "project_key is required" }, 400);
    if (!file || typeof file === "string") return c.json({ error: "file field required" }, 400);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name ?? "upload";
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
  app2.post("/kb/crawl", async (c) => {
    const guard = kbWriteGuard(c);
    if (guard) return guard;
    const body = await c.req.json().catch(() => null);
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
  app2.get("/kb/sources", async (c) => {
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
  app2.delete("/kb/sources/:id", async (c) => {
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
  const serverStartMs = Date.now();
  if (config2.uiDevEndpoints) {
    app2.get("/api/status", (c) => {
      return c.json({
        server: "product-overlord",
        version: "1.0.0",
        shadow_mode: config2.featureFlags.shadowModeOnly,
        degraded_flags: {
          llm: config2.llm.degraded,
          repo: !config2.featureFlags.repoGroundingEnabled,
          jira: !config2.featureFlags.jiraIngestionEnabled,
          rovo: !config2.featureFlags.rovoMcpEnabled
        },
        uptime_ms: Date.now() - serverStartMs
      });
    });
    app2.get("/api/config", (c) => {
      function mask(v) {
        return v ? "[set]" : "[not set]";
      }
      return c.json({
        nodeEnv: config2.nodeEnv,
        baseUrl: config2.baseUrl,
        port: config2.port,
        jiraBaseUrl: config2.jiraBaseUrl ?? "[not set]",
        jiraAccessToken: mask(config2.jiraAccessToken),
        rovoMcpCloudId: mask(config2.rovoMcpCloudId),
        rovoMcpAccessToken: mask(config2.rovoMcpAccessToken),
        githubAccessToken: mask(config2.githubAccessToken),
        bitbucketAccessToken: mask(config2.bitbucketAccessToken),
        llmApiKey: mask(config2.llm.apiKey),
        llmBaseUrl: config2.llm.baseUrl,
        llmModel: config2.llm.model,
        embeddingModel: config2.llm.embeddingModel,
        kbStorePath: config2.kb.storePath,
        kbMaxSizeGb: config2.kb.maxSizeGb,
        featureFlags: config2.featureFlags
      });
    });
    app2.get("/api/metrics", (c) => {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();
      const send = (event) => writer.write(encoder.encode(`data: ${JSON.stringify(event)}

`)).catch(() => {
      });
      const unsub = forgeInstrumentation.subscribeSSE(send);
      const hb = setInterval(() => {
        send({ type: "heartbeat", ts: (/* @__PURE__ */ new Date()).toISOString() });
      }, 15e3);
      send({ type: "connected", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      c.req.raw.signal.addEventListener("abort", () => {
        unsub();
        clearInterval(hb);
        writer.close().catch(() => {
        });
      });
      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*"
        }
      });
    });
  }
  const connMgr = ConnectionManager.instance;
  const VALID_PROVIDERS = ["jira", "openai", "github"];
  function isValidProvider(p) {
    return VALID_PROVIDERS.includes(p);
  }
  app2.get("/api/connections/:provider", (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const config3 = connMgr.load(provider);
    return config3 ? c.json(config3) : c.json({ configured: false }, 404);
  });
  app2.post("/api/connections/:provider", async (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const schema = ProviderSchemas[provider];
    const parsed = schema.safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    connMgr.save(provider, parsed.data);
    return c.json({ ok: true });
  });
  app2.post("/api/connections/:provider/test", async (c) => {
    const provider = c.req.param("provider");
    if (!isValidProvider(provider)) return c.json({ error: "Unknown provider" }, 400);
    const result = await connMgr.test(provider);
    return c.json(result, result.ok ? 200 : 502);
  });
  app2.get("/api/decisions/stream", (c) => {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = DecisionQueue.subscribe((d) => {
      writer.write(enc.encode(`data: ${JSON.stringify(d)}

`)).catch(() => {
      });
    });
    for (const d of DecisionQueue.list()) {
      writer.write(enc.encode(`data: ${JSON.stringify(d)}

`)).catch(() => {
      });
    }
    c.req.raw.signal.addEventListener("abort", () => {
      unsub();
      writer.close().catch(() => {
      });
    });
    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" }
    });
  });
  app2.get("/api/decisions", (c) => {
    const status = c.req.query("status");
    return c.json(DecisionQueue.list(status));
  });
  app2.post("/api/decisions/:id/approve", (c) => {
    const d = DecisionQueue.approve(c.req.param("id"));
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });
  app2.post("/api/decisions/:id/reject", async (c) => {
    let reason;
    try {
      const b = await c.req.json();
      reason = b?.reason;
    } catch {
    }
    const d = DecisionQueue.reject(c.req.param("id"), reason);
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });
  app2.post("/api/decisions/:id/modify", async (c) => {
    let patch;
    try {
      const b = await c.req.json();
      patch = b?.patch;
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const d = DecisionQueue.modify(c.req.param("id"), patch);
    return d ? c.json(d) : c.json({ error: "Not found or not pending" }, 404);
  });
  WorkflowScheduler.load();
  app2.get("/api/workflows/schedules", (c) => c.json(WorkflowScheduler.list()));
  app2.post("/api/workflows/schedules", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = z2.object({
      name: z2.string().min(1),
      cron_expr: z2.string().min(1),
      stages: z2.array(z2.string()).min(1),
      enabled: z2.boolean().default(true)
    }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    const schedule = WorkflowScheduler.upsert(parsed.data);
    return c.json(schedule, 201);
  });
  app2.delete("/api/workflows/schedules/:id", (c) => {
    const ok = WorkflowScheduler.delete(c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Not found" }, 404);
  });
  app2.post("/api/workflows/plan", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = z2.object({ stages: z2.array(z2.string()).min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed" }, 422);
    const result = await WorkflowEngine.plan(parsed.data.stages);
    return c.json(result);
  });
  app2.post("/api/workflows/run", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const parsed = z2.object({ stages: z2.array(z2.string()).min(1) }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed" }, 422);
    const run_id = await WorkflowEngine.run(parsed.data.stages);
    return c.json({ run_id }, 202);
  });
  app2.get("/api/workflows/runs", (c) => c.json(WorkflowEngine.listRuns()));
  app2.get("/api/workflows/runs/:run_id/logs", (c) => {
    const run_id = c.req.param("run_id");
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = AgentEventBus.subscribe((e) => {
      if (e.run_id === run_id) writer.write(enc.encode(`data: ${JSON.stringify(e)}

`)).catch(() => {
      });
    });
    for (const e of AgentEventBus.replay()) {
      if (e.run_id === run_id) writer.write(enc.encode(`data: ${JSON.stringify(e)}

`)).catch(() => {
      });
    }
    c.req.raw.signal.addEventListener("abort", () => {
      unsub();
      writer.close().catch(() => {
      });
    });
    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" }
    });
  });
  app2.post("/api/workflows/:run_id/stop", (c) => {
    const force = c.req.query("force") === "true";
    const ok = WorkflowEngine.stop(c.req.param("run_id"));
    return ok ? c.json({ ok: true, force }) : c.json({ error: "Run not found or already finished" }, 404);
  });
  app2.get("/api/agents", (c) => {
    return c.json(AgentRegistry.listRuns().map((r) => ({ name: r.name, run_id: r.run_id, started_at: r.started_at, parent_run_id: r.parent_run_id })));
  });
  app2.post("/api/agents", async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }
    const { buildAgent: buildAgent2, CAPABILITY_REGISTRY: CAPABILITY_REGISTRY2 } = await Promise.resolve().then(() => (init_CustomAgentBuilder(), CustomAgentBuilder_exports));
    const parsed = z2.object({
      name: z2.string().min(1),
      description: z2.string().default(""),
      role: z2.enum(["planner", "executor", "reviewer", "orchestrator"]),
      persona: z2.string().default(""),
      skills: z2.array(z2.string()).default([]),
      maxConcurrency: z2.number().int().min(1).max(20).default(4),
      rpmCap: z2.number().int().positive().default(60),
      tpmCap: z2.number().int().positive().default(1e5),
      retryPolicy: z2.enum(["none", "exponential", "fixed"]).default("exponential")
    }).safeParse(body);
    if (!parsed.success) return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
    const agent = buildAgent2(parsed.data);
    void CAPABILITY_REGISTRY2;
    return c.json({ name: agent.name, dir: agent.dir }, 201);
  });
  app2.get("/api/agents/stream", (c) => {
    const agentFilter = c.req.query("agent");
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const enc = new TextEncoder();
    const unsub = AgentEventBus.subscribe((e) => {
      if (!agentFilter || e.agent === agentFilter)
        writer.write(enc.encode(`data: ${JSON.stringify(e)}

`)).catch(() => {
        });
    });
    for (const e of AgentEventBus.replay(agentFilter)) {
      writer.write(enc.encode(`data: ${JSON.stringify(e)}

`)).catch(() => {
      });
    }
    c.req.raw.signal.addEventListener("abort", () => {
      unsub();
      writer.close().catch(() => {
      });
    });
    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" }
    });
  });
  app2.post("/api/agents/:run_id/stop", (c) => {
    const ok = AgentRegistry.stopRun(c.req.param("run_id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "Run not found" }, 404);
  });
  app2.post("/api/agents/stop-all", (_c) => {
    const runs = AgentRegistry.listRuns();
    for (const r of runs) AgentRegistry.stopRun(r.run_id);
    WorkflowEngine.listRuns().filter((r) => r.status === "running").forEach((r) => WorkflowEngine.stop(r.run_id));
    return _c.json({ stopped: runs.length });
  });
  OrchestratorTeam.start();
  app2.get("/api/orchestrators/findings", (c) => {
    const status = c.req.query("status");
    return c.json(OrchestratorTeam.list(status));
  });
  app2.post("/api/orchestrators/findings/:id/ack", (c) => {
    const f = OrchestratorTeam.ack(c.req.param("id"));
    return f ? c.json(f) : c.json({ error: "Not found" }, 404);
  });
  app2.post("/api/orchestrators/findings/:id/escalate", (c) => {
    const f = OrchestratorTeam.escalate(c.req.param("id"));
    return f ? c.json(f) : c.json({ error: "Not found" }, 404);
  });
  app2.post("/api/orchestrators/:name/stop", (c) => {
    const count = AgentRegistry.stopAgent(c.req.param("name"));
    return c.json({ stopped_runs: count });
  });
  if (config2.featureFlags.jiraIngestionEnabled && config2.sprint?.boardIds?.length > 0) {
    const jiraAgile = new JiraAgileRestAdapter({
      baseUrl: config2.jiraBaseUrl,
      accessToken: config2.jiraAccessToken
    });
    const sprintMonitor = new SprintMonitor(jiraAgile, config2.sprint);
    sprintMonitor.start();
    app2.route("/api/sprint", createSprintRouter(sprintMonitor));
    const llmAdapter = createLLMAdapter({
      apiKey: config2.llm.apiKey,
      baseUrl: config2.llm.baseUrl,
      model: config2.llm.model,
      embeddingModel: config2.llm.embeddingModel,
      callsPerMinute: config2.llm.callsPerMinute,
      degraded: config2.llm.degraded
    });
    const roadmapStore = new RoadmapStore(jiraAgile, llmAdapter, {}, async () => []);
    app2.route("/api/roadmap", createRoadmapRouter(roadmapStore));
    const storePath = process.env.LANCEDB_PATH ?? "./data/lancedb";
    const webhookFeedback = new WebhookFeedbackAdapter();
    const triageQueue = new TriageQueue(storePath, jiraAgile);
    const themeClusterer = new ThemeClusterer(llmAdapter);
    const opportunitySizer = new OpportunitySizer(llmAdapter);
    app2.route("/api/discovery", createDiscoveryRouter(
      triageQueue,
      themeClusterer,
      opportunitySizer,
      [webhookFeedback],
      webhookFeedback
    ));
    const okrStore = new OKRStore(storePath);
    const reflectionAgent = new ReflectionAgent(llmAdapter);
    const webhookMetrics = new WebhookMetricsAdapter();
    const snapshotBuilder = new OutcomeSnapshotBuilder(okrStore, [webhookMetrics], reflectionAgent);
    app2.route("/api/outcomes", createOutcomesRouter(okrStore, snapshotBuilder, webhookMetrics));
    const portfolioStore = new PortfolioStore(storePath);
    const crossProjectDeps = new CrossProjectDependencyGraph(roadmapStore);
    const capacityHeatmap = new CapacityHeatmapBuilder(roadmapStore, config2.sprint?.sprintLengthDays ?? 14);
    const portfolioAgg = new PortfolioAggregator(portfolioStore, roadmapStore, crossProjectDeps, capacityHeatmap);
    const digestWriter = new PortfolioDigestWriter(llmAdapter, {
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      confluenceBaseUrl: config2.confluenceBaseUrl,
      confluenceToken: config2.confluenceToken,
      confluenceSpaceKey: process.env.CONFLUENCE_SPACE_KEY
    });
    app2.route("/api/portfolio", createPortfolioRouter(portfolioStore, portfolioAgg, digestWriter));
    const draftStore = new DraftStore(storePath);
    const kbStore = new KBStore(storePath);
    const prdWriter = new PRDWriter(draftStore, kbStore, llmAdapter);
    const confluencePublisher = config2.confluenceBaseUrl && config2.confluenceToken ? new ConfluencePublisher({
      baseUrl: config2.confluenceBaseUrl,
      token: config2.confluenceToken,
      spaceKey: process.env.CONFLUENCE_SPACE_KEY ?? "PROD"
    }) : null;
    app2.route("/api/prd", createPRDRouter(draftStore, prdWriter, confluencePublisher));
  } else {
    app2.get(
      "/api/sprint/*",
      (c) => c.json({ ok: false, error: { code: "JIRA_NOT_CONFIGURED", message: "Jira integration is not enabled" } }, 503)
    );
    app2.get(
      "/api/roadmap/*",
      (c) => c.json({ ok: false, error: { code: "JIRA_NOT_CONFIGURED", message: "Jira integration is not enabled" } }, 503)
    );
  }
  app2.notFound((c) => {
    return c.json({ error: "not found" }, 404);
  });
  return app2;
}

// src/index.ts
loadDotenv();
var config;
try {
  config = loadConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
var app = createApp(config);
serve({ fetch: app.fetch, port: config.port }, (info) => {
  const degradedList = Object.entries(config.featureFlags).filter(([k, v]) => k !== "a2aEnabled" && !v).map(([k]) => k);
  const degradedStr = degradedList.length > 0 ? ` [degraded: ${degradedList.join(", ")}]` : " [all capabilities enabled]";
  logger.info("server_started", {
    port: info.port,
    base_url: config.baseUrl,
    node_env: config.nodeEnv,
    degraded_capabilities: degradedList
  });
  console.log(`product-overlord listening on :${info.port}${degradedStr}`);
});
process.on("SIGTERM", () => {
  logger.info("server_shutdown", { signal: "SIGTERM" });
  process.exit(0);
});
process.on("SIGINT", () => {
  logger.info("server_shutdown", { signal: "SIGINT" });
  process.exit(0);
});
