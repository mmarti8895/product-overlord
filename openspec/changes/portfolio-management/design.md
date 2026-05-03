# Design: portfolio-management

## Context

`RoadmapStore` and `SprintMonitor` already hold per-project roadmap snapshots and sprint health data. This change adds a composition layer — `PortfolioAggregator` — that merges those signals across a user-defined set of projects into a `PortfolioSnapshot`. No new data sources are introduced; the value is in the cross-project view, capacity heat-map, and leadership digest. The module depends strictly on changes 8 (sprint-execution-visibility) and 9 (roadmap-planning) being deployed first.

## Goals / Non-Goals

**Goals:**
- Portfolio definition: a named collection of project keys with owner metadata
- Aggregated snapshot: cross-project roadmap + sprint health in one API response
- Cross-team dependency graph: epic-level only, surfaced from `DependencyEdge[]` across projects
- Capacity heat-map: team throughput (story points / sprint) vs. committed milestone work
- Weekly portfolio digest: LLM-generated summary with optional Slack or Confluence delivery

**Non-Goals:**
- Headcount or hiring planning
- Per-engineer workload
- Financial budget tracking
- Automatically re-assigning work between teams

---

## System Architecture

```mermaid
flowchart TB
    subgraph Backend ["Hono Server (src/server/)"]
        PS[PortfolioStore\nsrc/stores/portfolio-store.ts]
        PA[PortfolioAggregator\nsrc/services/portfolio-aggregator.ts]
        CHM[CapacityHeatmapBuilder\nsrc/services/capacity-heatmap.ts]
        DG[CrossProjectDependencyGraph\nsrc/services/cross-project-deps.ts]
        PD[PortfolioDigestWriter\nsrc/services/portfolio-digest.ts]
        API["/api/portfolio/*\nsrc/server/routes/portfolio.ts"]
    end

    subgraph Existing ["Existing Services"]
        RS[RoadmapStore]
        SM[SprintMonitor]
        OT[OKRStore\noptional]
        LLM[LLM provider]
        Slack[Slack Incoming Webhook]
        CP[ConfluencePublisher]
    end

    subgraph UI ["Desktop UI"]
        PP[PortfolioPanel\nui/src/panels/PortfolioPanel.tsx]
    end

    RS -->|RoadmapSnapshot[]| PA
    SM -->|SprintSnapshot[]| PA
    OT -->|OKR progress\noptional| PD
    PA --> CHM
    PA --> DG
    PA --> PS
    PA --> PD
    LLM --> PD
    PD -->|confirmed| Slack
    PD -->|confirmed| CP
    API --> PS
    PP -->|REST| API
```

---

## Data Model (`src/types/portfolio.ts`)

```typescript
interface Portfolio {
  id:           string;       // UUID
  name:         string;
  project_keys: string[];
  owner:        string;
  okr_objective_ids: string[];   // optional — links to OKRStore entries
  created_at:   string;
  updated_at:   string;
}

interface PortfolioSnapshot {
  portfolio_id:      string;
  generated_at:      string;
  project_summaries: ProjectSummary[];
  cross_deps:        DependencyEdge[];      // from roadmap-planning DependencyEdge type
  capacity_heatmap:  CapacityRow[];
  warnings:          string[];
}

interface ProjectSummary {
  project_key:       string;
  sprint_health:     SprintSnapshot | null;       // from SprintMonitor
  roadmap_health:    RoadmapHealthSummary;
  milestone_count:   number;
  at_risk_epics:     number;
  blocked_epics:     number;
}

interface RoadmapHealthSummary {
  total_epics:     number;
  healthy:         number;
  at_risk:         number;
  blocked:         number;
  next_milestone:  { name: string; target_date: string } | null;
}

interface CapacityRow {
  project_key:        string;
  team_name:          string | null;
  avg_velocity_6sp:   number;       // average completed story points over last 6 sprints
  committed_next_ms:  number;       // total story points in next milestone's epics
  utilisation_pct:    number;       // committed_next_ms / (avg_velocity_6sp * sprints_to_milestone)
  health:             'under' | 'ok' | 'over';   // < 70% | 70–100% | > 100%
}

interface PortfolioDigest {
  id:              string;
  portfolio_id:    string;
  generated_at:    string;
  content:         string;    // Markdown
  delivery_log:    DeliveryRecord[];
}

interface DeliveryRecord {
  channel:    'slack' | 'confluence';
  delivered:  boolean;
  url:        string | null;
  timestamp:  string;
}
```

