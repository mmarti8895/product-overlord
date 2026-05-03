# Tasks: tauri-glass-ui

## 1. Workspace & Tooling Setup

- [x] 1.1 Scaffold Tauri 2 app: `npm create tauri-app@latest ui -- --template react-ts` inside repo root; commit `ui/` skeleton
- [x] 1.2 Configure Vite in `ui/vite.config.ts`: proxy `/forge/*`, `/kb/*`, `/api/*` to `localhost:3000` in dev mode
- [x] 1.3 Install UI runtime deps: `@tauri-apps/api`, `@tanstack/react-query`, `framer-motion`, `zustand`, `react-window`, `clsx`, `tailwindcss`, `autoprefixer`, `postcss`
- [x] 1.4 Configure Tailwind with glass-utility classes; set `content` paths to cover all `ui/src/**`
- [x] 1.5 Add `ui:dev`, `ui:build`, `ui:test`, `build:server` scripts to root `package.json`
- [x] 1.6 Add Tauri build matrix to `.github/workflows/ci.yml`: macOS 14, ubuntu-22.04, windows-2022; upload artifacts per platform
- [x] 1.7 Update `.gitignore`: add `ui/dist/`, `ui/src-tauri/target/`

## 2. Glass Design System (`ui/src/theme/` + `ui/src/components/glass/`)

- [x] 2.1 Create `ui/src/theme/tokens.css` — all CSS custom properties (see design.md); dark/light adaptive via `prefers-color-scheme` + `[data-theme]` override
- [x] 2.2 Create `ui/src/theme/glass.css` — `backdrop-filter` utilities + `@supports` fallback for solid surface
- [x] 2.3 Implement `GlassPanel` component — frosted panel with border, shadow, radius
- [x] 2.4 Implement `GlassCard` — inset card variant
- [x] 2.5 Implement `GlassButton` — pill button; accent glow on hover; spring press animation via `framer-motion`
- [x] 2.6 Implement `GlassBadge` — verdict/status pill; colour variants: `ready` (green), `needs_clarification` (amber), `blocked` (red), `degraded` (orange), `ok` (blue)
- [x] 2.7 Implement `GlassInput` — frosted text input with floating label animation
- [x] 2.8 Implement `GlassModal` — centred overlay; spring entrance/exit via `framer-motion`; trap focus
- [x] 2.9 Implement `GlassToast` — bottom-right notification stack; `zustand` toast store; auto-dismiss 4 s
- [x] 2.10 Implement `ScoreGauge` — SVG arc, 0–100, `framer-motion` `useSpring` for animated value
- [x] 2.11 Unit tests for all glass primitives (render, dark/light token application, animation class presence)

## 3. App Shell & Layout (`ui/src/components/layout/`)

- [x] 3.1 Implement `TitleBar` — custom draggable bar; macOS traffic-light window controls via Tauri `window` API; app name + version
- [x] 3.2 Implement `Sidebar` — icon-only nav (17 panels); active indicator with spring slide; tooltips on hover; collapsible
- [x] 3.3 Implement `MainContent` — panel router using `react-router-dom` (hash router for Tauri); spring page transitions
- [x] 3.4 Implement `ThemeProvider` — reads OS preference; exposes `useTheme()` toggle hook; writes `[data-theme]` on `<html>`
- [x] 3.5 Implement system tray icon + context menu (Show / Hide / Quit) via Tauri `tray` API
- [x] 3.6 Implement Tauri auto-updater flow — check on launch; GlassModal with release notes + install button
- [x] 3.7 Layout integration test — all 17 panel routes render without crash; sidebar navigation works

## 4. API Client & State (`ui/src/api/` + `ui/src/stores/`)

- [x] 4.1 Create `ui/src/api/client.ts` — `apiFetch<T>()` with base URL from `settingsStore`, auth header, typed `Result<T, APIError>`
- [x] 4.2 Create `ui/src/api/useMetricsStream.ts` — `EventSource` SSE hook → `logStore.append()`; auto-reconnect on disconnect
- [x] 4.3 Create React Query hooks for each backend resource group: `useForge`, `useKB`, `useEval`, `useEvidence`, `useLLM`, `useRAG`
- [x] 4.4 Create `settingsStore` (Zustand) — server URL, port, auth token, degraded flags; persisted to Tauri `store` plugin
- [x] 4.5 Create `analysisStore` — current run_id, verdict, score, dimensions, missing items, questions
- [x] 4.6 Create `evidenceStore` — run history list, selected bundle JSON
- [x] 4.7 Create `kbStore` — sources list, storage bytes used/max
- [x] 4.8 Create `logStore` — circular buffer (2 000 entries max); level, timestamp, message, metadata
- [x] 4.9 Create `evalStore` — gold-set entries, last eval run result, metrics
- [x] 4.10 Unit tests for API client (mock fetch), SSE hook (mock EventSource), each store (initial state, actions, persistence)

