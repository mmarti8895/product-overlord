# Tasks: roadmap-planning

## 1. Types

- [ ] 1.1 Create `src/types/roadmap.ts` with `Epic`, `Milestone`, `RICEScore`, `ICEScore`, `RoadmapSnapshot`, `DependencyEdge` interfaces
- [ ] 1.2 Extend `CanonicalTicket` in `src/types/index.ts` with optional `epic_key: string | null` and `fix_versions: string[]` fields

## 2. Services

- [ ] 2.1 Implement `EpicAggregator` (`src/services/epic-aggregator.ts`):
  - [ ] 2.1a Fetch epics via `jira-agile-rest.GetEpicsForBoard(boardId)`
  - [ ] 2.1b Load child `CanonicalTicket` records from LanceDB by `parent.key === epic.key`
  - [ ] 2.1c Compute `health_score = mean(children.readiness_score) * 100`; derive `health_label`
  - [ ] 2.1d Extract `linked_epic_keys` from cross-epic ticket dependency links
  - [ ] 2.1e Map Jira fix-versions → `Milestone` records
- [ ] 2.2 Implement `PrioritisationEngine` (`src/services/prioritisation-engine.ts`):
  - [ ] 2.2a RICE estimation — LLM reach prompt, label→impact mapping, health_score→confidence, effort from estimates
  - [ ] 2.2b ICE estimation — mapped from RICE values, normalised 1–10
  - [ ] 2.2c Accept human override object; mark `estimated_by` correctly
  - [ ] 2.2d Graceful LLM failure — return `null` RICE/ICE, do not throw
- [ ] 2.3 Implement `DependencyGraphBuilder` (`src/services/dependency-graph.ts`):
  - [ ] 2.3a Build `DependencyEdge[]` from `linked_epic_keys`
  - [ ] 2.3b Mark `cross_team: true` for cross-project edges
  - [ ] 2.3c DFS cycle detection; append cycle strings to `warnings`
- [ ] 2.4 Implement `RoadmapStore` (`src/stores/roadmap-store.ts`):
  - [ ] 2.4a In-process `Map<projectKey, RoadmapSnapshot>` cache
  - [ ] 2.4b `refresh(projectKey)` — orchestrates aggregator → prioritisation → graph pipeline
  - [ ] 2.4c Persist snapshot to LanceDB table `roadmap_snapshots`
  - [ ] 2.4d Restore cache from LanceDB on server startup
  - [ ] 2.4e `updateEpicRICE(epicKey, overrides)` — persist human overrides to LanceDB

## 3. API Routes

- [ ] 3.1 Create `src/server/routes/roadmap.ts` with 7 routes (see design.md)
- [ ] 3.2 Register roadmap router in `src/server/app.ts`
- [ ] 3.3 `PATCH /api/roadmap/:projectKey/epics/:epicKey/rice` — validate body, call `RoadmapStore.updateEpicRICE`, return updated epic

## 4. UI

- [ ] 4.1 Create `roadmapStore` (Zustand) in `ui/src/stores/roadmapStore.ts`
- [ ] 4.2 Add React Query hooks: `useRoadmap(projectKey)`, `useEpic(projectKey, epicKey)`, `useMilestones(projectKey)`, `useDependencies(projectKey)`
- [ ] 4.3 Implement `RoadmapPanel` (`ui/src/panels/RoadmapPanel.tsx`) with tab bar switching three sub-views:
  - [ ] 4.3a **Timeline View** — horizontal milestone swimlanes, epic pills (width ∝ effort), health colour coding, SVG dependency arrows, click-to-drawer for epic detail
  - [ ] 4.3b **RICE Table View** — sortable table (default: RICE score desc), inline-editable fields, `PATCH` on blur, `GlassToast` on success, null scores at bottom
  - [ ] 4.3c **Dependency Graph View** — `react-force-graph`, cross-team edges in amber, cycle warning red badge
- [ ] 4.4 Epic detail side drawer — child ticket list with readiness scores, health badge, RICE/ICE display
- [ ] 4.5 Register `RoadmapPanel` route in app shell sidebar and router
- [ ] 4.6 Install `react-force-graph` dependency in `ui/package.json`

## 5. Tests

- [ ] 5.1 Unit: `EpicAggregator` — 3 fixture boards (healthy, at-risk, no child tickets warning)
- [ ] 5.2 Unit: `PrioritisationEngine` — RICE formula correctness, ICE normalisation, human override precedence, LLM failure returns null
- [ ] 5.3 Unit: `DependencyGraphBuilder` — cross-team flag, cycle detection (A→B→A), no edges case
- [ ] 5.4 Unit: health score label boundaries (70, 40 thresholds)
- [ ] 5.5 Integration: `RoadmapStore.refresh()` full pipeline — mocked Jira adapter + LLM, LanceDB persistence round-trip
- [ ] 5.6 Contract: all 7 API routes — happy path, empty project, RICE override persistence, cycle warning in snapshot
- [ ] 5.7 UI: Timeline view — epic pills render, health colours, dependency arrow present
- [ ] 5.8 UI: RICE table — sort order, inline edit triggers PATCH, null scores at bottom
- [ ] 5.9 UI: Dependency graph — cycle badge present when warnings include cycle
