# Tasks: discovery-intake

## 1. Types

- [ ] 1.1 Create `src/types/discovery.ts` with `FeedbackDocument`, `FeedbackTheme`, `OpportunityCandidate` interfaces
- [ ] 1.2 Add `'feedback'` to `CrawlDocument` `doc_type` union in `src/knowledge/types.ts`

## 2. Adapters

- [ ] 2.1 Define `FeedbackAdapter` interface and `RawFeedbackItem` type in `src/adapters/feedback/index.ts`
- [ ] 2.2 Implement `IntercomAdapter` (`src/adapters/feedback/intercom.ts`):
  - [ ] 2.2a `GET /conversations` filtered by configured tags + `created_after: since`
  - [ ] 2.2b Strip HTML from conversation body; trim to 2000 chars
  - [ ] 2.2c Map Intercom labels → `tags[]`
  - [ ] 2.2d Graceful 4xx/5xx handling — log `adapter_degraded: intercom`; return empty array
- [ ] 2.3 Implement `ZendeskAdapter` (`src/adapters/feedback/zendesk.ts`):
  - [ ] 2.3a `GET /search?query=type:ticket tags:{tags} created_after:{since}`
  - [ ] 2.3b Extract subject + description body
  - [ ] 2.3c Map organisation custom field → `customer_segment` if configured
- [ ] 2.4 Implement `WebhookAdapter` (`src/adapters/feedback/webhook.ts`):
  - [ ] 2.4a Register `POST /api/discovery/ingest` — Bearer token auth; return `202 Accepted`
  - [ ] 2.4b Enqueue `RawFeedbackItem` into `crawl-feedback` buffer

## 3. Pipeline Stage

- [ ] 3.1 Create `crawl-feedback` stage (`src/workflows/stages/crawl-feedback.ts`):
  - [ ] 3.1a Iterate all configured `FeedbackAdapter` instances from `ConnectionManager`
  - [ ] 3.1b Deduplicate by `source + source_id` against LanceDB `feedback_documents`
  - [ ] 3.1c Emit new items as `CrawlDocument` with `doc_type: 'feedback'` into the pipeline
  - [ ] 3.1d Update `lastSyncTimestamp` per adapter in `ConnectionManager` state on completion
- [ ] 3.2 Register `crawl-feedback` as the first stage in `WorkflowEngine` (activated when at least one `FeedbackAdapter` is configured)
- [ ] 3.3 Extend `normalise` stage to handle `doc_type: 'feedback'` → produce `FeedbackDocument` records in LanceDB instead of `CanonicalTicket`

## 4. Services

- [ ] 4.1 Implement `ThemeClusterer` (`src/services/theme-clusterer.ts`):
  - [ ] 4.1a Query LanceDB for `FeedbackDocument` records with `theme_id = null`
  - [ ] 4.1b Cosine similarity k-means with `k = min(20, Math.ceil(Math.sqrt(N/2)))` — skip if N < 5 and return `warnings: ['too_few_documents_to_cluster']`
  - [ ] 4.1c LLM theme naming per cluster (3–5 words)
  - [ ] 4.1d Preserve human-assigned names on recluster (`name` field not overwritten if set by PATCH)
  - [ ] 4.1e Assign `theme_id` to each document; persist `FeedbackTheme` records
  - [ ] 4.1f Select 3 representative quotes (closest to centroid)
- [ ] 4.2 Implement `OpportunitySizer` (`src/services/opportunity-sizer.ts`):
  - [ ] 4.2a `estimated_reach = theme.frequency`
  - [ ] 4.2b `estimated_impact = Math.abs(theme.avg_sentiment) * 10` (capped at 10)
  - [ ] 4.2c LLM prompt for `title` + `problem_statement` (JSON structured output)
  - [ ] 4.2d Create `OpportunityCandidate` with `status: 'pending'` in LanceDB
- [ ] 4.3 Implement `TriageQueue` (`src/stores/triage-queue.ts`):
  - [ ] 4.3a `promote(id, { project_key, title, description })` — call `jira-agile-rest.CreateIssue()`; update candidate
  - [ ] 4.3b `dismiss(id, reason)` — set `status = 'dismissed'`, store reason
  - [ ] 4.3c List pending candidates from LanceDB

## 5. API Routes

- [ ] 5.1 Create `src/server/routes/discovery.ts` with 9 routes (see design.md)
- [ ] 5.2 Register discovery router in `src/server/app.ts`

## 6. UI

- [ ] 6.1 Create `discoveryStore` (Zustand) in `ui/src/stores/discoveryStore.ts`
- [ ] 6.2 Add React Query hooks: `useDiscoveryThemes()`, `useDiscoveryTheme(id)`, `useOpportunityCandidates()`
- [ ] 6.3 Implement `DiscoveryPanel` (`ui/src/panels/DiscoveryPanel.tsx`):
  - [ ] 6.3a **Theme Cards Tab** — grid of `GlassCard` per theme (name, frequency badge, sentiment indicator); expand for quotes + candidate; "Rename" inline input; "Merge into…" dropdown
  - [ ] 6.3b **Triage Queue Tab** — list of candidate cards with promote/dismiss buttons; promote → `GlassModal` with editable Jira fields + "Confirm & Create" button; dismiss → `GlassModal` for reason
  - [ ] 6.3c **Sentiment Timeline Tab** — line chart (per-week avg sentiment, theme filter); install `recharts` or equivalent
- [ ] 6.4 Register `DiscoveryPanel` route in app shell sidebar and router

## 7. Tests

- [ ] 7.1 Unit: `IntercomAdapter` — mocked HTTP, tag filtering, HTML stripping, `since` parameter, failure path
- [ ] 7.2 Unit: `ZendeskAdapter` — mocked HTTP, segment mapping, failure path
- [ ] 7.3 Unit: `crawl-feedback` stage — deduplication (known source_id skipped), new item emitted, lastSyncTimestamp updated
- [ ] 7.4 Unit: `ThemeClusterer` — k-means with fixture embeddings, too-few-docs skip, human name preservation, representative quotes selection
- [ ] 7.5 Unit: `OpportunitySizer` — reach/impact formula, LLM problem statement, null on LLM failure (theme still created)
- [ ] 7.6 Unit: `TriageQueue` — promote creates Jira issue + updates candidate, dismiss stores reason, promote fails (Jira error) → candidate stays pending
- [ ] 7.7 Integration: full `crawl-feedback` → normalise → embed pipeline with mocked Intercom adapter
- [ ] 7.8 Contract: all 9 API routes — sync trigger, ingest (auth/unauth), theme CRUD, candidate promote/dismiss
- [ ] 7.9 UI: `DiscoveryPanel` — theme cards render, triage promote modal flow, dismiss modal flow, empty state