## 5. New Backend Endpoints (`src/server/app.ts`)

- [x] 5.1 Add `GET /api/status` — `{ server, version, shadow_mode, degraded_flags, uptime_ms }`; gated by `UI_DEV_ENDPOINTS` env flag
- [x] 5.2 Add `GET /api/config` — sanitised ServerConfig (all credential fields → `"[set]"` / `"[not set]"`); read-only
- [x] 5.3 Add `GET /api/metrics` — SSE stream from `forgeInstrumentation` events + LLM call events + RAG retrieval events; `Content-Type: text/event-stream`
- [x] 5.4 Extend `src/server/config.ts` with `UI_DEV_ENDPOINTS` boolean (default `true`)
- [x] 5.5 Contract tests for all three new endpoints: happy path, shadow-mode behaviour, credential redaction

## 6. Tauri Sidecar

- [x] 6.1 Add `build:server` script — `esbuild src/index.ts --bundle --platform=node --outfile=ui/src-tauri/binaries/product-overlord-server-<target>`
- [x] 6.2 Configure `tauri.conf.json` sidecar entry; set `externalBin` for all three platform targets
- [x] 6.3 Implement sidecar spawn in `main.rs` — start server on app open; SIGTERM on app close; capture stdout/stderr → log file
- [x] 6.4 Implement port conflict detection — if `3000` busy, find next free port and pass as `PORT` env to sidecar; update `settingsStore`
- [x] 6.5 Integration test: Tauri sidecar starts, `/health` responds 200, sidecar terminates on window close

## 7. Feature Panels — Ingestion & Analysis

- [x] 7.1 Implement `IngestionPanel` — issue key / JQL / board form; POST `/forge/ingest/issue`; live `GlassBadge` status; navigate to `AnalysisPanel` on success
- [x] 7.2 Implement `AnalysisPanel` — `ScoreGauge`; `GlassBadge` verdict; `DimensionGrid` (weight + pass/fail per dimension); `MissingItemList` (tag `source: llm` in amber); `ClarificationQuestions` (PM/Engineer/QA tabs)
- [x] 7.3 Implement `NormaliserPanel` — raw canonical ticket tree; highlight AC alias field resolution; copy JSON button
- [x] 7.4 Tests: ingestion form validation; analysis renders all verdict states; normaliser displays all AC alias variants

## 8. Feature Panels — Evidence & Output

- [x] 8.1 Implement `EvidencePanel` — paginated run history table (run_id, verdict, score, timestamp, issue_key); click row → drill-down
- [x] 8.2 Implement `BundleDrillDown` — full evidence JSON tree; LLM traces accordion; retrieved chunks list; adapter traces timeline
- [x] 8.3 Implement `DraftPanel` — rendered Markdown Jira comment preview; `Approve` button → POST `confirm_post_url`; `Discard` button; CSRF token display; shadow-mode warning banner when `SHADOW_MODE=true`
- [x] 8.4 Tests: evidence search/filter; bundle drill-down renders traces; draft approve fires correct POST; discard clears state

## 9. Feature Panels — Planning & Repo

- [x] 9.1 Implement `PlanningPanel` — `ActionPackageViewer` (branch name, files, components, tests); `ComponentCandidateList` (confidence bars via CSS gradient); `OpenSpecDiffPreview` (syntax-highlighted diff)
- [x] 9.2 Implement `RepoPanel` — component index card grid (framework badge, owner, test dirs); mapper result list (ranked by confidence); Teamwork Graph enrichment status badge
- [x] 9.3 Tests: planning panel renders low_confidence warning; repo panel shows `enrichmentOnly` beta badge

## 10. Feature Panels — Knowledge Base & LLM/RAG

