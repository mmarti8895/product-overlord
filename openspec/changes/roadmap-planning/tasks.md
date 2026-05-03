# Tasks: roadmap-planning

## 1. Types

- [x] 1.1 Create `src/types/roadmap.ts` with `Epic`, `Milestone`, `RICEScore`, `ICEScore`, `RoadmapSnapshot`, `DependencyEdge` interfaces
- [x] 1.2 Extend `CanonicalTicket` in `src/types/index.ts` with optional `epic_key: string | null` and `fix_versions: string[]` fields

## 2. Services

- [x] 2.1 Implement `EpicAggregator` (`src/services/epic-aggregator.ts`):
  - [x] 2.1a Fetch epics via `jira-agile-rest.GetEpicsForBoard(boardId)`
  - [x] 2.1b Load child `CanonicalTicket` records from LanceDB by `parent.key === epic.key`
  - [x] 2.1c Compute `health_score = mean(children.readiness_score) * 100`; derive `health_label`
  - [x] 2.1d Extract `linked_epic_keys` from cross-epic ticket dependency links
  - [x] 2.1e Map Jira fix-versions → `Milestone` records
- [x] 2.2 Implement `PrioritisationEngine` (`src/services/prioritisation-engine.ts`):
  - [x] 2.2a RICE estimation — LLM reach prompt, label→impact mapping, health_score→confidence, effort from estimates
  - [x] 2.2b ICE estimation — mapped from RICE values, normalised 1–10
  - [x] 2.2c Accept human override object; mark `estimated_by` correctly
  - [x] 2.2d Graceful LLM failure — return `null` RICE/ICE, do not throw
- [x] 2.3 Implement `DependencyGraphBuilder` (`src/services/dependency-graph.ts`):
  - [x] 2.3a Build `DependencyEdge[]` from `linked_epic_keys`
  - [x] 2.3b Mark `cross_team: true` for cross-project edges
  - [x] 2.3c DFS cycle detection; append cycle strings to `warnings`
- [x] 2.4 Implement `RoadmapStore` (`src/stores/roadmap-store.ts`):
  - [x] 2.4a In-process `Map<projectKey, RoadmapSnapshot>` cache
  - [x] 2.4b `refresh(projectKey)` — orchestrates aggregator → prioritisation → graph pipeline
  - [x] 2.4c Persist snapshot to LanceDB table `roadmap_snapshots`
  - [x] 2.4d Restore cache from LanceDB on server startup
  - [x] 2.4e `updateEpicRICE(epicKey, overrides)` — persist human overrides to LanceDB

## 3. API Routes

- [x] 3.1 Create `src/server/routes/roadmap.ts` with 7 routes (see design.md)
- [x] 3.2 Register roadmap router in `src/server/app.ts`
- [x] 3.3 `PATCH /api/roadmap/:projectKey/epics/:epicKey/rice` — validate body, call `RoadmapStore.updateEpicRICE`, return updated epic

## 4. UI

- [x] 4.1 Create `roadmapStore` (Zustand) in `ui/src/stores/roadmapStore.ts`
- [x] 4.2 Add React Query hooks: `useRoadmap(projectKey)`, `useEpic(projectKey, epicKey)`, `useMilestones(projectKey)`, `useDependencies(projectKey)`
- [x] 4.3 Implement `RoadmapPanel` (`ui/src/panels/RoadmapPanel.tsx`) with tab bar switching three sub-views:
  - [x] 4.3a **Timeline View** — horizontal milestone swimlanes, epic pills (width ∝ effort), health colour coding, SVG dependency arrows, click-to-drawer for epic detail
  - [x] 4.3b **RICE Table View** — sortable table (default: RICE score desc), inline-editable fields, `PATCH` on blur, `GlassToast` on success, null scores at bottom
  - [x] 4.3c **Dependency Graph View** — `react-force-graph`, cross-team edges in amber, cycle warning red badge
- [x] 4.4 Epic detail side drawer — child ticket list with readiness scores, health badge, RICE/ICE display
- [x] 4.5 Register `RoadmapPanel` route in app shell sidebar and router
- [x] 4.6 Install `react-force-graph` dependency in `ui/package.json`

## 5. Tests

- [x] 5.1 Unit: `EpicAggregator` — 3 fixture boards (healthy, at-risk, no child tickets warning)
- [x] 5.2 Unit: `PrioritisationEngine` — RICE formula correctness, ICE normalisation, human override precedence, LLM failure returns null
- [x] 5.3 Unit: `DependencyGraphBuilder` — cross-team flag, cycle detection (A→B→A), no edges case
- [x] 5.4 Unit: health score label boundaries (70, 40 thresholds)
- [x] 5.5 Integration: `RoadmapStore.refresh()` full pipeline — mocked Jira adapter + LLM, LanceDB persistence round-trip
- [x] 5.6 Contract: all 7 API routes — happy path, empty project, RICE override persistence, cycle warning in snapshot
- [x] 5.7 UI: Timeline view — epic pills render, health colours, dependency arrow present
- [x] 5.8 UI: RICE table — sort order, inline edit triggers PATCH, null scores at bottom
- [x] 5.9 UI: Dependency graph — cycle badge present when warnings include cycle
