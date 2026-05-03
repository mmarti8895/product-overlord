/**
 * product-overlord — entry point
 *
 * Loads config, creates the Hono app, and starts the HTTP server.
 * Hard-fails if BASE_URL is absent. Logs degraded-mode flags on startup.
 */

import { serve } from "@hono/node-server";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "./server/config.js";
import { createApp } from "./server/app.js";
import { logger } from "./utils/logger.js";

// Load .env before config validation (no-op if file absent)
loadDotenv();

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

let config;
try {
  config = loadConfig();
} catch (err) {
  // loadConfig() already logged the details; just print the message and exit
  console.error((err as Error).message);
  process.exit(1);
}

const app = createApp(config);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

serve({ fetch: app.fetch, port: config.port }, (info) => {
  const degradedList = Object.entries(config.featureFlags)
    .filter(([k, v]) => k !== "a2aEnabled" && !v)
    .map(([k]) => k);

  const degradedStr = degradedList.length > 0
    ? ` [degraded: ${degradedList.join(", ")}]`
    : " [all capabilities enabled]";

  logger.info("server_started", {
    port: info.port,
    base_url: config.baseUrl,
    node_env: config.nodeEnv,
    degraded_capabilities: degradedList,
  });

  console.log(`product-overlord listening on :${info.port}${degradedStr}`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on("SIGTERM", () => {
  logger.info("server_shutdown", { signal: "SIGTERM" });
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("server_shutdown", { signal: "SIGINT" });
  process.exit(0);
});
