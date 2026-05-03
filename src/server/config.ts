/**
 * Server environment configuration.
 *
 * Validates process.env via Zod on startup.
 * Hard-fails only when BASE_URL is absent (cannot build confirm_post_url).
 * All adapter tokens are optional — absence enables degraded mode.
 */

import { z } from "zod";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const ServerEnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
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
  SHADOW_MODE: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  FEATURE_ROVO_AGENT_CONNECTOR: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // LLM / Knowledge Base
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  LLM_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  KB_STORE_PATH: z.string().default("./.kb"),
  KB_MAX_SIZE_GB: z.coerce.number().default(5),
  LLM_CALLS_PER_MINUTE: z.coerce.number().default(60),
  DEGRADED_LLM: z
    .string()
    .default("false")
    .transform((v) => v === "true"),

  // UI developer endpoints (/api/status, /api/config, /api/metrics)
  UI_DEV_ENDPOINTS: z
    .string()
    .default("true")
    .transform((v) => v !== "false"),

  // Sprint monitoring
  SPRINT_POLL_INTERVAL_MS: z.coerce.number().default(300_000),
  SPRINT_DONE_STATUSES: z
    .string()
    .default("Done,Closed,Resolved")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  SPRINT_BOARD_IDS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
});

// ---------------------------------------------------------------------------
// Sprint config sub-type (task 1.3)
// ---------------------------------------------------------------------------

export interface SprintConfig {
  pollIntervalMs: number;
  doneStatuses: string[];
  boardIds: string[];
}

// ---------------------------------------------------------------------------
// Derived config type
// ---------------------------------------------------------------------------

export interface ServerConfig {
  port: number;
  baseUrl: string;
  nodeEnv: string;

  // Raw tokens (never logged)
  jiraBaseUrl: string | undefined;
  jiraAccessToken: string | undefined;
  rovoMcpCloudId: string | undefined;
  rovoMcpAccessToken: string | undefined;
  githubAccessToken: string | undefined;
  bitbucketAccessToken: string | undefined;

  // Derived feature flags
  featureFlags: {
    repoGroundingEnabled: boolean;
    jiraIngestionEnabled: boolean;
    rovoMcpEnabled: boolean;
    shadowModeOnly: boolean;
    a2aEnabled: boolean;
    llmEnabled: boolean;
  };

  // LLM / KB config
  llm: {
    apiKey: string | undefined;
    baseUrl: string;
    model: string;
    embeddingModel: string;
    callsPerMinute: number;
    degraded: boolean;
  };
  kb: {
    storePath: string;
    maxSizeGb: number;
  };

  // UI developer endpoints toggle
  uiDevEndpoints: boolean;

  // Sprint monitoring
  sprint: {
    pollIntervalMs: number;
    doneStatuses: string[];
    boardIds: string[];
  };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = ServerEnvSchema.safeParse(env);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    // Hard-fail — do not start without a valid BASE_URL
    const msg = `product-overlord: invalid environment configuration\n${issues}`;
    logger.error("server_config_invalid", { issues: result.error.issues });
    throw new Error(msg);
  }

  const e = result.data;

  const repoGroundingEnabled = Boolean(e.GITHUB_ACCESS_TOKEN || e.BITBUCKET_ACCESS_TOKEN);
  const jiraIngestionEnabled = Boolean(e.JIRA_BASE_URL && e.JIRA_ACCESS_TOKEN);
  const rovoMcpEnabled = Boolean(e.ROVO_MCP_CLOUD_ID && e.ROVO_MCP_ACCESS_TOKEN);

  // Log degraded flags — never log token values
  const degraded = {
    "repo-grounding": repoGroundingEnabled,
    "jira-ingestion": jiraIngestionEnabled,
    "rovo-mcp": rovoMcpEnabled,
    "shadow-mode": e.SHADOW_MODE,
    "a2a": e.FEATURE_ROVO_AGENT_CONNECTOR,
  };
  const degradedCapabilities = Object.entries(degraded)
    .filter(([, v]) => !v)
    .map(([k]) => k);

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
      llmEnabled: Boolean(e.LLM_API_KEY) && !e.DEGRADED_LLM,
    },
    llm: {
      apiKey: e.LLM_API_KEY,
      baseUrl: e.LLM_BASE_URL,
      model: e.LLM_MODEL,
      embeddingModel: e.EMBEDDING_MODEL,
      callsPerMinute: e.LLM_CALLS_PER_MINUTE,
      degraded: e.DEGRADED_LLM || !e.LLM_API_KEY,
    },
    kb: {
      storePath: e.KB_STORE_PATH,
      maxSizeGb: e.KB_MAX_SIZE_GB,
    },
    uiDevEndpoints: e.UI_DEV_ENDPOINTS,
    sprint: {
      pollIntervalMs: e.SPRINT_POLL_INTERVAL_MS,
      doneStatuses: e.SPRINT_DONE_STATUSES,
      boardIds: e.SPRINT_BOARD_IDS,
    },
  };
}
