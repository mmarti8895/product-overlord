# Tasks: portfolio-management

## 1. Types

- [ ] 1.1 Create `src/types/portfolio.ts` with `Portfolio`, `PortfolioSnapshot`, `ProjectSummary`, `RoadmapHealthSummary`, `CapacityRow`, `PortfolioDigest`, `DeliveryRecord` interfaces

## 2. Store

- [ ] 2.1 Implement `PortfolioStore` (`src/stores/portfolio-store.ts`):
  - [ ] 2.1a LanceDB non-vector tables: `portfolios`, `portfolio_snapshots`, `portfolio_digests`
  - [ ] 2.1b `get(id)`, `list()`, `save(portfolio)`, `delete(id)`
  - [ ] 2.1c `saveSnapshot(snapshot)`, `getLatestSnapshot(portfolioId)`
  - [ ] 2.1d `saveDigest(digest)`, `getLatestDigest(portfolioId)`

## 3. Services

- [ ] 3.1 Implement `CrossProjectDependencyGraph` (`src/services/cross-project-deps.ts`):
  - [ ] 3.1a Iterate all epic `DependencyEdge[]` from `RoadmapStore` for portfolio project keys
  - [ ] 3.1b Filter to `cross_team: true` edges only
  - [ ] 3.1c Flag `blocking: true` where target epic has `health_label = 'blocked'`
- [ ] 3.2 Implement `CapacityHeatmapBuilder` (`src/services/capacity-heatmap.ts`):
  - [ ] 3.2a Read 6-sprint velocity from `SprintMonitor.getSnapshot(boardId).velocity_trend`; compute `avg_velocity = mean(completed)`
  - [ ] 3.2b Read next (non-shipped) milestone from `RoadmapStore.getMilestones(projectKey)`; sum epic effort as `committed_next_ms`
  - [ ] 3.2c Compute `sprints_to_milestone` from business days remaining / sprint length
  - [ ] 3.2d Compute `utilisation_pct`; assign label (`under` / `ok` / `over`)
  - [ ] 3.2e Zero velocity edge case — `avg_velocity_6sp = 0`, `health = 'under'`, add warning
- [ ] 3.3 Implement `PortfolioAggregator` (`src/services/portfolio-aggregator.ts`):
  - [ ] 3.3a Load portfolio from `PortfolioStore`
  - [ ] 3.3b For each project key: get `SprintSnapshot` + `RoadmapSnapshot`; build `ProjectSummary`
  - [ ] 3.3c Populate `warnings` for missing roadmap/sprint data
  - [ ] 3.3d Call `CrossProjectDependencyGraph.build()` and `CapacityHeatmapBuilder.build()`
  - [ ] 3.3e Assemble and save `PortfolioSnapshot` via `PortfolioStore`
- [ ] 3.4 Implement `PortfolioDigestWriter` (`src/services/portfolio-digest.ts`):
  - [ ] 3.4a Build LLM prompt sections from `PortfolioSnapshot` (highlights, risks, blockers, optional OKR progress)
  - [ ] 3.4b Generate Markdown digest; store as `PortfolioDigest` via `PortfolioStore`
  - [ ] 3.4c `deliverToSlack(digest, webhookUrl)` — POST Slack blocks; record `DeliveryRecord`
  - [ ] 3.4d `deliverToConfluence(digest, config)` — delegate to `ConfluencePublisher`; record `DeliveryRecord`
  - [ ] 3.4e Delivery failure — set `delivered: false` in `DeliveryRecord`; do not throw

## 4. API Routes

- [ ] 4.1 Create `src/server/routes/portfolio.ts` with 12 routes (see design.md)
- [ ] 4.2 Register portfolio router in `src/server/app.ts`
- [ ] 4.3 `POST /api/portfolio/:id/digest/deliver` — validate `{ channel }` body; call appropriate delivery method; return `DeliveryRecord`

## 5. Configuration

- [ ] 5.1 Add `slackWebhookUrl?: string` and `sprintLengthDays: number` (default 14) to `ServerConfig` / `ConnectionManager`
- [ ] 5.2 Add `project_to_board_id` map in `ConnectionManager` for resolving project key → Jira board ID

## 6. UI

- [ ] 6.1 Create `portfolioStore` (Zustand) in `ui/src/stores/portfolioStore.ts`
- [ ] 6.2 Add React Query hooks: `usePortfolios()`, `usePortfolioSnapshot(id)`, `usePortfolioDependencies(id)`, `usePortfolioCapacity(id)`, `usePortfolioDigest(id)`
- [ ] 6.3 Implement `PortfolioPanel` (`ui/src/panels/PortfolioPanel.tsx`):
  - [ ] 6.3a **Overview Tab** — portfolio selector dropdown, project cards grid (`GlassCard` per project: sprint health badge, roadmap health badge, next milestone name/date), "Refresh" button
  - [ ] 6.3b **Dependency Graph Tab** — `react-force-graph` cross-project epic graph; blocked edges red, at-risk amber, healthy green; click node → epic detail in `RoadmapPanel` drawer
  - [ ] 6.3c **Capacity Heat-map Tab** — table (Project | Team | Avg Velocity | Committed | Utilisation % | Status); colour-coded rows; utilisation tooltip with formula explanation
  - [ ] 6.3d **Digest Tab** — latest digest rendered as Markdown; "Regenerate" button; "Deliver to Slack" + "Publish to Confluence" buttons each with `GlassModal` confirmation before `POST .../digest/deliver`
- [ ] 6.4 "Create Portfolio" flow — modal with name input + project key multi-select (from `ConnectionManager` known project keys)
- [ ] 6.5 Register `PortfolioPanel` route in app shell sidebar and router

## 7. Tests

- [ ] 7.1 Unit: `PortfolioAggregator` — 3 fixture portfolios (all loaded, partial missing, single project)
- [ ] 7.2 Unit: `CrossProjectDependencyGraph` — cross-team edge selection, blocking flag, same-project edge excluded
- [ ] 7.3 Unit: `CapacityHeatmapBuilder` — utilisation formula, label thresholds (69/70/100/101%), zero velocity case, no milestone case
- [ ] 7.4 Unit: `PortfolioDigestWriter` — LLM prompt construction, OKR-absent path, Slack delivery success/failure, Confluence delivery delegation
- [ ] 7.5 Integration: `PortfolioAggregator.refresh()` — mocked `RoadmapStore` + `SprintMonitor`; snapshot persisted to LanceDB
- [ ] 7.6 Contract: all 12 API routes — CRUD, refresh, snapshot, dependencies, capacity, digest generate/deliver (slack + confluence), missing project data warnings
- [ ] 7.7 UI: `PortfolioPanel` — all 4 tabs render, project cards show correct badges, deliver modal opens and calls endpoint, empty state (no portfolios)
