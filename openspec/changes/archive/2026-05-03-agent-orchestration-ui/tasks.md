# Tasks: Agent Orchestration & Workflow UI Expansion

## Change ID
`agent-orchestration-ui`

> Legend: tasks are grouped by feature area, then by backend / frontend / tests.
> All tasks are unchecked at proposal time.

---

## 0 — Foundation & Scaffolding

- [x] **0.1** Install new backend dependencies: `node-cron`, `@node-rs/argon2` (key derivation), `zod` (if not present)
- [x] **0.2** Install new UI dependencies: `@dnd-kit/core`, `@dnd-kit/sortable`, `react-json-view-lite`, `@tauri-apps/plugin-stronghold`
- [x] **0.3** Add `@tauri-apps/plugin-stronghold` to `src-tauri/Cargo.toml` and register in `main.rs`
- [x] **0.4** Add stronghold fallback: `src/connections/SecretStore.ts` (AES-256-GCM file-based store for non-Tauri environments)
- [x] **0.5** Extend `ui/src/components/layout/Sidebar.tsx` with three new sidebar groups: **Connections**, **Workflows**, **Agents**
- [x] **0.6** Register all new panel routes in `ui/src/App.tsx`

---

## 1 — Connection Manager (Backend)

- [x] **1.1** Create `src/connections/ConnectionManager.ts` with `save`, `load`, `loadRaw`, `test` methods
- [x] **1.2** Create `src/connections/providers/JiraProvider.ts` — probe call to `GET /rest/api/3/myself`
- [x] **1.3** Create `src/connections/providers/OpenAIProvider.ts` — probe call to `GET /v1/models`
- [x] **1.4** Create `src/connections/providers/GitHubProvider.ts` — probe call to `GET /user` or `GET /app`
- [x] **1.5** Add Express routes: `GET /api/connections/:provider`, `POST /api/connections/:provider`, `POST /api/connections/:provider/test`
- [x] **1.6** Validate request bodies with Zod schemas for each provider

---

## 2 — Connection UI Panels (Frontend)

- [x] **2.1** Create `ui/src/stores/connectionsStore.ts` (masked configs, test results, loading states)
- [x] **2.2** Create `ui/src/api/queries/connectionHooks.ts` (`useConnections`, `useSaveConnection`, `useTestConnection`)
- [x] **2.3** Create `ui/src/panels/ConnectionsPanel.tsx` (tab container with provider tabs)
- [x] **2.4** Create `ui/src/panels/connections/JiraConnectionTab.tsx` (form, test button, status badge)
- [x] **2.5** Create `ui/src/panels/connections/OpenAIConnectionTab.tsx` (form including model selectors + budget caps)
- [x] **2.6** Create `ui/src/panels/connections/GitHubConnectionTab.tsx` (PAT / GitHub App toggle, repos list)
- [x] **2.7** Connection status badge component (`ui/src/components/glass/ConnectionBadge.tsx`): idle / testing / ok / error states

---

## 3 — Decision Review (Backend)

- [x] **3.1** Create `src/decisions/DecisionQueue.ts` (in-memory ring buffer, SSE broadcast, Promise gating)
- [x] **3.2** Create `src/decisions/DecisionGateway.ts` (approve / reject / modify handlers, patch schema validation)
- [x] **3.3** Add Express routes: `GET /api/decisions/stream`, `GET /api/decisions`, `POST /api/decisions/:id/approve`, `POST /api/decisions/:id/reject`, `POST /api/decisions/:id/modify`
- [x] **3.4** Export `DecisionQueue` singleton; import and call `enqueue()` from at least one existing agent module as a demonstration

---

## 4 — Decision Review UI (Frontend)

- [x] **4.1** Create `ui/src/stores/decisionsStore.ts` (pending queue, history, stream hook)
- [x] **4.2** Create `ui/src/api/queries/decisionHooks.ts` (`useDecisionsStream`, `useApproveDecision`, `useRejectDecision`, `useModifyDecision`)
- [x] **4.3** Create `ui/src/panels/DecisionReviewDrawer.tsx` (slide-over, framer-motion animation)
- [x] **4.4** Create `DecisionCard.tsx` sub-component (agent header, type chip, JSON diff viewer, action footer)
- [x] **4.5** Add pending-count badge to Agents sidebar group header
- [x] **4.6** Wire "Modify" action: inline JSON editor → `useModifyDecision` mutation

---

## 5 — Workflow Engine (Backend)

