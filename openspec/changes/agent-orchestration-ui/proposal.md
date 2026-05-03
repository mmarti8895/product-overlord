# Proposal: Agent Orchestration & Workflow UI Expansion

## Change ID
`agent-orchestration-ui`

## Status
`draft`

## Summary
Extend the `tauri-glass-ui` desktop application with a comprehensive agent orchestration layer:
connection setup for external services, a live agent decision-review pane, scheduled workflow
execution with a full crawl→normalize→enrich→LanceDB pipeline, a plan-mode dry-run simulation
widget, a custom agent builder backed by file-system AGENTS.md/SOUL.md/SKILLS.md scaffolding,
real-time agent/sub-agent reporting, an orchestrator monitoring team that detects thrashing, and
granular stop controls at every level of the agent hierarchy.

---

## Problem Statement

The existing UI surfaces static read-only panels for each `product-overlord` module. There is no
way to:

1. Configure connections to Jira, OpenAI, or GitHub without editing `.env` files directly.
2. Inspect or approve/reject individual agent decisions before they are committed.
3. Define, trigger, or schedule the end-to-end crawl pipeline without writing CLI commands.
4. Simulate what agents *would* do before committing expensive token spend.
5. Build new custom agents from inside the app without hand-authoring markdown files.
6. See live status updates from individual agents and sub-agents as they execute.
7. Detect and surface runaway or thrashing agents before they waste resources.
8. Stop a specific sub-agent, agent, orchestrator, or entire workflow mid-run from the UI.

---

## Proposed Solution

### 1 — Connection Setup Panels
A dedicated **Connections** section (sidebar group) with one panel per integration:

- **Jira Connection** — base URL, project key, API token (stored in OS keychain via Tauri
  `stronghold` plugin), test-connection button with latency readout.
- **OpenAI Connection** — API key, org ID, base URL override, model defaults per role
  (planner / executor / reviewer), TPM/RPM budget caps that feed the throttle engine.
- **GitHub Connection** — PAT or GitHub App credentials, target repos list, branch filter,
  sync-on-push webhook registration helper.

All credential writes go through a new `POST /api/connections/:provider` endpoint that persists
to the OS keychain; UI reads masked values back via `GET /api/connections/:provider`.

### 2 — Agent Decision Review
A slide-over drawer on the right edge of the shell that shows pending decisions emitted by any
agent that sets `requires_review: true` in its decision payload.  Each card shows:

- Agent name + run ID
- Decision type (e.g. `UPSERT_TICKET`, `CREATE_PR`, `EMBED_CHUNK`)
- Full JSON diff / context
- **Approve** / **Reject** / **Modify** actions

Decisions queue in a Zustand store fed by the `GET /api/decisions/stream` SSE endpoint. Approved
decisions are forwarded via `POST /api/decisions/:id/approve`; rejected via `/reject` with an
optional reason string.

### 3 — Workflow Execution & Scheduling
A **Workflows** panel providing:

- **Pipeline definition** — drag-to-reorder list of stages:
  `crawl-docs → crawl-jira → crawl-github → normalise → enrich → embed → upsert-lancedb`
- **Ad-hoc run** — "Run Now" button posts to `POST /api/workflows/run` with selected stages.
- **Schedule builder** — cron-style UI (minute/hour/day pickers) persisted to
  `POST /api/workflows/schedule`; shows next-run countdown.
- **Run history table** — lists past runs with status, duration, records processed, error count;
  links to log stream for each run.

### 4 — Plan-Mode Simulation Widget
A collapsible "dry-run" bar above any workflow or agent action.  When toggled on, execution calls
route to `POST /api/workflows/plan` which returns a structured diff:

```json
{
  "stages": [
    { "name": "crawl-jira", "records": 42, "new": 5, "updated": 12, "unchanged": 25 },
    ...
  ],
  "estimated_tokens": 18400,
  "estimated_cost_usd": 0.18
}
```

The widget renders a cost estimate card and per-stage breakdown table.  No real writes occur.

### 5 — Custom Agent Builder
A full-screen modal wizard (4 steps):

1. **Identity** — agent name, short description, role tag (planner / executor / reviewer /
   orchestrator).
2. **Persona** — rich-text editor that scaffolds into `SOUL.md` (tone, values, constraints).
3. **Skills** — multi-select from a capability registry + free-text additions; scaffolds
   `SKILLS.md`.
4. **Parallelization** — max concurrency slider, per-provider RPM/TPM caps (reads defaults from
   the OpenAI connection config), retry policy.

On **Create**, the builder:
- Writes `AGENTS.md`, `SOUL.md`, `SKILLS.md` into `agents/<name>/` via
  `POST /api/agents` (multipart).
