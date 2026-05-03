# Proposal: discovery-intake

## Problem

Product discovery happens in scattered channels — NPS tools, support tickets, sales CRM notes, Slack threads, user interviews — none of which feed into the system. PMs manually triage this signal and hand-write tickets. There is no automated path from "user pain" to "groomed backlog item". The existing `crawler.ts` pipeline already knows how to fetch, chunk, and embed external content; it just has no adapters for feedback sources.

## Intent

Add a **DiscoveryIntake** module that aggregates feedback signals from multiple sources (NPS platforms, support systems, CRM notes), clusters them into themes using the LLM layer, sizes each opportunity, and creates a draft `CanonicalTicket` ready for human triage. This bootstraps off the existing crawler and embedding pipeline rather than reinventing it.

## Scope

**In scope:**
- `FeedbackAdapter` interface: pluggable source adapter with concrete implementations for:
  - Intercom (conversations tagged as bugs or feature requests)
  - Zendesk (ticket subject + description, filtered by tag)
  - Generic CSV/webhook ingest (`POST /api/discovery/ingest` accepting `{ source, text, metadata }`)
- `FeedbackDocument` type: raw signal unit with `source`, `text`, `sentiment_score`, `created_at`, `customer_segment` fields
- Crawler integration: `FeedbackAdapter` outputs are piped through the existing `normalise → enrich → embed → upsert-lancedb` stages using a new `crawl-feedback` stage
- `ThemeClusterer`: LLM + embedding similarity clustering that groups `FeedbackDocument`s into named themes with frequency and representative quotes
- `OpportunitySizer`: estimates RICE "Reach" from theme frequency, "Impact" from sentiment severity, and produces an `OpportunityCandidate` with a draft title and problem statement
- `OpportunityCandidate → CanonicalTicket` promotion: human reviews candidates in triage UI and promotes to draft ticket (Jira create is gated behind human confirmation)
- `POST /api/discovery/sync` — trigger a full feedback sync from all configured adapters
- `GET /api/discovery/themes` — list current themes with frequency, sentiment, and opportunity candidates
- `GET /api/discovery/candidates` — list `OpportunityCandidate`s awaiting triage
- `POST /api/discovery/candidates/:id/promote` — human-confirmed promote to draft Jira ticket
- UI panel: `DiscoveryPanel` with theme cards, sentiment timeline, and triage queue

**Out of scope:**
- Automatically creating Jira tickets without human triage (invariant 11)
- Running user interviews or surveys (intake only — consumes survey exports, does not conduct surveys)
- Full CRM integration (notes are ingested via webhook; CRM-native sync is a future extension)
- Deduplicating feedback across Jira and discovery (handled by the existing normalise stage)

## Assumptions

- Intercom and Zendesk API credentials are configurable in `ConnectionManager`
- Theme clustering uses the existing LanceDB embedding store for similarity search (no new vector store)
- `crawl-feedback` is a new stage in `WorkflowEngine` inserted before `normalise`, producing `FeedbackDocument` records that are then normalised into `CanonicalTicket` drafts
- Customer segment metadata is optional; clustering works without it
- Promoted tickets start in a "Draft" status; human must explicitly submit them to Jira

## Human Approval Points

- **Triage gate**: all `OpportunityCandidate`s must pass through the triage UI before any Jira ticket is created — no autonomous ticket creation
- **Source enablement**: each feedback adapter requires explicit configuration; no source is connected without human opt-in
- **Theme naming**: AI-generated theme names are editable; PMs rename and merge themes before they influence roadmap planning

## Rollout Stage

Stage-10 (parallel to prd-generation and outcome-tracking). Depends on Stage-4 (embed/upsert-lancedb) and the existing `crawler.ts` pipeline. Opportunity sizing feeds into Stage-9 (roadmap-planning) RICE scores once promoted.

## Rollback

Remove `DiscoveryIntake`, `FeedbackAdapter` implementations, the `crawl-feedback` stage, and `/api/discovery/*` routes. `FeedbackDocument` and `OpportunityCandidate` records in LanceDB are inert. No Jira tickets are created unless a human explicitly promoted one before rollback.

## Non-Goals

- Not a full feedback analytics platform
- Not replacing the PM's judgment in triage — surface signal, do not prescribe decisions
- Not analysing app store reviews or social media (scope may expand in a future change)
- Not managing customer relationships or CRM records