- [x] **5.1** Create `src/workflows/WorkflowEngine.ts` (stage runner, AbortController threading, progress event emission)
- [x] **5.2** Create `src/workflows/stages/CrawlDocsStage.ts`
- [x] **5.3** Create `src/workflows/stages/CrawlJiraStage.ts` (uses `ConnectionManager.loadRaw('jira')`)
- [x] **5.4** Create `src/workflows/stages/CrawlGitHubStage.ts` (uses `ConnectionManager.loadRaw('github')`)
- [x] **5.5** Create `src/workflows/stages/NormaliseStage.ts`
- [x] **5.6** Create `src/workflows/stages/EnrichStage.ts`
- [x] **5.7** Create `src/workflows/stages/EmbedStage.ts` (uses `ConnectionManager.loadRaw('openai')`)
- [x] **5.8** Create `src/workflows/stages/UpsertLanceDBStage.ts`
- [x] **5.9** Create `src/workflows/WorkflowScheduler.ts` (`node-cron` wrapper, schedule CRUD, `data/workflows/schedules.json` persistence)
- [x] **5.10** Implement plan-mode dry-run in `WorkflowEngine.plan()` — return stage diff + token + cost estimate
- [x] **5.11** Add Express routes: `GET /api/workflows/schedules`, `POST /api/workflows/schedules`, `DELETE /api/workflows/schedules/:id`, `POST /api/workflows/run`, `POST /api/workflows/plan`, `GET /api/workflows/runs`, `GET /api/workflows/runs/:run_id/logs` (SSE), `POST /api/workflows/:run_id/stop`

---

## 6 — Workflow UI (Frontend)

- [x] **6.1** Create `ui/src/stores/workflowStore.ts` (runs, schedules, planResult, activeRunId)
- [x] **6.2** Create `ui/src/api/queries/workflowHooks.ts` (`useWorkflowRuns`, `useRunWorkflow`, `usePlanWorkflow`, `useWorkflowSchedules`, `useSaveSchedule`, `useDeleteSchedule`, `useStopWorkflow`, `useWorkflowLogs`)
- [x] **6.3** Create `ui/src/panels/WorkflowPanel.tsx` (stage list, plan toggle, run/schedule buttons)
- [x] **6.4** Create `ui/src/panels/workflow/StageList.tsx` (drag-to-reorder via `@dnd-kit/sortable`)
- [x] **6.5** Create `ui/src/panels/workflow/PlanResultCard.tsx` (cost estimate chip, per-stage table, Proceed/Cancel)
- [x] **6.6** Create `ui/src/panels/workflow/ScheduleBuilder.tsx` (cron picker UI, next-run countdown)
- [x] **6.7** Create `ui/src/panels/workflow/WorkflowRunHistory.tsx` (status chip, duration, records, stop button, log stream link)
- [x] **6.8** Create `ui/src/panels/workflow/WorkflowLogDrawer.tsx` (SSE log tail for a single run)

---

## 7 — Agent Event Bus (Backend)

- [x] **7.1** Create `src/agents/AgentEventBus.ts` (singleton, ring buffer 2000, SSE fan-out, `?agent=` filter)
- [x] **7.2** Create `src/agents/AgentRegistry.ts` (register, deregister, lookup by name/run_id, AbortController map)
- [x] **7.3** Create `src/agents/CustomAgentBuilder.ts` (generate AGENTS.md, SOUL.md, SKILLS.md from spec; write to `agents/<name>/`)
- [x] **7.4** Create capability registry JSON (`data/agents/capabilities.json`) with initial set from existing modules
- [x] **7.5** Add Express routes: `GET /api/agents`, `POST /api/agents` (multipart), `GET /api/agents/:name`, `GET /api/agents/stream` (SSE), `POST /api/agents/:run_id/stop`, `POST /api/agents/:name/stop`
- [x] **7.6** Instrument at least one existing module (e.g. `ForgeModule`) to emit `start` / `progress` / `finish` events via `AgentEventBus`

---

## 8 — Agent Activity UI (Frontend)

- [x] **8.1** Create `ui/src/stores/agentActivityStore.ts` (ring buffer 2000, activeAgents map, parentage index)
- [x] **8.2** Create `ui/src/api/queries/agentHooks.ts` (all 17 hooks listed in design)
- [x] **8.3** Create `ui/src/panels/AgentActivityPanel.tsx` (live feed, filter input, collapsible rows)
- [x] **8.4** Create `ui/src/panels/agents/AgentRow.tsx` (progress bar, delay badge, stop button, sub-agent indent)
- [x] **8.5** Create `ui/src/panels/agents/AgentStatusChip.tsx` (running / delayed / finished / stopped / error)
- [x] **8.6** Implement SSE reconnect with exponential backoff in `useAgentStream` hook (max 30 s)

---

## 9 — Custom Agent Builder UI (Frontend)

- [x] **9.1** Create `ui/src/panels/AgentBuilderModal.tsx` (4-step GlassModal wizard shell)
- [x] **9.2** Implement Step 1 — Identity (name, description, role tag)
- [x] **9.3** Implement Step 2 — Persona (textarea + markdown preview → SOUL.md scaffold preview)
- [x] **9.4** Implement Step 3 — Skills (multi-select from capability registry + free-text chip input)
- [x] **9.5** Implement Step 4 — Parallelization (concurrency slider, RPM/TPM caps from OpenAI config, retry policy radio)
- [x] **9.6** File tree preview panel (right side of modal) — shows generated AGENTS.md, SOUL.md, SKILLS.md content
- [x] **9.7** Wire "Create Agent" to `useCreateAgent()` mutation; show success toast; navigate to agent detail