- [x] 10.1 Implement `KBPanel` — `FileUploadDropzone` (drag-and-drop + click; 50 MB client-side guard; supported types badge); `CrawlURLForm` (URL + project_key + depth 1–3 slider); `SourcesList` (per-project filter, delete with confirm modal); `StorageMeter` (used/max GB arc)
- [x] 10.2 Implement `LLMPanel` — adapter status badge (live vs degraded); `RateLimitGauge` (calls remaining this minute); `LLMTraceList` (model, tokens, latency, degraded flag per trace)
- [x] 10.3 Implement `RAGPanel` — `RetrievedChunksViewer` (score bar per chunk, source, text preview); `ContextBlockPreview` (token count badge, truncated indicator); `LatencyHistogram` (bar chart of last 50 retrieval latencies)
- [x] 10.4 Tests: KB dropzone rejects files >50 MB; crawl form validates URL format; LLM panel shows degraded badge when `DEGRADED_LLM=true`; RAG panel renders empty state

## 11. Feature Panels — Eval & Forge

- [x] 11.1 Implement `EvalPanel` — `GoldSetBrowser` (tag/bucket filter chips, entry cards); `RunEvalButton` (POST to trigger eval, progress indicator); `MetricsGrid` (agreement %, precision@3, LLM degraded rate, RAG p95 latency); `RolloutGateStatus` (pass/fail with criteria checklist)
- [x] 11.2 Implement `ForgePanel` — endpoint health grid (4 Forge routes + 3 KB routes + 3 API routes; green/red dot); payload size monitor (last response size vs 4.5 MB limit bar); CSRF token list (active tokens, consumed count)
- [x] 11.3 Tests: eval panel shows agreement % from mock run; rollout gate shows blocked state; Forge health grid updates on SSE event

## 12. Feature Panels — Logging, Testing, Settings, Dev Tools

- [x] 12.1 Implement `LogConsole` — virtualised list (`react-window`); level filter chips (debug/info/warn/error); search box (debounced 200 ms); colour-coded level bands; auto-scroll toggle; clear button
- [x] 12.2 Implement `TestRunnerPanel` — suite selector (multi-select checkboxes); `Run` button → spawn `npm test -- <suites>` via Tauri shell API; live output stream; `GlassBadge` summary (passed/failed/skipped); re-run failed button
- [x] 12.3 Implement `SettingsPanel` — env var editor (grouped: Jira, GitHub, LLM, KB, Flags); degraded-mode toggles (SHADOW_MODE, DEGRADED_REPO, DEGRADED_LLM, etc.); port config; server start/stop button; save → write `.env` via Tauri FS API (with confirmation)
- [x] 12.4 Implement `DevToolsPanel` — TypeScript type explorer (searchable list of exported types from `src/types/index.ts`); retry histogram (live from SSE); latency p95 trend line; confidence histogram bar chart
- [x] 12.5 Tests: log console filters correctly; test runner shows pass/fail counts; settings save prompts confirmation; dev tools render live stats

## 13. Instrumentation & Observability

- [x] 13.1 Extend `forgeInstrumentation.reset()` to also clear SSE subscriber list on test teardown
- [x] 13.2 Add SSE broadcaster to `GET /api/metrics` — fan-out to all connected `EventSource` clients; heartbeat every 15 s
- [x] 13.3 Add `recordUIAction(panel, action)` to `forgeInstrumentation` — tracks panel open counts and button clicks for future analytics
- [x] 13.4 Unit tests for SSE broadcaster (mock subscribers); `recordUIAction` increments counters

## 14. Accessibility & Cross-Platform Polish

- [x] 14.1 Audit all interactive elements for keyboard navigation and ARIA labels
- [x] 14.2 Verify `@supports (backdrop-filter: blur(1px))` fallback renders correctly on Linux (WebKitGTK) and Windows (WebView2)
- [x] 14.3 Add `prefers-reduced-motion` media query — disable spring animations when set; use instant transitions
- [x] 14.4 Test on all three platforms (macOS 14, Ubuntu 22.04, Windows 11) — document any visual differences in `ui/PLATFORM_NOTES.md`
- [x] 14.5 Lighthouse accessibility audit ≥ 90 for each panel (Tauri WebView Chromium)

## 15. Documentation & README

- [x] 15.1 Add `ui/README.md` — setup, dev server, build, platform notes, theme token reference
- [x] 15.2 Update root `README.md` — add "Desktop UI" section with screenshot placeholder, install instructions, and link to `ui/README.md`
- [x] 15.3 Add `ui-shell`, `ui-theme`, `ui-api-client` capabilities to `AGENTS.md` key source files table
- [x] 15.4 Document `UI_DEV_ENDPOINTS` env var in `.env.example` and `README.md` env var table
