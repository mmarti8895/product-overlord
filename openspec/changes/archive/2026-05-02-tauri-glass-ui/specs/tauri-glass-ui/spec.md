## ADDED Requirements

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