---

## 10 — Orchestrator Monitoring (Backend)

- [x] **10.1** Create `src/orchestrators/monitors/ThrashDetector.ts`
- [x] **10.2** Create `src/orchestrators/monitors/RunawayTokenDetector.ts`
- [x] **10.3** Create `src/orchestrators/monitors/StallDetector.ts`
- [x] **10.4** Create `src/orchestrators/OrchestratorTeam.ts` (5 s tick, wires all three monitors, emits `finding` events, writes to `data/orchestrators/findings.jsonl`)
- [x] **10.5** Add Express routes: `GET /api/orchestrators/findings`, `POST /api/orchestrators/findings/:id/ack`, `POST /api/orchestrators/findings/:id/escalate`, `POST /api/orchestrators/:name/stop`
- [x] **10.6** Auto-start `OrchestratorTeam` singleton when server starts

---

## 11 — Orchestrator Findings UI (Frontend)

- [x] **11.1** Create `ui/src/stores/orchestratorStore.ts` (findings list, unread count)
- [x] **11.2** Add orchestrator finding hooks to `agentHooks.ts` (`useOrchestratorFindings`, `useAckFinding`, `useEscalateFinding`, `useStopOrchestrator`)
- [x] **11.3** Create `ui/src/panels/OrchestratorFindingsPanel.tsx` (table, summary bar)
- [x] **11.4** Create `ui/src/panels/orchestrator/FindingRow.tsx` (severity badge, ACK/Escalate/Stop actions)
- [x] **11.5** Add unread-findings badge to Agents sidebar group header (alongside pending-decisions badge)

---

## 12 — Stop Controls (Integration)

- [x] **12.1** Verify `POST /api/agents/:run_id/stop` correctly triggers `AbortController.abort()` in all instrumented modules
- [x] **12.2** Verify `POST /api/workflows/:run_id/stop` propagates abort to all active stages
- [x] **12.3** Add stop button to every `AgentRow` in `AgentActivityPanel`
- [x] **12.4** Add stop button to in-progress `WorkflowRunHistory` rows
- [x] **12.5** Add stop action to `OrchestratorFindingsPanel` findings rows
- [x] **12.6** Add global "Stop All" button in `TitleBar` (visible only when ≥1 active run exists)
- [x] **12.7** Implement `POST /api/agents/stop-all` endpoint

---

## 13 — Tests

- [x] **13.1** Unit tests for `ConnectionManager` (mock provider, save/load/mask round-trip)
- [x] **13.2** Unit tests for `DecisionQueue` (enqueue, approve, reject, ring eviction)
- [x] **13.3** Unit tests for `WorkflowEngine` (stage sequencing, abort propagation, plan-mode output)
- [x] **13.4** Unit tests for `WorkflowScheduler` (schedule CRUD, next-run calculation)
- [x] **13.5** Unit tests for `AgentEventBus` (publish, subscribe, ring buffer, SSE filter)
- [x] **13.6** Unit tests for `OrchestratorTeam` monitors (inject mock events, assert findings emitted)
- [x] **13.7** Unit tests for `CustomAgentBuilder` (assert correct AGENTS.md/SOUL.md/SKILLS.md content generated)
- [x] **13.8** UI unit tests for `ConnectionsPanel` (save + test interaction)
- [x] **13.9** UI unit tests for `DecisionReviewDrawer` (approve / reject / modify flows)
- [x] **13.10** UI unit tests for `AgentBuilderModal` (step navigation, validation, submit)
- [x] **13.11** UI unit tests for `WorkflowPanel` (plan toggle, run, stop)
- [x] **13.12** Integration test: full pipeline `crawl-jira → normalise → embed → upsert` with mock Jira + mock OpenAI
- [x] **13.13** Integration test: stop workflow mid-run; assert all stages halt within 3 s
- [x] **13.14** Integration test: thrash detection — inject >N repeated events; assert finding emitted within 2 ticks

---

## 14 — Documentation & Polish

- [x] **14.1** Update `AGENTS.md` with `OrchestratorTeam`, `WorkflowEngine`, `ConnectionManager` entries
- [x] **14.2** Update `ui/README.md` with new panels, stores, and SSE hooks
- [x] **14.3** Update `.env.example` with `CREDENTIAL_STORE_PATH`, `ORCHESTRATOR_THRASH_THRESHOLD`, `ORCHESTRATOR_STALL_TIMEOUT_S`
- [x] **14.4** Update root `README.md` "Desktop UI" section with new feature list
- [x] **14.5** Accessibility audit for new panels (keyboard navigation, ARIA labels, focus trapping in modals/drawers)
- [x] **14.6** Add `PLATFORM_NOTES.md` entry for stronghold vs. file-based credential store selection logic
