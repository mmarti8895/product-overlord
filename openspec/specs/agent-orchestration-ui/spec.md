# agent-orchestration-ui Specification

## Purpose
TBD - created by archiving change agent-orchestration-ui. Update Purpose after archive.
## Requirements
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

---

### Requirement: Glass design system tokens and primitives
The UI SHALL expose CSS custom properties for all design tokens (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow`, `--accent`, `--surface-1`, `--surface-2`, `--radius-panel`, `--radius-card`, `--radius-pill`, `--spring-duration`, `--spring-easing`) on `:root`, overridden by `[data-theme="dark"]`. The system SHALL fall back to a solid `--surface-1` surface on WebViews that do not support `backdrop-filter`. All spring animations SHALL be suppressed when `prefers-reduced-motion: reduce` is set.

#### Scenario: Dark theme tokens applied on OS dark mode
- **WHEN** the OS reports dark mode preference
- **THEN** `ThemeProvider` SHALL write `[data-theme="dark"]` on `<html>` so that `--glass-bg` resolves to `rgba(20,20,28,0.60)`

#### Scenario: backdrop-filter fallback on unsupported WebView
- **WHEN** the WebView does not support `backdrop-filter`
- **THEN** the `@supports not (backdrop-filter: blur(1px))` rule SHALL apply `background: var(--surface-1)` with full opacity to all glass components

#### Scenario: prefers-reduced-motion disables animations
- **WHEN** the OS has `prefers-reduced-motion: reduce` enabled
- **THEN** all animation and transition durations SHALL be forced to `0.01ms` via the media query in `glass.css`

---

### Requirement: Glass primitive components
The UI SHALL implement `GlassPanel`, `GlassCard`, `GlassButton`, `GlassBadge`, `GlassInput`, `GlassModal`, `GlassToast`, and `ScoreGauge` in `ui/src/components/glass/`. `GlassButton` SHALL have an accent glow on hover and a spring press animation. `GlassBadge` SHALL support colour variants: `ready` (green), `needs_clarification` (amber), `blocked` (red), `degraded` (orange), `ok` (blue). `ScoreGauge` SHALL animate its SVG arc via `framer-motion` `useSpring`.

#### Scenario: ScoreGauge animates to new score value
- **WHEN** the `score` prop of `ScoreGauge` changes from `0` to `75`
- **THEN** the SVG arc SHALL animate via `useSpring` to represent 75 % of the full arc circumference

#### Scenario: GlassBadge renders correct colour variant
- **WHEN** `<GlassBadge variant="blocked" />` is rendered
- **THEN** the element SHALL carry the red colour CSS class or variable

---

### Requirement: App shell — custom title bar and system tray
The Tauri window SHALL have `decorations: false` and render a custom `TitleBar` component with a `.drag-region` CSS class for window dragging. A system tray icon SHALL provide Show / Hide / Quit menu items. Selecting Quit SHALL kill the sidecar and call `app.exit(0)`.

#### Scenario: Window drag region present
- **WHEN** the app renders
- **THEN** an element with the `.drag-region` class SHALL be present in the TitleBar and carry `-webkit-app-region: drag`

#### Scenario: System tray Quit kills sidecar
- **WHEN** the user selects Quit from the tray menu
- **THEN** the sidecar child process SHALL be killed before the Tauri process exits

---

### Requirement: Hash router with animated panel transitions
All 17+ feature panels SHALL be accessible via `react-router-dom` hash routes rendered inside `MainContent`. Each route change SHALL trigger a spring entrance/exit via `framer-motion` `AnimatePresence`.

#### Scenario: All panel routes render without crash
- **WHEN** the app navigates to each registered hash route
- **THEN** the corresponding panel component SHALL render without throwing a React error

---

### Requirement: Typed API client with Bearer auth
`apiFetch<T>(path, init?)` in `ui/src/api/client.ts` SHALL read `serverUrl` and `authToken` from `settingsStore`, prepend the base URL, attach `Authorization: Bearer <token>` when a token is set, and return `Result<T, APIError>` where a non-2xx response maps to `{ ok: false, error: { status, message } }`.

#### Scenario: Auth header attached when token is set
- **WHEN** `settingsStore.authToken` is `"tok-abc"` and `apiFetch` is called
- **THEN** the outgoing request SHALL include the header `Authorization: Bearer tok-abc`

#### Scenario: Non-2xx response produces APIError
- **WHEN** the server returns HTTP 500
- **THEN** `apiFetch` SHALL resolve to `{ ok: false, error: { status: 500, message: "..." } }`

---

### Requirement: SSE metrics hook with auto-reconnect
`useMetricsStream` SHALL open an `EventSource` to `GET /api/metrics`, parse each `data:` line as JSON, call `logStore.append()`, and automatically reconnect after a connection drop.

#### Scenario: Events appended to logStore
- **WHEN** the server sends `data: {"type":"forge_action"}\n\n`
- **THEN** `logStore.append()` SHALL be called with the parsed event object

---

### Requirement: GET /api/status endpoint
The server SHALL expose `GET /api/status` returning `{ server, version, shadow_mode, degraded_flags, uptime_ms }` when `UI_DEV_ENDPOINTS=true` (default). The route SHALL return 404 when `UI_DEV_ENDPOINTS=false`.

#### Scenario: Status endpoint returns server info
- **WHEN** `GET /api/status` is called with `UI_DEV_ENDPOINTS=true`
- **THEN** the response SHALL be HTTP 200 with `server: "product-overlord"` and a numeric `uptime_ms`

#### Scenario: Status endpoint gated by flag
- **WHEN** `UI_DEV_ENDPOINTS=false`
- **THEN** `GET /api/status` SHALL return HTTP 404

---

### Requirement: GET /api/config with credential redaction
The server SHALL expose `GET /api/config` returning a sanitised `ServerConfig` where all credential fields are replaced with `"[set]"` or `"[not set]"`. The route is gated by `UI_DEV_ENDPOINTS`.

#### Scenario: Credential fields are redacted
- **WHEN** `JIRA_ACCESS_TOKEN` is set and `GET /api/config` is called
- **THEN** `jiraAccessToken` in the response SHALL be `"[set]"` not the raw token value

---

### Requirement: GET /api/metrics SSE fan-out with heartbeat
The server SHALL expose `GET /api/metrics` as a `text/event-stream` endpoint. Calls to `forgeInstrumentation.recordLLMCall()`, `recordRAGRetrieval()`, and `recordAction()` SHALL fan out `data:` events to all connected clients. A heartbeat event SHALL be sent every 15 seconds. `forgeInstrumentation.reset()` SHALL clear all SSE subscribers.

#### Scenario: LLM call event fanned out to connected client
- **WHEN** `forgeInstrumentation.recordLLMCall(...)` is called with a client connected to `GET /api/metrics`
- **THEN** the client SHALL receive a `data:` line containing `"type":"llm_call"`

#### Scenario: reset clears SSE subscriber list
- **WHEN** `forgeInstrumentation.reset()` is called
- **THEN** all registered SSE subscriber callbacks SHALL be removed

---

### Requirement: Tauri sidecar spawn and graceful teardown
The Tauri Rust host SHALL spawn `product-overlord-server` as a sidecar on app launch, passing `PORT` and `BASE_URL` env vars. On `WindowEvent::Destroyed` the host SHALL call `child.kill()` to terminate the sidecar.

#### Scenario: Sidecar starts and serves /health
- **WHEN** the Tauri app launches
- **THEN** the sidecar SHALL be spawned and `GET /health` SHALL return HTTP 200 within 5 seconds

#### Scenario: Sidecar killed on window close
- **WHEN** the last Tauri window is destroyed
- **THEN** the sidecar child process SHALL be killed via `child.kill()`

---

### Requirement: Port conflict detection
If port 3000 is occupied, the Rust host SHALL call `find_free_port(3000)` to locate the next available TCP port, set `OVERLORD_PORT` in the process environment, and pass `PORT=<port>` to the sidecar.

#### Scenario: Next free port used when 3000 is busy
- **WHEN** port 3000 is already bound at app launch
- **THEN** the sidecar SHALL be launched on a different port and `OVERLORD_PORT` SHALL reflect that port

---

### Requirement: recordUIAction analytics counters
`forgeInstrumentation.recordUIAction(panel, action)` SHALL increment an internal counter keyed by `"<panel>:<action>"`. `getUIActionCounters()` SHALL return a snapshot of all counters. `reset()` SHALL clear all counters.

#### Scenario: Panel open counter increments
- **WHEN** `recordUIAction("IngestionPanel", "open")` is called twice
- **THEN** `getUIActionCounters()["IngestionPanel:open"]` SHALL equal `2`

#### Scenario: reset clears UI action counters
- **WHEN** `forgeInstrumentation.reset()` is called
- **THEN** `getUIActionCounters()` SHALL return an empty object