---

## Service Design

### `PortfolioAggregator` (`src/services/portfolio-aggregator.ts`)

1. Loads `Portfolio` definition from `PortfolioStore`
2. For each `project_key` in the portfolio:
   - Calls `SprintMonitor.getSnapshot(boardId)` — maps `project_key` → `boardId` via `ConnectionManager`
   - Calls `RoadmapStore.getSnapshot(projectKey)`
   - Builds `ProjectSummary`
3. Calls `CrossProjectDependencyGraph.build(project_keys)` → `DependencyEdge[]` (cross-project only)
4. Calls `CapacityHeatmapBuilder.build(project_keys)` → `CapacityRow[]`
5. Assembles `PortfolioSnapshot` and stores in `PortfolioStore`

### `CrossProjectDependencyGraph` (`src/services/cross-project-deps.ts`)

- Iterates all `Epic` records for the portfolio's project keys from `RoadmapStore`
- Finds `DependencyEdge` entries where `from_epic.project_key ≠ to_epic.project_key`
- Marks edges as blocked when `to_epic.health_label = 'blocked'`
- Returns `DependencyEdge[]` with `cross_team: true`

### `CapacityHeatmapBuilder` (`src/services/capacity-heatmap.ts`)

- For each project: reads 6-sprint velocity from `SprintMonitor.getSnapshot(boardId).velocity_trend`
  - `avg_velocity = mean(velocityTrend.map(v => v.completed))`
- Reads next milestone's epics from `RoadmapStore.getMilestones(projectKey)` → selects the milestone with earliest `target_date` that is not `shipped`
  - `committed_next_ms = sum(epic.rice_score?.effort * (avg_velocity / effort_normalisation))` or `sum(child_ticket_estimate_points)` as fallback
- Computes `sprints_to_milestone = business_days(now, milestone.target_date) / sprint_length_days`
- `utilisation_pct = committed_next_ms / (avg_velocity * sprints_to_milestone)`
- Labels: `< 70%` → `under`, `70–100%` → `ok`, `> 100%` → `over`

### `PortfolioDigestWriter` (`src/services/portfolio-digest.ts`)

- LLM prompt: structured sections extracted from `PortfolioSnapshot`:
  - **Highlights**: healthy milestones on track
  - **Risks**: at-risk / blocked epics, over-capacity projects
  - **Cross-team blockers**: cross-project dependency edges where blocker is `blocked`
  - **OKR progress** (optional, if `OKRStore` available): key results above/below target
- Returns Markdown digest stored in `PortfolioStore` as `PortfolioDigest`
- Delivery: `POST /api/portfolio/:id/digest/deliver` with `{ channel: 'slack' | 'confluence' }`
  - Slack: `POST` to `ConnectionManager.slackWebhookUrl` with digest rendered as Slack blocks
  - Confluence: delegates to `ConfluencePublisher.publish()` with parent page from config
  - Both channels require explicit human action — no scheduled auto-deliver in this change

### `PortfolioStore` (`src/stores/portfolio-store.ts`)

- LanceDB table `portfolios` (JSON rows, non-vector)
- LanceDB table `portfolio_snapshots`
- LanceDB table `portfolio_digests`
- `get(id)`, `list()`, `save(portfolio)`, `delete(id)`
- `saveSnapshot(snapshot)`, `getLatestSnapshot(portfolioId)`
- `saveDigest(digest)`, `getLatestDigest(portfolioId)`

---

