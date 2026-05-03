## ADDED Requirements

### Requirement: Connection setup panels for external services
The desktop UI SHALL provide dedicated connection panels for Jira, OpenAI, and GitHub. Each panel SHALL allow the user to enter credentials, save them via the OS keychain (Tauri Stronghold or encrypted fallback), and test connectivity with a live latency readout. The UI SHALL only display masked credential values after save.

#### Scenario: User saves and tests a Jira connection
- **WHEN** a user enters a Jira base URL, project key, and API token and clicks Save
- **THEN** the credentials SHALL be persisted via `ConnectionManager.save()` without logging secret values
- **AND** the Test button SHALL invoke `ConnectionManager.test()` and display `{ ok, message }` in the panel

#### Scenario: Masked credentials on load
- **WHEN** the ConnectionsPanel loads for a previously saved provider
- **THEN** all secret fields SHALL be displayed as `"***"` via `ConnectionManager.load()`
- **AND** raw credential values SHALL never appear in the UI or logs

---

### Requirement: Agent decision review drawer
The desktop UI SHALL provide a decision review drawer fed by `GET /api/decisions/stream` SSE. Each pending decision card SHALL display the agent name, run ID, decision type, full JSON diff, and Approve / Reject / Modify actions. Decisions SHALL queue in a Zustand store and remain visible until actioned.

#### Scenario: Approve a pending decision
- **WHEN** a user clicks Approve on a decision card
- **THEN** `DecisionQueue.approve(id)` SHALL be called synchronously
- **AND** the card SHALL be removed from the pending list within 500 ms

#### Scenario: Modify and resubmit a decision
- **WHEN** a user edits the JSON payload and clicks Modify
- **THEN** `DecisionQueue.modify(id, patch)` SHALL be called with the patched payload
- **AND** the decision status SHALL update to `modified` in the drawer

---

### Requirement: Workflow execution, plan mode, and scheduling
The WorkflowPanel SHALL allow users to select pipeline stages (crawl → normalise → embed → upsert), trigger a dry-run via `WorkflowEngine.plan()`, trigger a live run via `WorkflowEngine.run()`, and schedule recurrent runs via `WorkflowScheduler.upsert()`. Plan mode SHALL never write any data.

#### Scenario: Plan mode dry-run
- **WHEN** a user clicks Plan on the WorkflowPanel
- **THEN** `WorkflowEngine.plan(stages)` SHALL return `{ stages, estimated_tokens, estimated_cost_usd }` without executing any stage or mutating state

#### Scenario: Schedule a recurring workflow
- **WHEN** a user enters a valid cron expression and clicks Save Schedule
- **THEN** `WorkflowScheduler.upsert(schedule)` SHALL persist the schedule to `data/workflows/schedules.json`
- **AND** the cron job SHALL be registered immediately for enabled schedules

#### Scenario: Invalid cron expression rejected
- **WHEN** a user enters a syntactically invalid cron expression
- **THEN** the UI SHALL display a validation error before calling `WorkflowScheduler.upsert()`
- **AND** `CronValidationError` SHALL be thrown server-side if bypassed

---

### Requirement: Live agent activity panel with SSE reporting
The AgentActivityPanel SHALL display a live event feed from `GET /api/agents/events` (SSE). The panel SHALL show per-run progress, error, and done events filtered by run ID or agent ID. A Stop button SHALL be rendered per active run. A Stop All button in the TitleBar SHALL be visible whenever one or more runs are active.

#### Scenario: Live progress events displayed
- **WHEN** an agent run emits `emitProgress(runId, stage, pct)` on the AgentEventBus
- **THEN** the AgentActivityPanel SHALL update the matching run row's progress bar within one render cycle

#### Scenario: Stop a specific run
- **WHEN** a user clicks the Stop button for a run
- **THEN** `WorkflowEngine.stop(runId)` SHALL be called
- **AND** the running stage SHALL halt within 3 seconds

#### Scenario: Stop All from TitleBar
- **WHEN** a user clicks Stop All in the TitleBar
- **THEN** `useStopAllAgents()` SHALL iterate over all active run IDs and call `WorkflowEngine.stop()` for each
- **AND** the Stop All button SHALL only be visible when `agentActivityStore` has ≥ 1 active run

#### Scenario: SSE reconnect with Last-Event-ID
- **WHEN** the SSE connection to `/api/agents/events` drops and reconnects
- **THEN** the client SHALL send `Last-Event-ID` in the reconnect request
- **AND** the server SHALL replay buffered events from that ID forward

---

### Requirement: OrchestratorTeam watchdog findings panel
The OrchestratorFindingsPanel SHALL display findings from `GET /api/orchestrator/findings`. Each finding SHALL show the detection type (thrash, stall, or runaway), run ID, and severity. Users SHALL be able to acknowledge (`ack`) or escalate findings. The OrchestratorTeam SHALL never autonomously stop a run; stopping requires explicit user action.

#### Scenario: Thrash finding displayed and acknowledged
- **WHEN** the OrchestratorTeam emits a thrash finding (same stage repeating N times without progress)
- **THEN** the finding SHALL appear in OrchestratorFindingsPanel with `type: "thrash"` and the affected run ID
- **AND** clicking Ack SHALL call `OrchestratorTeam.ack(id)` and mark the finding resolved

#### Scenario: Escalate a stall finding to critical
- **WHEN** a user clicks Escalate on a stall finding
- **THEN** `OrchestratorTeam.escalate(id)` SHALL be called
- **AND** the finding severity SHALL update to `"critical"` in the panel

#### Scenario: OrchestratorTeam does not auto-stop runs
- **WHEN** any finding is emitted (thrash, stall, or runaway)
- **THEN** the OrchestratorTeam SHALL NOT call `WorkflowEngine.stop()` autonomously
- **AND** the finding SHALL remain advisory until a human clicks Stop on the affected run

---

### Requirement: Custom agent builder
The AgentBuilderModal SHALL allow users to define a new agent by entering name, description, role, persona, skills, concurrency, and rate caps. Submitting SHALL invoke `CustomAgentBuilder.build(draft)`, which writes `AGENTS.md`, `SOUL.md`, and `SKILLS.md` to `data/agents/<name>/` atomically.

#### Scenario: Build a new custom agent
- **WHEN** a user fills in all required fields in AgentBuilderModal and clicks Build
- **THEN** `CustomAgentBuilder.build(draft)` SHALL write all three files atomically to `data/agents/<slug>/`
- **AND** the modal SHALL close on success and the new agent SHALL appear in the AgentActivityPanel agent list

#### Scenario: Duplicate agent name rejected
- **WHEN** a user attempts to build an agent with a name that matches an existing agent slug
- **THEN** `AgentRegistry.register(def)` SHALL throw and the modal SHALL display a duplicate-name error without writing any files
