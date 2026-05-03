## 1. Pre-conditions (gate before starting)

- [x] 1.1 Confirm stages 1–3 are archived and passing all evaluation gates (classification agreement ≥ 85%, precision-at-3 ≥ 80%)
- [x] 1.2 Confirm Atlassian Forge access is provisioned for the target organisation
- [x] 1.3 Confirm `rovo:agentConnector` EAP status — if not approved, skip tasks 4.x and proceed with stable path only
- [x] 1.4 Confirm feature flag `FEATURE_ROVO_AGENT_CONNECTOR=false` is deployed and respected before any EAP work begins

## 2. MVP — Forge-Callable HTTP Endpoints

- [x] 2.1 Implement `POST /forge/ingest/issue` endpoint: accepts issue key, calls orchestrator, returns Forge envelope (≤ 4.5 MB)
- [x] 2.2 Implement `GET /forge/ingest/board/{id}` endpoint: paginated board sweep with `cursor`, ≤ 4.5 MB per page
- [x] 2.3 Implement `GET /forge/plan/{run_id}` endpoint: retrieve action package by run ID
- [x] 2.4 Implement `POST /forge/output/confirm/{run_id}` endpoint: user confirms → orchestrator posts Jira comment under user credentials
- [x] 2.5 Implement payload-size guard: if response > 4.5 MB, return summary envelope + `next_cursor` + `deep_link`
- [x] 2.6 Contract-test all four endpoints: happy path, oversized response truncation, timeout, unauthenticated request

## 3. MVP — Forge Rovo Agent

- [x] 3.1 Scaffold Forge app with Rovo agent manifest
- [x] 3.2 Implement Forge action: "Analyse this ticket" → calls `/forge/ingest/issue` → displays summary card with verdict, score, top missing items, deep link
- [x] 3.3 Implement board sweep action with pagination and "load more" control
- [x] 3.4 Implement "Post comment / Discard" confirmation prompt in Jira UI → calls `/forge/output/confirm/{run_id}`
- [x] 3.5 Integration-test Forge agent end-to-end: trigger → analysis → summary card → confirm post → Jira comment written
- [x] 3.6 Confirm no autonomous Jira writes occur without user confirmation in Forge UI

## 4. EAP — rovo:agentConnector Shell (feature-flagged off by default)

- [x] 4.1 Implement A2A server: receive assignment / @mention events from Jira → call orchestrator endpoint → return draft
- [x] 4.2 Implement feature-flag check: if `FEATURE_ROVO_AGENT_CONNECTOR=false`, A2A server returns 503 with clear message
- [x] 4.3 Register `rovo:agentConnector` in Forge manifest behind EAP flag
- [x] 4.4 Integration-test A2A: ticket assignment → analysis triggered → draft comment presented for confirmation
- [x] 4.5 A2A unavailability test: fallback to manual Forge action with no data loss

## 5. Subagent Scoping & Research Subagent

- [x] 5.1 Configure Jira-facing subagent knowledge sources: project `{projectKey}` + Confluence space + `repo://{repo}/*` + `policy://{projectKey}/*` — exclude org-wide knowledge
- [x] 5.2 Implement and test knowledge-boundary assertion: scoped subagent cannot access other project's data
- [x] 5.3 Implement research subagent: isolated MCP session, opt-in trigger, 30/day rate limit, 15-min timeout (reuses stage-3 implementation; wire into Forge action as "Deep analysis" option)
- [x] 5.4 Test research subagent isolation: no shared state with operational subagent

## 6. Instrumentation & Rollout

- [x] 6.1 Add Forge action latency and error-rate metrics
- [x] 6.2 Add `deep_link` click-through tracking to measure Forge summary vs. full-package usage
- [x] 6.3 Update AGENTS.md: Forge invocation patterns, payload limits, subagent scoping rules, branch-name convention, research subagent trigger conditions
- [x] 6.4 Security review: Forge token scopes, `confirm_post_url` CSRF protection, A2A server auth, no org-wide knowledge leak
- [x] 6.5 Gate stable-path rollout on: all Forge contract tests passing, zero autonomous writes confirmed, ≥ 1 manual grooming session in Jira using Forge agent
- [x] 6.6 Gate EAP path activation on: EAP approval confirmed, `FEATURE_ROVO_AGENT_CONNECTOR=true` flipped in production only after stage-4 integration tests pass
