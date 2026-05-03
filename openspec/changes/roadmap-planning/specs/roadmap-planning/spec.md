## ADDED Requirements

### Requirement: Epic and Milestone type hierarchy
The system SHALL model Jira epics as `Epic` records with: key, summary, description, status, project key, milestone linkage, child ticket keys, cross-epic dependency keys, health score (0–100), health label (`healthy` | `at-risk` | `blocked`), RICE score, and ICE score. Milestones SHALL map to Jira fix-versions or manually defined quarters and SHALL carry a `target_date` and `status` (`planned` | `in-progress` | `shipped` | `delayed`).

#### Scenario: Epic health score aggregated from children
- **WHEN** an epic has 4 child tickets with readiness scores `[0.9, 0.8, 0.3, 0.2]`
- **THEN** the epic's `health_score` SHALL be `55` (mean = 0.55 × 100) and `health_label` SHALL be `'at-risk'`

#### Scenario: Epic with no child tickets
- **WHEN** an epic has no child tickets in LanceDB
- **THEN** `health_score` SHALL be `0`, `health_label` SHALL be `'blocked'`, and `warnings` SHALL include `'no_child_tickets'`

#### Scenario: Milestone maps to fix-version
- **WHEN** a Jira epic has `fixVersions: [{ name: "v2.1", releaseDate: "2026-09-30" }]`
- **THEN** a `Milestone` record SHALL be created with `name = "v2.1"`, `target_date = "2026-09-30"`, and `status = 'planned'`

---

### Requirement: RICE and ICE prioritisation scoring
The system SHALL compute RICE scores (Reach × Impact × Confidence ÷ Effort) and ICE scores (Impact × Confidence × Ease) for each epic using LLM-enriched estimates when no human override is provided. All LLM-derived values SHALL be labelled `estimated_by: 'llm'`. Human overrides SHALL be labelled `estimated_by: 'human'` and SHALL persist to LanceDB. RICE Confidence SHALL be derived from the epic's `health_score`.

#### Scenario: RICE score computed from LLM estimates
- **WHEN** `PrioritisationEngine` processes an epic with no human RICE overrides
- **THEN** it SHALL produce a `RICEScore` with `estimated_by: 'llm'` where `score = reach * impact * confidence / effort`

#### Scenario: Human override persists and takes precedence
- **WHEN** a PM sends `PATCH /api/roadmap/:projectKey/epics/:epicKey/rice` with `{ reach: 500, effort: 2 }`
- **THEN** those fields SHALL be stored with `estimated_by: 'human'` and subsequent score computations SHALL use them instead of LLM estimates

#### Scenario: LLM enrichment failure — RICE remains null
- **WHEN** the LLM provider is unavailable during epic aggregation
- **THEN** the epic SHALL be included in the `RoadmapSnapshot` with `rice_score: null` and `ice_score: null` — it SHALL NOT be excluded from the snapshot

---

### Requirement: Cross-epic dependency graph
The system SHALL build a `DependencyEdge[]` graph from epic `linked_epic_keys` fields. Edges between epics in different projects SHALL be marked `cross_team: true`. The system SHALL detect dependency cycles (DFS) and include them in `RoadmapSnapshot.warnings` as `'cycle_detected: <epicKey1> → <epicKey2> → …'`.

#### Scenario: Cross-team dependency flagged
- **WHEN** Epic A in project `CORE` has `linked_epic_keys: ['PAY-42']` and Epic `PAY-42` is in project `PAY`
- **THEN** the `DependencyEdge` for this pair SHALL have `cross_team: true`

#### Scenario: Cycle detection
- **WHEN** Epic A depends on Epic B and Epic B depends on Epic A
- **THEN** `RoadmapSnapshot.warnings` SHALL contain a string matching `'cycle_detected: A → B → A'`

---

### Requirement: RoadmapPanel timeline, RICE table, and dependency graph views
The desktop UI `RoadmapPanel` SHALL provide three switchable sub-views: (1) a horizontal timeline with milestone swimlanes and epic pills colour-coded by health, (2) a sortable RICE table with inline-editable score fields, and (3) a force-directed dependency graph. All three views SHALL reflect the latest `RoadmapSnapshot` from `roadmapStore`.

#### Scenario: RICE table sorted by score descending by default
- **WHEN** the RICE table sub-view is opened
- **THEN** epics SHALL be ordered by `rice_score.score` descending; epics with `rice_score: null` SHALL appear at the bottom

#### Scenario: Inline RICE edit triggers PATCH
- **WHEN** a PM edits the `reach` cell for an epic and blurs the field
- **THEN** the UI SHALL call `PATCH /api/roadmap/:projectKey/epics/:epicKey/rice` with the updated value and display a success toast on 200

#### Scenario: Dependency graph shows cycle warning
- **WHEN** the dependency graph view is opened and `RoadmapSnapshot.warnings` contains a cycle
- **THEN** the graph SHALL display a red badge with the cycle description

---

### Requirement: Roadmap snapshot persistence
The `RoadmapStore` SHALL persist each generated `RoadmapSnapshot` to LanceDB table `roadmap_snapshots` keyed by `project_key + generated_at`. Snapshots SHALL be retrievable by project key, returning the most recent. The in-process cache SHALL be populated from LanceDB on server startup.

#### Scenario: Snapshot survives server restart
- **WHEN** the server restarts after a `RoadmapSnapshot` has been stored
- **THEN** `GET /api/roadmap/:projectKey` SHALL return the persisted snapshot without requiring a manual refresh