- Registers the agent in the runtime registry.
- Navigates to the new agent's detail page.

### 6 — Agent / Sub-Agent Live Reporting
Every agent emits structured lifecycle events to `GET /api/agents/stream` (SSE):

```json
{ "agent": "jira-crawler", "run_id": "r-001", "event": "start", "ts": "..." }
{ "agent": "jira-crawler", "run_id": "r-001", "event": "progress", "pct": 42, "msg": "Fetched 18/42 issues" }
{ "agent": "jira-crawler", "run_id": "r-001", "event": "delay", "reason": "rate_limit", "retry_in_ms": 2000 }
{ "agent": "jira-crawler", "run_id": "r-001", "event": "finish", "status": "ok", "duration_ms": 12400 }
```

The **Agent Activity** pane (live feed + per-agent collapsible rows) consumes this stream.
Sub-agents appear as indented children under their parent agent row.

### 7 — Orchestrator Monitoring Team
A dedicated orchestrator tier (`OrchestratorAgent` class, backend) continuously monitors running
agents for:

- **Thrashing** — same record processed > N times within T seconds.
- **Token runaway** — TPM spike exceeds 2× budget baseline.
- **Stall** — agent emits no progress event for > 60 s.

When an anomaly is detected the orchestrator emits a `finding` event with severity
(`info / warn / critical`) and a recommended action.  A dedicated **Orchestrator Findings** panel
in the UI renders these findings in a table with `ACK` / `ESCALATE` / `STOP` actions per finding.

### 8 — Stop Controls
Stop controls are available at every level:

| Level | UI surface | API |
|---|---|---|
| Sub-agent | Agent activity row → ⏹ icon | `POST /api/agents/:run_id/stop` |
| Agent | Agent detail header | `POST /api/agents/:agent_name/stop` |
| Orchestrator | Orchestrator findings panel | `POST /api/orchestrators/:name/stop` |
| Workflow run | Workflow run history row | `POST /api/workflows/:run_id/stop` |

All stop calls are soft-stop by default (finish current task, then halt) with an optional
`?force=true` query param for immediate termination.

---

## Scope

### In scope
- All 8 feature areas listed above
- Backend API endpoints for connections, decisions, workflows, agents, orchestrators
- Tauri stronghold plugin integration for secure credential storage
- Zustand stores + React Query hooks for all new data domains
- Glass-design-system components reused throughout
- Unit tests for all new stores and API endpoints
- Integration tests for workflow execution and agent lifecycle

### Out of scope
- Full LLM-based orchestrator intelligence (heuristic rules only in v1)
- Mobile / web-only deployment (Tauri desktop only)
- Multi-user / team credential sharing

---

## Success Criteria
1. A user can add Jira/OpenAI/GitHub credentials entirely in-app with no `.env` edits.
2. A pending agent decision card appears within 500 ms of the backend emitting it.
3. A workflow can be scheduled, run, and stopped from the UI end-to-end.
4. The plan-mode widget shows cost estimate before any tokens are consumed.
5. A custom agent created in the builder appears in the agent registry within 2 s.
6. Agent live-feed latency (event emitted → UI rendered) < 200 ms on localhost.
7. Orchestrator correctly flags a thrashing simulation within 10 s.
8. Stop at every level halts execution within 3 s (soft) / 500 ms (force).

---

## Dependencies
- `tauri-glass-ui` change (must be merged first — provides shell, design system, all base panels)
- `@tauri-apps/plugin-stronghold` for OS keychain
- Backend: new `OrchestratorAgent`, `WorkflowScheduler`, `ConnectionManager` classes
- Existing: `ForgeModule`, `KBModule`, `LLMModule`, `RAGModule`, `PlanningModule`

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Stronghold plugin availability on Linux | Fallback to AES-encrypted file store in `$HOME/.overlord/credentials` |
| SSE fan-out performance under many agents | Implement per-client filter params; cap at 50 concurrent event sources |
| Agent stop signal not honoured by third-party libs | Wrap all external calls in `AbortController`; log unclean exits |
| Plan-mode cost estimates being inaccurate | Surface confidence range ±20 %; note it's an estimate in UI copy |

---

## Timeline Estimate
| Phase | Effort |
|---|---|
| Backend: connections + decisions API | 3 days |
| Backend: workflow engine + scheduler | 4 days |
| Backend: agent/orchestrator event bus | 3 days |
| UI: connection panels + agent builder | 3 days |
| UI: workflow + plan-mode panels | 3 days |
| UI: live feed + orchestrator findings | 2 days |
| UI: stop controls everywhere | 1 day |
| Tests + polish | 3 days |
| **Total** | **~22 days** |