## API Routes (`src/server/routes/portfolio.ts`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/portfolio` | Create portfolio definition |
| GET | `/api/portfolio` | List all portfolios |
| GET | `/api/portfolio/:id` | Get portfolio definition |
| PATCH | `/api/portfolio/:id` | Update portfolio (name, projects, OKR links) |
| DELETE | `/api/portfolio/:id` | Delete portfolio |
| POST | `/api/portfolio/:id/refresh` | Trigger snapshot re-aggregation |
| GET | `/api/portfolio/:id/snapshot` | Latest `PortfolioSnapshot` |
| GET | `/api/portfolio/:id/dependencies` | Cross-project `DependencyEdge[]` |
| GET | `/api/portfolio/:id/capacity` | `CapacityRow[]` |
| POST | `/api/portfolio/:id/digest` | Generate digest |
| GET | `/api/portfolio/:id/digest` | Latest `PortfolioDigest` |
| POST | `/api/portfolio/:id/digest/deliver` | Human-confirmed Slack / Confluence delivery |

---

## UI: `PortfolioPanel` (`ui/src/panels/PortfolioPanel.tsx`)

**Overview Tab**
- Grid of `GlassCard` per project: project key, sprint health badge, roadmap health badge (healthy/at-risk/blocked), next milestone name + target date
- Portfolio selector dropdown (if multiple portfolios defined)
- "Refresh" button → `POST /api/portfolio/:id/refresh`

**Dependency Graph Tab**
- Force-directed SVG graph of cross-project epic dependencies (reuses `react-force-graph` from roadmap-planning)
- Blocked edges in red, at-risk in amber, healthy in green
- Click node → opens epic detail in `RoadmapPanel` side drawer

**Capacity Heat-map Tab**
- Table: Project | Team | Avg Velocity | Committed (next milestone) | Utilisation % | Status
- Colour-coded rows: under (blue), ok (green), over (red)
- Tooltip on utilisation cell: formula explanation + sprint count used

**Digest Tab**
- Latest `PortfolioDigest` rendered as Markdown
- "Regenerate" button → `POST /api/portfolio/:id/digest`
- "Deliver to Slack" / "Publish to Confluence" buttons — each opens a `GlassModal` confirmation before calling `POST .../digest/deliver`

---

## State: `portfolioStore` (Zustand)

```typescript
interface PortfolioStore {
  portfolios:        Portfolio[];
  selectedId:        string | null;
  snapshots:         Map<string, PortfolioSnapshot>;
  digests:           Map<string, PortfolioDigest>;
  setPortfolios:     (p: Portfolio[]) => void;
  selectPortfolio:   (id: string) => void;
  setSnapshot:       (id: string, s: PortfolioSnapshot) => void;
  setDigest:         (id: string, d: PortfolioDigest) => void;
}
```

---

## Error Handling

- Project key in portfolio has no `RoadmapStore` snapshot: include `ProjectSummary` with `roadmap_health = { total_epics: 0, ... }` and `warnings: ['roadmap_not_loaded: {project_key}']`
- Project key has no active sprint: `sprint_health: null` — not an error, shown as "No active sprint" in UI
- OKR store unavailable: digest generated without OKR section; `warnings: ['okr_store_unavailable']`
- Slack delivery failure: log error; `DeliveryRecord` marked `delivered: false`; PM can retry

---

## Testing Strategy

- Unit: `PortfolioAggregator` (3 fixture portfolios — 1 healthy, 1 at-risk, 1 partial data)
- Unit: `CrossProjectDependencyGraph` (cross-project edge detection, blocked edge flagging)
- Unit: `CapacityHeatmapBuilder` (utilisation formula, label thresholds, zero-velocity edge case)
- Unit: `PortfolioDigestWriter` (LLM prompt construction, section extraction, empty OKR path)
- Integration: full `refresh` pipeline with mocked `RoadmapStore` + `SprintMonitor`
- Contract: all 12 API routes
- UI: `PortfolioPanel` — all 4 tabs, delivery modal flow, empty-state (no portfolios defined)
