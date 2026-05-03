# Proposal: roadmap-planning

## Problem

Every ticket in the system exists in isolation. There is no concept of epics, milestones, quarters, or strategic bets. PMs cannot answer "what are we shipping this quarter?", "which epics are blocked?", or "how do we prioritise between these two initiatives?" The system scores individual tickets for readiness but has no aggregate view.

## Intent

Add a **RoadmapPlanner** capability that models the epic → milestone → quarter hierarchy, aggregates readiness and repo-confidence signals upward, supports RICE/ICE prioritisation scoring, surfaces cross-epic dependency graphs, and renders a quarterly roadmap view in the desktop UI.

## Scope

**In scope:**
- `Epic` and `Milestone` types extending `CanonicalTicket` hierarchy
- `EpicAggregator`: rolls up child ticket readiness scores → epic health score
- `PrioritisationEngine`: RICE (Reach × Impact × Confidence ÷ Effort) and ICE scoring from ticket fields + LLM enrichment
- Cross-epic dependency graph: surfaces when Epic B blocks Epic A even across teams
- `RoadmapStore`: in-process store of quarterly roadmap state (milestones, epics, bets)
- `GET /api/roadmap/:projectKey` — snapshot of current roadmap state
- `GET /api/roadmap/:projectKey/epics/:epicKey` — drill-down with child ticket statuses
- UI panel: `RoadmapPanel` with timeline view, RICE table, and dependency graph

**Out of scope:**
- Automatically creating or modifying epics in Jira (no autonomous writes)
- Capacity planning (portfolio capability)
- OKR linkage (outcome-tracking capability)
- Portfolio-level cross-project view (portfolio-management capability)

## Assumptions

- Jira epics are fetchable via `GET /board/{boardId}/epic` (Jira Agile REST)
- Epic → ticket parent linkage is available in `raw_fields.parent` or `epic_link`
- RICE "Reach" and "Impact" are estimated from ticket labels and LLM enrichment (no direct analytics data — that comes in outcome-tracking)
- Milestones map to Jira fix versions or manually-defined quarters

## Human Approval Points

- RICE scores are suggestions — humans must confirm prioritisation order before any roadmap is committed
- Cross-epic dependency flags are advisory; no automatic reordering
- Roadmap state is local-only until explicitly published (future Confluence write path)

## Rollout Stage

Stage-9. Depends on Stage-8 (sprint-execution-visibility) for sprint context, and Stage-5/6 for LLM enrichment.

## Rollback

Remove `RoadmapStore`, `EpicAggregator`, `PrioritisationEngine`, and `/api/roadmap/*` routes. No persistent writes to Jira.

## Non-Goals

- Not a gantt chart tool
- Not replacing product strategy conversations — surfaces data, doesn't make decisions
- Not managing team staffing or resourcing
