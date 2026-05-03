## Why

All four build stages are complete and 236 tests pass, but `product-overlord` has no runnable entry point and no automated CI. The Forge endpoint handlers in `src/forge/endpoints.ts` exist as pure functions but are never mounted on an HTTP server. `package.json` references `src/index.ts` in its `dev` script, yet the file does not exist. This change wires the server together, validates the environment on startup, and adds a GitHub Actions CI workflow so every push is verified automatically.

**Rollout stage:** 5 — Runtime Server & CI

## What Changes

- Introduce **`src/index.ts`** — a minimal Node.js HTTP server (using the `hono` framework) that mounts all four Forge route handlers, exposes a `GET /health` liveness endpoint, and initialises all singletons (evidence store, MCP registry, instrumentation, optional repo adapter) on startup.
- Introduce **`src/server/config.ts`** — Zod-validated environment config with explicit degraded-mode flags (e.g. `repoGroundingEnabled`, `shadowModeOnly`) so the server starts safely with a partial environment.
- Introduce **`.env.example`** — a documented template of all required and optional environment variables, suitable for `cp .env.example .env` onboarding.
- Introduce **`.github/workflows/ci.yml`** — a GitHub Actions workflow that runs on every push and PR: installs dependencies, runs all tests (`npm test`), runs the TypeScript compiler (`tsc --noEmit`), and runs the rollout gate check on pushes to `main`.
- Archive **`foundation-jira-ingestion-readiness`**, **`grounded-planning-repo-mapping`**, and **`jira-native-teammate-shell`** — all tasks are complete; these will be archived as part of this change's rollout tasks.
- Update **`README.md`** — add a "Running the server" section and update "Getting Started" to reference `.env.example`.

## Capabilities

### New Capabilities

- `orchestration`: The server initialisation contract — how adapters start, what happens when optional credentials are absent, graceful shutdown.

### Modified Capabilities

- `orchestration`: Document the HTTP server as the canonical deployment unit for Option A (standalone Node.js process).
- `output-contracts`: `confirm_post_url` values are now absolute URLs rooted at the server's `BASE_URL`.

## Impact

- **New files:** `src/index.ts`, `src/server/config.ts`, `.env.example`, `.github/workflows/ci.yml`.
- **New runtime dependency:** `hono` (tiny ESM-first HTTP framework, ~14 KB).
- **Modified files:** `README.md`, `package.json` (add `hono` dep, add `typecheck` script).
- **No changes** to any existing business logic, tests, or OpenSpec specs.
- **Assumptions:** The server is deployed as a long-running Node.js process reachable by Forge via HTTPS. Forge routes are authenticated via `Authorization: Bearer <token>` (enforced by existing endpoint handlers).
- **Non-goals:** TLS termination (handled by a reverse proxy / cloud load balancer), database persistence for memory stores (deferred to `stage5-durable-memory`), MCP server as a separate process (deferred).
- **Rollback:** Revert `src/index.ts` and `src/server/config.ts`. The endpoint handler functions in `src/forge/endpoints.ts` are unaffected.

## Human Approval Points

1. Framework choice confirmed (Hono vs. native `http`) before implementation starts.
2. Degraded-mode behaviour reviewed — specifically: should a missing `JIRA_ACCESS_TOKEN` hard-fail startup or log a warning and continue?
3. CI workflow reviewed before merge to `main` to confirm secret names match the repository's GitHub Actions secrets.
