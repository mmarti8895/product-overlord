## ADDED Requirements

### Requirement: Portfolio definition management
The system SHALL support CRUD for `Portfolio` records via `/api/portfolio`. Each portfolio SHALL have a name, a list of project keys, an owner, and optional OKR objective IDs. Project keys in a portfolio SHALL map to boards known to `ConnectionManager`. The system SHALL NOT automatically group projects into portfolios.

#### Scenario: Portfolio created with two projects
- **WHEN** `POST /api/portfolio` is called with `{ name: "Platform Q3", project_keys: ["CORE", "PAY"] }`
- **THEN** a `Portfolio` record SHALL be persisted and `GET /api/portfolio` SHALL return it

#### Scenario: Deleting a portfolio does not affect project data
- **WHEN** `DELETE /api/portfolio/:id` is called
- **THEN** the `Portfolio` record SHALL be removed but all per-project roadmap and sprint data SHALL remain unaffected

---

### Requirement: Portfolio aggregated snapshot
`POST /api/portfolio/:id/refresh` SHALL trigger `PortfolioAggregator` to build a `PortfolioSnapshot` by querying `RoadmapStore` and `SprintMonitor` for each project key in the portfolio. The snapshot SHALL include: a `ProjectSummary` per project (sprint health, roadmap health, milestone count, at-risk and blocked epic counts), cross-project dependency edges, and a capacity heat-map. When a project's roadmap or sprint data is not yet loaded, the snapshot SHALL include it with empty/null values and a `warnings` entry `'roadmap_not_loaded: {project_key}'` or `'no_active_sprint: {project_key}'` as appropriate.

#### Scenario: Snapshot includes all portfolio projects
- **WHEN** a portfolio has projects `["CORE", "PAY", "ONBRD"]` and all have loaded roadmap data
- **THEN** `PortfolioSnapshot.project_summaries` SHALL contain exactly 3 entries, one per project

#### Scenario: Missing roadmap data — project included with warning
- **WHEN** project `ONBRD` has no `RoadmapSnapshot` in `RoadmapStore`
- **THEN** the snapshot SHALL include a `ProjectSummary` for `ONBRD` with `roadmap_health.total_epics = 0` and `warnings` SHALL contain `'roadmap_not_loaded: ONBRD'`

---

### Requirement: Cross-project dependency graph
`GET /api/portfolio/:id/dependencies` SHALL return all `DependencyEdge` records where `cross_team = true` across the portfolio's projects. Edges where the target epic has `health_label = 'blocked'` SHALL be flagged as `blocking: true` in the response.

#### Scenario: Cross-project blocking dependency surfaced
- **WHEN** Epic `CORE-E1` depends on Epic `PAY-E2` and `PAY-E2` has `health_label = 'blocked'`
- **THEN** the dependency edge in the portfolio response SHALL have `blocking: true`

#### Scenario: Same-project edges excluded
- **WHEN** Epic `CORE-E1` depends on Epic `CORE-E3` (both in project `CORE`)
- **THEN** that edge SHALL NOT appear in the portfolio dependencies response

---

### Requirement: Capacity heat-map
`GET /api/portfolio/:id/capacity` SHALL return a `CapacityRow` per project with: average velocity over the last 6 closed sprints, committed story points in the next planned milestone, and a `utilisation_pct` computed as `committed / (avg_velocity × sprints_to_milestone)`. Rows SHALL be labelled `under` (< 70%), `ok` (70–100%), or `over` (> 100%). When a project has no velocity data (no closed sprints), `avg_velocity_6sp = 0` and `health = 'under'` with a warning.

#### Scenario: Over-capacity project flagged
- **WHEN** a project has `avg_velocity_6sp = 20` and `committed_next_ms = 80` across 2 sprints to milestone
- **THEN** `utilisation_pct = 200` and `health = 'over'`

#### Scenario: No closed sprints — zero velocity with warning
- **WHEN** a project has no closed sprints
- **THEN** `avg_velocity_6sp = 0`, `health = 'under'`, and `warnings` SHALL contain `'no_closed_sprints: {project_key}'`

---

### Requirement: Portfolio digest with human-confirmed delivery
`POST /api/portfolio/:id/digest` SHALL trigger `PortfolioDigestWriter` to produce a Markdown portfolio digest using the latest `PortfolioSnapshot`. `POST /api/portfolio/:id/digest/deliver` SHALL deliver the digest to a configured Slack channel or Confluence page only after an explicit human call. No scheduled or automatic delivery SHALL occur in this change. Each delivery SHALL be recorded in `PortfolioDigest.delivery_log`.

#### Scenario: Digest generated from snapshot
- **WHEN** `POST /api/portfolio/:id/digest` is called and a `PortfolioSnapshot` exists
- **THEN** a `PortfolioDigest` with non-empty `content` SHALL be stored and returned

#### Scenario: Slack delivery gated behind explicit call
- **WHEN** `POST /api/portfolio/:id/digest/deliver` is called with `{ channel: 'slack' }`
- **THEN** the system SHALL POST to the configured Slack webhook URL, record a `DeliveryRecord` with `delivered: true`, and return the Slack message URL

#### Scenario: Delivery failure recorded but not fatal
- **WHEN** the Slack webhook returns a non-2xx response
- **THEN** `DeliveryRecord.delivered` SHALL be `false` and the digest SHALL remain available for retry; no exception SHALL propagate to the caller
