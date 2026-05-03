# Proposal: outcome-tracking

## Problem

The system assesses whether a ticket is *ready to build* but never closes the loop on whether what was built actually moved the needle. Once a ticket transitions to Done, it disappears from the PM's attention. There is no linkage between shipped features and business outcomes, OKR progress, or feature flag adoption data. PMs cannot answer "did that launch work?" without manually pulling analytics.

## Intent

Add an **OutcomeTracker** module that links shipped tickets to OKRs, ingests metrics signals (feature flag evaluations via LaunchDarkly, analytics events, and NPS deltas), and surfaces a post-ship reflection card for each shipped epic. This closes the discovery → build → learn feedback loop and feeds signal back into the `PrioritisationEngine` for future RICE scoring.

## Scope

**In scope:**
- `OKR` type: objective + key results, each key result with a `target`, `current`, `unit`, and `direction` (increase/decrease/maintain)
- `OKRStore`: CRUD for OKRs, stored in LanceDB; linkable to epics and tickets via `linked_okr_keys`
- `MetricsIngestionAdapter`: pluggable adapter interface with concrete implementations for:
  - LaunchDarkly (feature flag evaluation counts and targeting rules)
  - Generic analytics webhook (POST endpoint accepting `{ metric_name, value, timestamp, dimensions }`)
- `OutcomeSnapshot`: per-epic post-ship summary (shipped date, linked OKR deltas, flag adoption %, PM reflection notes)
- `ReflectionAgent`: LLM-powered post-ship analysis that compares acceptance criteria against metric outcomes and drafts a "what we learned" summary
- `POST /api/outcomes/okrs` — create/update an OKR
- `GET /api/outcomes/okrs` — list all OKRs with current progress
- `POST /api/outcomes/:epicKey/snapshot` — trigger post-ship snapshot for an epic
- `GET /api/outcomes/:epicKey/snapshot` — retrieve latest snapshot
- `POST /api/outcomes/metrics/ingest` — generic metrics ingest webhook
- UI panel: `OutcomePanel` with OKR progress bars, feature flag adoption sparklines, and reflection card
- Feed outcome signals back to `PrioritisationEngine` (roadmap-planning): boosts/decays RICE confidence for similar future tickets

**Out of scope:**
- Autonomous OKR updates (PMs confirm metric → OKR linkage)
- Full analytics platform replacement (ingests signals, does not store raw event streams)
- NPS survey collection (outcome-tracking *consumes* NPS deltas from discovery-intake; does not own the survey pipeline)
- Capacity or resourcing impact of outcome data (portfolio-management)

## Assumptions

- LaunchDarkly API key is configurable in `ConnectionManager`
- Metric ingestion webhooks are authenticated via a shared secret (Bearer token in `ConnectionManager` config)
- OKR quarters align with roadmap milestones defined in the roadmap-planning change
- "Shipped" is defined as ticket transitioning to a configured `done_status` in Jira (already tracked by sprint-execution-visibility)
- `ReflectionAgent` output is a draft — human reads and optionally publishes via prd-generation's Confluence path

## Human Approval Points

- OKR targets and metric-to-OKR linkages are set and confirmed by a human; the system never autonomously creates or closes an OKR
- `ReflectionAgent` drafts are advisory — a PM must review and annotate before any output is shared or published
- Metric ingestion webhooks require explicit configuration; no analytics source is connected without a human enabling it

## Rollout Stage

Stage-10 (parallel to prd-generation). Depends on Stage-9 (roadmap-planning) for epic and OKR linkage, and Stage-8 (sprint-execution-visibility) for shipped-ticket detection. LaunchDarkly adapter is optional and activates only when configured.

## Rollback

Remove `OutcomeTracker`, `OKRStore`, `MetricsIngestionAdapter`, `ReflectionAgent`, and `/api/outcomes/*` routes. OKR records in LanceDB are inert. No changes to Jira or any external analytics system.

## Non-Goals

- Not an A/B testing platform
- Not a full BI or dashboarding tool
- Not attributing revenue to individual features (intent is directional signal, not financial accounting)
- Not automating OKR grading or quarterly reviews
