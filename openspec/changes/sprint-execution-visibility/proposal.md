# Proposal: sprint-execution-visibility

## Problem

The system knows whether a ticket is *ready to start* but goes completely dark once work begins. PMs have no way to see sprint health, detect blockers early, identify scope creep, or produce stakeholder progress reports without manually querying Jira. The `jira-agile-rest` adapter already fetches board/sprint/backlog data — that signal is currently unused after ingestion.

## Intent

Add a **SprintMonitor** module that runs as a background service, consuming live Jira sprint data to produce: velocity trends, blocker escalation alerts, scope creep detection (mid-sprint story additions), and a structured progress snapshot suitable for stakeholder reporting.

## Scope

**In scope:**
- `SprintMonitor` service: polls or receives webhook events for active sprint state
- Velocity tracker: completed story points vs. committed, per sprint, rolling 6-sprint trend
- Blocker detector: tickets in `Open`/`To Do` with dependencies also `Open` AND past sprint midpoint
- Scope creep detector: tickets added to sprint after it started, weighted by size
- Progress snapshot: structured `SprintSnapshot` type exposed via `GET /api/sprint/:boardId/snapshot`
- SSE event stream for live sprint changes via `AgentEventBus`
- UI panel: `SprintHealthPanel` with velocity gauge, blocker list, scope delta badge

**Out of scope:**
- Automatic sprint planning or story estimation (Stage 2 / roadmap capability)
- Modifying sprint contents (no autonomous Jira writes — invariant 11)
- Capacity planning across teams (portfolio capability)

## Assumptions

- Jira board IDs are already known via `ConnectionManager` / `JiraConfig`
- `jira-agile-rest` adapter's `GetAllSprints` and `GetIssuesForBoard` are sufficient data sources
- Velocity is calculated from `story_points` custom field (or `original_estimate` as fallback)
- "Scope creep" = ticket added after `sprint.startDate` with `created > sprint.startDate`

## Human Approval Points

- No Jira writes in this change — read-only monitoring throughout
- Stakeholder progress reports are drafted locally; publishing to Confluence requires human confirmation (future `prd-generation` change)
- Blocker escalation surfaces alerts in the UI; it does NOT auto-assign or transition tickets

## Rollout Stage

Stage-8 (new). Builds on Stage-7 (agent-orchestration-ui) and Stage-5 (runtime server).

## Rollback

Remove the `SprintMonitor` background service and the `/api/sprint/*` routes. No persistent state is written — all data is derived from live Jira API calls.

## Non-Goals

- Not a full Jira replacement dashboard
- Not predicting sprint outcomes via ML (out of scope for this change)
- Not managing team capacity or headcount
