## 1. MVP — Adapters & Normalisation

- [x] 1.1 Implement Rovo MCP adapter: `getIssue`, `searchIssues` (JQL), `naturalLanguageSearch`, `getProject` with OAuth 2.1 + API-token auth
- [x] 1.2 Implement Jira Agile REST adapter: `listBoards`, `getBoardIssues`, `getBacklogIssues`, `getSprintIssues`, `getBoardConfig`, `listSprints`
- [x] 1.3 Add retry logic (×3, exponential back-off) to both adapters; emit `adapter_error` / `adapter_degraded` traces on failure
- [x] 1.4 Implement Rovo MCP fallback when Jira Agile REST is unavailable
- [x] 1.5 Implement canonical ticket normaliser with full field mapping and AC-alias resolution
- [x] 1.6 Unit-test normaliser: AC alias detection (all 8 variants), missing-AC null path, dependency normalisation, cross-project partial-access redaction
- [x] 1.7 Contract-test both adapters against Jira sandbox: happy path, 5xx retry, 401 rejection

## 2. MVP — Readiness Policy Engine

- [x] 2.1 Design and implement per-project/per-issue-type readiness profile schema (JSON)
- [x] 2.2 Ship built-in default profiles for story, bug, and task
- [x] 2.3 Implement deterministic scoring engine: dimension weights → 0–100 score, confidence 0.0–1.0, `ready | needs_clarification | blocked` verdict
- [x] 2.4 Implement blocked-by-dependency detection (open `To Do` / `Open` blockers)
- [x] 2.5 Unit-test scorer: story-ready path, story-missing-AC path, bug-missing-repro-steps, blocked-by-dependency
- [x] 2.6 Implement persona-targeted clarification question generator (PM / engineer / QA personas)
- [x] 2.7 Unit-test question generator: PM question for missing AC, engineer question for undeclared dependency

## 3. MVP — Output & Evidence

- [x] 3.1 Implement evidence store: UUID run_id, ≥ 90-day retention, all required fields
- [x] 3.2 Implement Jira comment draft emitter with `confirm_post_url` gate (no autonomous post)
- [x] 3.3 Embed run_id in every comment draft
- [x] 3.4 Integration-test full pipeline: board sweep → normalise → score → draft → confirm gate

## 4. Hardening

- [x] 4.1 Add permission-fidelity check: cross-project JQL yields only accessible tickets; inaccessible projects noted in evidence bundle
- [x] 4.2 Add `adapter_unavailable` path test: both adapters down → `blocked` verdict, no partial output
- [x] 4.3 Add `profile_source: default` logging when no project profile exists
- [x] 4.4 Security review: token scopes, no credential logging, no cross-user data in evidence store

## 5. Instrumentation & Rollout

- [x] 5.1 Add structured logging for all adapter calls (latency, status, retry count)
- [x] 5.2 Add p95 latency instrumentation for end-to-end analysis runs
- [x] 5.3 Write AGENTS.md entries: ticket conventions, AC aliases, branch-name convention, readiness dimensions
- [x] 5.4 Deploy in read-only shadow mode; confirm zero autonomous Jira writes in production logs
- [x] 5.5 Gate rollout on: adapter contract tests passing, scoring unit tests passing, ≥ 1 manual grooming session reviewed
