# Design: Agent Orchestration & Workflow UI Expansion

## Change ID
`agent-orchestration-ui`

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Tauri Desktop (ui/)                                            │
│                                                                 │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐ │
│  │  Connections│  │  Agent Activity  │  │ Orchestrator      │ │
│  │  Panel      │  │  Feed (SSE)      │  │ Findings Panel    │ │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬──────────┘ │
│         │                  │                      │            │
│  ┌──────┴──────────────────┴──────────────────────┴──────────┐ │
│  │            React Query + Zustand stores layer             │ │
│  └──────────────────────────┬────────────────────────────────┘ │
│                             │ Tauri invoke / HTTP fetch        │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Express Backend (src/server/)                                  │
│                                                                 │
│  /api/connections/:provider   ConnectionManager                │
│  /api/decisions/stream        DecisionQueue (SSE)              │
│  /api/decisions/:id/*         DecisionGateway                  │
│  /api/workflows/*             WorkflowEngine + Scheduler       │
│  /api/agents/*                AgentRegistry + EventBus (SSE)  │
│  /api/orchestrators/*         OrchestratorTeam                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Design

### 2.1 ConnectionManager (`src/connections/ConnectionManager.ts`)

```typescript
interface ProviderConfig {
  jira:   { baseUrl: string; projectKey: string; token: string }
  openai: { apiKey: string; orgId?: string; baseUrl?: string;
            plannerModel: string; executorModel: string; reviewerModel: string;
            tpmBudget: number; rpmBudget: number }
  github: { pat?: string; appId?: string; privateKey?: string;
            repos: string[]; branchFilter: string }
}
```

- `save(provider, config)` — encrypts token fields using OS keychain (Tauri stronghold on
  desktop, AES-256-GCM file fallback for CLI).
- `load(provider)` — returns config with token fields masked (`***`).
- `loadRaw(provider)` — returns config with real token (server-side only, never sent to UI).
- `test(provider)` — makes a cheap probe call and returns `{ ok, latency_ms, error? }`.

Routes:
```
GET    /api/connections/:provider         → masked config
POST   /api/connections/:provider         → save + optional test
POST   /api/connections/:provider/test    → test only
```

### 2.2 DecisionQueue (`src/decisions/DecisionQueue.ts`)

```typescript
interface Decision {
  id: string
  agent: string
  run_id: string
  type: string          // e.g. "UPSERT_TICKET"
  payload: unknown      // full context / diff
  requires_review: true
  created_at: string
  status: 'pending' | 'approved' | 'rejected' | 'modified'
}
```

- In-memory queue (Map) with `maxSize=500`, oldest-first eviction.
- Emits SSE events on `GET /api/decisions/stream`.
- `approve(id)`, `reject(id, reason)`, `modify(id, patch)` → updates status, broadcasts update
  event, resolves the pending `Promise` the agent is blocking on.

### 2.3 WorkflowEngine (`src/workflows/WorkflowEngine.ts`)

Stage pipeline (each stage is a `WorkflowStage` implementing `run(ctx, signal)`):

```
crawl-docs  →  crawl-jira  →  crawl-github
     └──────────────┴──────────────┘
                    ↓
              normalise  →  enrich  →  embed  →  upsert-lancedb
```

- Stages run sequentially by default; `parallel: true` flag enables concurrent execution of the
  crawl group.
- `AbortController` signal threaded through every stage for soft-stop support.
- Emits progress events to `AgentEventBus` so the UI live feed reflects workflow progress.

**WorkflowScheduler** wraps `node-cron` and stores schedule definitions in
`data/workflows/schedules.json`.

Routes:
```
GET    /api/workflows/schedules           → list schedules
POST   /api/workflows/schedules           → create/update schedule
DELETE /api/workflows/schedules/:id       → delete schedule
POST   /api/workflows/run                 → ad-hoc run
POST   /api/workflows/plan                → dry-run, returns diff + cost estimate
GET    /api/workflows/runs                → run history
GET    /api/workflows/runs/:run_id/logs   → SSE log stream for a run
POST   /api/workflows/:run_id/stop        → soft stop (force=true for hard)
```

### 2.4 AgentEventBus (`src/agents/AgentEventBus.ts`)

Singleton pub-sub bus:

```typescript
type AgentEvent =
  | { event: 'start';    agent: string; run_id: string; parent_run_id?: string; ts: string }
  | { event: 'progress'; agent: string; run_id: string; pct: number; msg: string; ts: string }
  | { event: 'delay';    agent: string; run_id: string; reason: string; retry_in_ms: number; ts: string }
  | { event: 'finish';   agent: string; run_id: string; status: 'ok'|'error'|'stopped'; duration_ms: number; ts: string }
  | { event: 'decision'; agent: string; run_id: string; decision_id: string; ts: string }
  | { event: 'finding';  agent: string; run_id: string; severity: 'info'|'warn'|'critical'; message: string; ts: string }
```

- Ring buffer (last 2000 events) for late-join clients.
- `GET /api/agents/stream` → SSE with optional `?agent=` filter.
- `AgentRegistry` tracks active agents + their current `AbortController`.

Routes:
```
GET  /api/agents                         → list all known agents
POST /api/agents                         → create custom agent (multipart: AGENTS.md, SOUL.md, SKILLS.md)
GET  /api/agents/:name                   → agent detail
POST /api/agents/:run_id/stop            → stop sub-agent run
POST /api/agents/:name/stop              → stop all runs for agent
GET  /api/agents/stream                  → SSE event bus
```

### 2.5 OrchestratorTeam (`src/orchestrators/OrchestratorTeam.ts`)

Three heuristic monitors running on a 5 s tick:

| Monitor | Detection logic |
|---|---|
| ThrashDetector | `eventCount(agent, run_id, window=30s) > threshold` |
| RunawayTokenDetector | rolling TPM > `2 × budget baseline` |
| StallDetector | `now - lastProgressEvent(agent, run_id) > 60s` |

Findings are emitted as `finding` events on the AgentEventBus and also written to
`data/orchestrators/findings.jsonl`.

Routes:
```
GET  /api/orchestrators/findings         → paginated findings list
POST /api/orchestrators/findings/:id/ack → acknowledge
POST /api/orchestrators/findings/:id/escalate
POST /api/orchestrators/:name/stop
```

---

## 3. Frontend Design

### 3.1 New Sidebar Groups & Panels

```
Connections  (new group)
  ├── Jira
  ├── OpenAI
  └── GitHub

Workflows    (new group)
  ├── Pipeline
  └── Schedule

Agents       (new group — replaces old Forge panel shortcut)
  ├── Activity Feed
  ├── Decision Review
  └── Orchestrator Findings

Agent Builder  (modal, launched from Agents group header button)
```

### 3.2 New Zustand Stores

| Store | Key state |
|---|---|
| `connectionsStore` | `configs: Record<Provider, MaskedConfig>`, `testResults` |
| `decisionsStore` | `pending: Decision[]`, `history: Decision[]` |
| `workflowStore` | `runs: WorkflowRun[]`, `schedules: Schedule[]`, `planResult` |
| `agentActivityStore` | `events: AgentEvent[]` (ring 2000), `activeAgents: Map` |
| `orchestratorStore` | `findings: Finding[]` |

### 3.3 New React Query Hooks (`ui/src/api/queries/agentHooks.ts`)

```typescript
useConnections(provider)
useSaveConnection(provider)
useTestConnection(provider)
useDecisionsStream()       // SSE → decisionsStore
useApproveDecision()
useRejectDecision()
useWorkflowRuns()
useRunWorkflow()
usePlanWorkflow()
useWorkflowSchedules()
useSaveSchedule()
useAgents()
useCreateAgent()
useStopAgent()
useAgentStream()           // SSE → agentActivityStore
useOrchestratorFindings()
useAckFinding()
useStopOrchestrator()
```

### 3.4 New Panel Components

#### `ConnectionsPanel.tsx` (shared wrapper with tab per provider)
- `JiraConnectionTab.tsx`
- `OpenAIConnectionTab.tsx`
- `GitHubConnectionTab.tsx`

Each tab: form fields → masked display on load → edit mode on "Edit" click → "Test" button →
"Save" button. Connection status badge (green tick / red cross / latency ms).

#### `WorkflowPanel.tsx`
- Stage list (drag-to-reorder via `@dnd-kit/sortable`).
- Plan-mode toggle bar at top (renders `PlanResultCard` when plan data available).
- "Run Now" / "Schedule" action buttons.
- `WorkflowRunHistory` table (status chip, duration, records, stop button for in-progress runs).

#### `PlanResultCard.tsx`
- Cost estimate chip (USD, ±20% note).
- Per-stage breakdown: name, records new/updated/unchanged, token estimate.
- "Proceed" / "Cancel" action buttons.

#### `AgentActivityPanel.tsx`
- Live SSE feed via `useAgentStream()`.
- Collapsible rows per `(agent, run_id)` pair; sub-agents indented under parent.
- Per-row: progress bar for `progress` events, delay badge for `rate_limit`, stop button.
- Search/filter input.

#### `DecisionReviewDrawer.tsx`
- Slide-over from right edge (`framer-motion` translateX animation).
- Badge on Agents group header shows pending count.
- Decision card: agent + run ID header, type chip, JSON diff viewer (`react-json-view-lite`),
  Approve / Reject / Modify footer.

#### `OrchestratorFindingsPanel.tsx`
- Findings table: severity badge, agent, message, timestamp.
- Row actions: ACK, Escalate, Stop Agent.
- Summary bar: critical count, warn count, acknowledged count.

#### `AgentBuilderModal.tsx`
- 4-step `GlassModal` wizard.
- Step 1 — Identity: name input, description textarea, role selector.
- Step 2 — Persona: rich-text (`textarea` + preview markdown) → `SOUL.md` preview panel.
- Step 3 — Skills: multi-select checkboxes from capability registry + free-text chip input.
- Step 4 — Parallelization: concurrency slider (1–20), RPM/TPM cap inputs (pre-filled from
  OpenAI connection config), retry policy radio (none / exponential / fixed).
- Preview shows generated file tree on right panel.
- "Create Agent" → `useCreateAgent()` mutation → success toast → close modal.

---

## 4. Data Flow Diagrams

### Decision Review Flow
```
Agent backend
  │  emits Decision {requires_review:true}
  ▼
DecisionQueue.enqueue()
  │  broadcasts SSE
  ▼
/api/decisions/stream  ──SSE──►  decisionsStore.addPending()
                                        │
                                        ▼
                               DecisionReviewDrawer card
                                        │
                          ┌─────────────┼──────────────┐
                          ▼             ▼              ▼
                      Approve        Reject         Modify
                          │             │              │
                          └─────────────┴──────────────┘
                                        │
                                 POST /api/decisions/:id/*
                                        │
                                        ▼
                          DecisionQueue resolves Promise
                                        │
                                 Agent continues / aborts
```

### Workflow Stop Flow
```
User clicks Stop (workflow run row)
  │
POST /api/workflows/:run_id/stop
  │
WorkflowEngine.stop(run_id)
  │  calls AbortController.abort()
  ▼
Stage.run(ctx, signal) checks signal.aborted → throws AbortError
  │
WorkflowEngine catches → emits finish { status: 'stopped' }
  │
AgentEventBus broadcasts
  │
agentActivityStore.update() → UI row shows "stopped" chip
```

---

## 5. File Structure (new files only)

```
src/
  connections/
    ConnectionManager.ts
    providers/JiraProvider.ts
    providers/OpenAIProvider.ts
    providers/GitHubProvider.ts
  decisions/
    DecisionQueue.ts
    DecisionGateway.ts
  workflows/
    WorkflowEngine.ts
    WorkflowScheduler.ts
    stages/CrawlDocsStage.ts
    stages/CrawlJiraStage.ts
    stages/CrawlGitHubStage.ts
    stages/NormaliseStage.ts
    stages/EnrichStage.ts
    stages/EmbedStage.ts
    stages/UpsertLanceDBStage.ts
  agents/
    AgentEventBus.ts
    AgentRegistry.ts
    CustomAgentBuilder.ts
  orchestrators/
    OrchestratorTeam.ts
    monitors/ThrashDetector.ts
    monitors/RunawayTokenDetector.ts
    monitors/StallDetector.ts

ui/src/
  panels/
    ConnectionsPanel.tsx
    WorkflowPanel.tsx
    AgentActivityPanel.tsx
    DecisionReviewDrawer.tsx
    OrchestratorFindingsPanel.tsx
    AgentBuilderModal.tsx
    PlanResultCard.tsx
  stores/
    connectionsStore.ts
    decisionsStore.ts
    workflowStore.ts
    agentActivityStore.ts
    orchestratorStore.ts
  api/queries/
    agentHooks.ts
```

---

## 6. Security Considerations

- Credentials are never transmitted as plain text to the UI; token fields always masked.
- `loadRaw(provider)` is a server-side-only call; no Express route exposes raw secrets.
- Tauri `allowlist` restricts `invoke` commands to declared commands only.
- Decision `modify` action only allows patching a pre-defined `patch_schema`; free-form JSON
  injection is rejected by backend validation.

---

## 7. Performance Targets

| Metric | Target |
|---|---|
| Decision card render latency (event → UI) | < 200 ms |
| Agent activity feed update rate | up to 20 events/s without frame drops |
| Workflow plan endpoint response time | < 3 s for standard pipeline |
| Stop signal propagation (soft) | < 3 s |
| Stop signal propagation (force) | < 500 ms |
| SSE reconnect on disconnect | < 2 s (exponential backoff, max 30 s) |
