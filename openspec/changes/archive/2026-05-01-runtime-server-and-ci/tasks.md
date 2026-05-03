# Tasks: runtime-server-and-ci

## 1. Pre-conditions

- [x] 1.1 Confirm framework choice: Hono (add as runtime dependency) vs. native `http` module
- [x] 1.2 Confirm degraded-mode behaviour: warn-and-continue for missing tokens, hard-fail only for missing `BASE_URL`
- [x] 1.3 Confirm GitHub Actions secret names to use in CI workflow (`JIRA_ACCESS_TOKEN`, etc.)

## 2. MVP — Environment Config

- [x] 2.1 Implement `src/server/config.ts`: Zod schema, `loadConfig()`, `ServerConfig` type, degraded-mode flags (`repoGroundingEnabled`, `shadowModeOnly`, `a2aEnabled`)
- [x] 2.2 Unit-test config: valid env parses correctly; missing `BASE_URL` throws; missing tokens produce degraded flags; `SHADOW_MODE=true` sets `shadowModeOnly`
- [x] 2.3 Create `.env.example` with all variables documented (required vs. optional, examples)

## 3. MVP — HTTP Server

- [x] 3.1 Add `hono` as a runtime dependency (`npm install hono`)
- [x] 3.2 Implement `src/server/app.ts`: `createApp(config): Hono` wiring all 4 forge routes + `GET /health`
- [x] 3.3 Implement `src/index.ts`: call `loadConfig()`, call `createApp()`, start server on `PORT`, log startup line with degraded flags
- [x] 3.4 Confirm `confirm_post_url` is constructed using `BASE_URL` from config (no hardcoded localhost)
- [x] 3.5 Implement `shadowModeOnly` guard on `POST /forge/output/confirm/:run_id` → return 403 with clear message
- [x] 3.6 Contract-test all 5 routes (`/health` + 4 forge routes): happy path, 401 unauthenticated, 403 shadow mode, missing run_id

## 4. CI/CD

- [x] 4.1 Add `typecheck` script to `package.json`: `tsc --noEmit`
- [x] 4.2 Create `.github/workflows/ci.yml`: test + typecheck on every push/PR; rollout-gate job on `main` only
- [x] 4.3 Verify CI passes locally: `npm test && npm run typecheck`

## 5. Housekeeping

- [x] 5.1 Archive `foundation-jira-ingestion-readiness` (all 27 tasks complete)
- [x] 5.2 Archive `grounded-planning-repo-mapping` (all 30 tasks complete)
- [x] 5.3 Archive `jira-native-teammate-shell` (all 31 tasks complete)
- [x] 5.4 Update `README.md`: add "Running the server" section, reference `.env.example` in Getting Started

## 6. AGENTS.md

- [x] 6.1 Add stage-5 section to `AGENTS.md`: server startup contract, degraded-mode flags, `confirm_post_url` construction rule, CI gate summary

## 7. Human Review

- [x] 7.1 Human review before merge
