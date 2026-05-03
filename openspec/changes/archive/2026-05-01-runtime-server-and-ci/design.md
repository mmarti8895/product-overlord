# Design Notes: runtime-server-and-ci

## Architecture

```
src/index.ts
  │
  ├── import { createServer } from "./server/config.js"
  │     └── validates env via Zod, builds ServerConfig
  │         ├── BASE_URL, PORT
  │         ├── jiraConfig, rovoConfig (optional → degraded)
  │         ├── githubToken, bitbucketToken (optional → no repo grounding)
  │         └── featureFlags: { repoGroundingEnabled, shadowModeOnly, a2aEnabled }
  │
  ├── createApp(config): Hono
  │     ├── GET  /health
  │     ├── POST /forge/ingest/issue         → handleIngestIssue
  │     ├── GET  /forge/ingest/board/:id     → handleBoardSweep
  │     ├── GET  /forge/plan/:run_id         → handleGetPlan
  │     └── POST /forge/output/confirm/:run_id → handleConfirmPost
  │
  └── serve(app, { port })
        └── logs: "product-overlord listening on :PORT [mode]"
```

## Degraded-Mode Flags

| Flag | Condition | Behaviour |
|---|---|---|
| `repoGroundingEnabled` | `GITHUB_ACCESS_TOKEN` or `BITBUCKET_ACCESS_TOKEN` present | `false` → repo mapper returns `null`; plan proceeds without repo grounding |
| `shadowModeOnly` | `SHADOW_MODE=true` | `true` → `/forge/output/confirm` returns 403 with message "shadow mode active" |
| `a2aEnabled` | `FEATURE_ROVO_AGENT_CONNECTOR=true` | Default `false` per existing invariant 15 |

## Environment Config Schema (Zod)

```ts
const ServerConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().url(),
  JIRA_BASE_URL: z.string().url().optional(),
  JIRA_ACCESS_TOKEN: z.string().optional(),
  ROVO_MCP_CLOUD_ID: z.string().optional(),
  ROVO_MCP_ACCESS_TOKEN: z.string().optional(),
  GITHUB_ACCESS_TOKEN: z.string().optional(),
  BITBUCKET_ACCESS_TOKEN: z.string().optional(),
  SHADOW_MODE: z.string().transform(v => v === "true").default("false"),
  FEATURE_ROVO_AGENT_CONNECTOR: z.string().transform(v => v === "true").default("false"),
});
```

Hard-fail on startup: `BASE_URL` missing (cannot construct `confirm_post_url` without it).
Warn and continue: all `_TOKEN` / `_ACCESS_TOKEN` fields — server starts in degraded mode.

## CI Workflow

```
.github/workflows/ci.yml

on:
  push:
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - checkout
      - setup-node (version from .nvmrc or 20)
      - npm ci
      - npm test
      - npm run typecheck   (tsc --noEmit)

  rollout-gate:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - npm run rollout:check
```

## Candidate Files

| File | Role |
|---|---|
| `src/index.ts` | Entry point: build config, create app, serve |
| `src/server/config.ts` | Zod env schema, `loadConfig()`, `ServerConfig` type, degraded flags |
| `src/server/app.ts` | `createApp(config): Hono` — route wiring, keeps index.ts thin |
| `.env.example` | Documented env template |
| `.github/workflows/ci.yml` | CI: test + typecheck + rollout gate (main only) |

## Candidate Tests

| Test | Type | Covers |
|---|---|---|
| `src/tests/unit/server-config.test.ts` | Unit | Zod validation, degraded flags, hard-fail on missing BASE_URL |
| `src/tests/contract/server-routes.test.ts` | Contract | All 4 routes + /health: happy path, 401 unauthenticated, 503 degraded mode |

## Sequence: Startup

```
process.env loaded
  → loadConfig() → Zod parse → ServerConfig
  → if BASE_URL missing: throw, exit 1
  → log degraded flags (no tokens logged)
  → createApp(config)
  → serve on PORT
  → log: "product-overlord listening on :3000 [degraded: repo-grounding=false]"
```
