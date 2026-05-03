# Proposal: portfolio-management

## Problem

When a single PM manages multiple projects, or when multiple PMs share a platform, there is no aggregate view across boards. Roadmaps, sprint health, and OKR progress are siloed per project. Cross-team dependencies are invisible. Capacity is untracked. Leadership cannot see the full portfolio without manually stitching together per-project Jira exports or sprint review decks.

## Intent

Add a **PortfolioManager** module that is a composition layer over roadmap-planning and sprint-execution-visibility. It aggregates roadmap snapshots and sprint health across all configured projects, surfaces cross-team dependency conflicts, provides a capacity heat-map by team, and produces a weekly portfolio digest for leadership. No new data is introduced — all signals come from existing modules.

## Scope

**In scope:**
- `Portfolio` type: named collection of project keys with owner metadata and a set of linked OKR objectives
- `PortfolioAggregator`: queries `RoadmapStore` and `SprintMonitor` across all projects in the portfolio and merges results into a `PortfolioSnapshot`
- Cross-team dependency graph: surfaces when an Epic in Project A depends on an Epic in Project B (via `linked_epic_keys` in `RoadmapStore`), with status and blocking indicators
- Capacity heat-map: per-team story-point throughput (last 6 sprints, from `SprintMonitor` velocity data) vs. committed work in the next milestone
- Portfolio digest: LLM-generated weekly summary card (risks, highlights, cross-team blockers, OKR progress) sent to a configured Slack channel or saved as a draft Confluence page
- `POST /api/portfolio` — create/update a portfolio definition
- `GET /api/portfolio/:portfolioId/snapshot` — full aggregated snapshot
- `GET /api/portfolio/:portfolioId/dependencies` — cross-team dependency graph
- `GET /api/portfolio/:portfolioId/capacity` — capacity heat-map data
- `POST /api/portfolio/:portfolioId/digest` — trigger weekly digest generation
- UI panel: `PortfolioPanel` with project cards, dependency graph, capacity heat-map, and digest preview

**Out of scope:**
- Headcount or hiring planning (requires HR integration — future extension)
- Automatically re-assigning work across teams
- Financial budget tracking or cost management
- Per-engineer workload tracking (team-level throughput only, not individual)

## Assumptions

- At least one project is already configured in `ConnectionManager` with a valid Jira board ID
- `RoadmapStore` and `SprintMonitor` are available (depends on roadmap-planning and sprint-execution-visibility)
- Slack Incoming Webhook URL is optionally configured in `ConnectionManager` for digest delivery
- Cross-team epic dependencies are encoded via a `linked_epic_keys` field in `Epic` (introduced in roadmap-planning); portfolios only surface existing linkages, they do not create them
- Capacity heat-map uses story-point throughput as a proxy for capacity; teams without story-point estimates fall back to ticket count

## Human Approval Points

- Portfolio definitions (which projects are grouped) are set by a human; no automatic project grouping
- Weekly digest is generated on demand or on a configured schedule; a human must confirm the Slack post or Confluence publish in the same way as other publish flows
- Cross-team dependency flags are advisory; reordering or re-assigning work requires human decision

## Rollout Stage

Stage-11. Strict dependency on Stage-8 (sprint-execution-visibility) and Stage-9 (roadmap-planning). Optionally enriched by Stage-10 outcome-tracking (OKR progress in portfolio digest).

## Rollback

Remove `PortfolioManager`, `PortfolioAggregator`, and `/api/portfolio/*` routes. No persistent state beyond the portfolio definition records in LanceDB. Removing the module does not affect any per-project roadmap or sprint data.

## Non-Goals

- Not a programme management office (PMO) tool
- Not replacing dedicated portfolio tools (e.g. Jira Plans / Advanced Roadmaps) — this is a lightweight composition layer
- Not modelling dependencies at the individual ticket level across projects (epic-level only)
- Not providing executive financial reporting
