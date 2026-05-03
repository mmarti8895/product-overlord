# Tasks: sprint-execution-visibility

## 1. Types & Configuration

- [x] 1.1 Add `SprintSnapshot`, `VelocityPoint`, `BlockerTicket`, `ScopeAddition` interfaces to `src/types/sprint.ts`
- [x] 1.2 Extend `ServerConfig` / `ConnectionManager` with `sprint_poll_interval_ms` (default 300_000), `done_statuses` (default `['Done','Closed','Resolved']`), and `sprint_board_ids: string[]`
- [x] 1.3 Add `SprintConfig` type and validator in `src/server/config.ts`

## 2. Services

- [x] 2.1 Implement `VelocityTracker` (`src/services/velocity-tracker.ts`) — fetches last 6 closed sprints via `jira-agile-rest.GetAllSprints(boardId, 'closed')`, returns `VelocityPoint[]`
- [x] 2.2 Implement `BlockerDetector` (`src/services/blocker-detector.ts`) — filters active sprint issues for unresolved "is blocked by" links past midpoint, returns `BlockerTicket[]`
- [x] 2.3 Implement `ScopeCreepDetector` (`src/services/scope-creep-detector.ts`) — detects tickets added after `sprint.startDate`, returns `ScopeAddition[]` and `scope_creep_delta`
- [x] 2.4 Implement `SprintMonitor` (`src/services/sprint-monitor.ts`) — poll loop, delegates to above three services, maintains `Map<boardId, SprintSnapshot>` cache, emits `sprint:snapshot-updated` on `AgentEventBus`
- [x] 2.5 Add `story_points` → `original_estimate` fallback logic in `SprintMonitor`; set `points_estimated_from_time: true` when used
- [x] 2.6 Implement health score formula and `health_label` derivation in `SprintMonitor`

## 3. API Routes

- [x] 3.1 Create `src/server/routes/sprint.ts` with 4 routes: `GET /api/sprint/:boardId/snapshot`, `GET /api/sprint/:boardId/velocity`, `GET /api/sprint/:boardId/blockers`, `GET /api/sprint/stream` (SSE)
- [x] 3.2 Register sprint router in `src/server/app.ts`
- [x] 3.3 Implement SSE handler — subscribe to `AgentEventBus` `sprint:snapshot-updated`; emit `sprint:heartbeat` every 30 s; handle client disconnect cleanup

## 4. UI

- [x] 4.1 Create `sprintStore` (Zustand) in `ui/src/stores/sprintStore.ts` — `snapshots: Map<string, SprintSnapshot>`, `selectedBoard`, actions
- [x] 4.2 Implement `useSprintStream` hook (`ui/src/api/useSprintStream.ts`) — `EventSource` to `/api/sprint/stream`; auto-reconnect; updates `sprintStore` on each event; shows "Reconnecting…" badge on disconnect
- [x] 4.3 Add React Query hook `useSprint(boardId)` in `ui/src/api/useSprint.ts`
- [x] 4.4 Implement `SprintHealthPanel` (`ui/src/panels/SprintHealthPanel.tsx`):
  - [x] 4.4a Board selector dropdown (from `sprint_board_ids` config)
  - [x] 4.4b Velocity gauge using `ScoreGauge` (completed / committed %)
  - [x] 4.4c 6-sprint velocity sparkline
  - [x] 4.4d Health badge (`GlassBadge` with `on-track→ready`, `at-risk→needs_clarification`, `off-track→blocked` mapping)
  - [x] 4.4e Blocker list — collapsible `GlassCard` per blocker with Jira deep-link
  - [x] 4.4f Scope creep badge — count + delta points
- [x] 4.5 Register `SprintHealthPanel` route in app shell sidebar and router

## 5. Tests

- [x] 5.1 Unit: `VelocityTracker` — 3 fixtures (6 sprints, 2 sprints, 0 sprints)
- [x] 5.2 Unit: `BlockerDetector` — blocked past midpoint, blocked before midpoint (excluded), no blockers
- [x] 5.3 Unit: `ScopeCreepDetector` — additions present, no additions, missing `created` date edge case
- [x] 5.4 Unit: health score formula — on-track, at-risk, off-track threshold boundaries
- [x] 5.5 Integration: `SprintMonitor` full poll cycle with mocked `jira-agile-rest`; stale cache on 5xx
- [x] 5.6 Contract: all 4 API routes — happy path, stale cache response, no active sprint (null data), missing boardId (404)
- [x] 5.7 UI: `SprintHealthPanel` — on-track state, off-track state, no data / loading state, SSE live-update behaviour
- [x] 5.8 UI: `useSprintStream` hook — mock `EventSource`, heartbeat ignored, reconnect indicator
