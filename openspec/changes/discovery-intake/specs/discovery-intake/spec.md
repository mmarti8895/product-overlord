## ADDED Requirements

### Requirement: Pluggable feedback adapter ingestion
The system SHALL support a `FeedbackAdapter` interface with concrete implementations for Intercom and Zendesk. Each adapter SHALL accept a `since` ISO timestamp to enable incremental fetches. The `crawl-feedback` stage SHALL iterate all configured adapters, deduplicate against existing LanceDB `feedback_documents` by `source + source_id`, and emit new documents into the existing `normalise → enrich → embed → upsert-lancedb` pipeline. Adapters SHALL be activated only when their credentials are present in `ConnectionManager`.

#### Scenario: Intercom incremental sync
- **WHEN** `POST /api/discovery/sync` is triggered and `IntercomAdapter` is configured with `since = "2026-04-01T00:00:00Z"`
- **THEN** only Intercom conversations created after that timestamp SHALL be fetched and processed

#### Scenario: Deduplication on repeated sync
- **WHEN** the same Intercom conversation ID is returned in two consecutive syncs
- **THEN** only one `FeedbackDocument` SHALL exist in LanceDB for that conversation

#### Scenario: Adapter not configured — silently skipped
- **WHEN** no `ZendeskConfig` is present in `ConnectionManager`
- **THEN** `ZendeskAdapter` SHALL not be invoked; the sync SHALL complete using only the configured adapters

---

### Requirement: Generic webhook feedback ingest
`POST /api/discovery/ingest` SHALL accept `{ source, text, created_at, metadata? }` authenticated with a Bearer token matching `ConnectionManager.webhookSecret`. Received items SHALL be enqueued into the `crawl-feedback` buffer and processed in the next pipeline run. The endpoint SHALL return `202 Accepted` immediately.

#### Scenario: Webhook ingest accepted and processed
- **WHEN** `POST /api/discovery/ingest` is called with a valid token and `{ source: "salesforce", text: "Feature X is blocking deals", created_at: "2026-05-01T10:00:00Z" }`
- **THEN** the system SHALL return `202` and the item SHALL be processed as a `FeedbackDocument` in the next sync run

#### Scenario: Unauthenticated ingest rejected
- **WHEN** `POST /api/discovery/ingest` is called without a valid Bearer token
- **THEN** the system SHALL return `401 Unauthorized` and SHALL NOT enqueue the item

---

### Requirement: Theme clustering
After each `crawl-feedback` cycle the system SHALL cluster all un-themed `FeedbackDocument` records using embedding cosine similarity and k-means (k = min(20, sqrt(N/2))). For each cluster the system SHALL generate a theme name via LLM and identify the 3 most representative quotes (closest to centroid). Themes SHALL be stored as `FeedbackTheme` records. When fewer than 5 documents are available, clustering SHALL be skipped and `warnings: ['too_few_documents_to_cluster']` SHALL be returned. Human-assigned theme names SHALL survive re-clustering and SHALL take precedence over LLM-generated names.

#### Scenario: Themes created after sync
- **WHEN** 30 new `FeedbackDocument` records are processed in a sync cycle
- **THEN** at least 1 `FeedbackTheme` SHALL be created and each document SHALL have `theme_id` set

#### Scenario: Too few documents — clustering skipped
- **WHEN** only 3 un-themed documents are available
- **THEN** clustering SHALL not run and the response SHALL include `warnings: ['too_few_documents_to_cluster']`

#### Scenario: Human theme name preserved on recluster
- **WHEN** a PM renames theme `T-1` to "Login friction" via `PATCH /api/discovery/themes/T-1`
- **THEN** after `POST /api/discovery/recluster` the theme name SHALL remain `"Login friction"`

---

### Requirement: Opportunity sizing and candidate creation
For each `FeedbackTheme` the system SHALL create an `OpportunityCandidate` with an LLM-generated draft title and problem statement. `estimated_reach` SHALL equal the theme's document frequency. `estimated_impact` SHALL be derived from the absolute value of `avg_sentiment` scaled 0–10. Candidates with `status = 'pending'` SHALL be visible in the triage queue.

#### Scenario: Candidate created for each theme
- **WHEN** `ThemeClusterer` produces 4 themes
- **THEN** `OpportunitySizer` SHALL create 4 `OpportunityCandidate` records with `status: 'pending'`

#### Scenario: Reach and impact values
- **WHEN** a theme has 25 documents and `avg_sentiment = -0.7`
- **THEN** the candidate SHALL have `estimated_reach = 25` and `estimated_impact` close to `7.0`

---

### Requirement: Human-gated promotion to Jira ticket
A PM SHALL be able to promote an `OpportunityCandidate` to a draft Jira ticket via `POST /api/discovery/candidates/:id/promote`. The system SHALL call `jira-agile-rest.CreateIssue()` only after this explicit action. The created ticket key SHALL be stored in `promoted_ticket_key` and `status` SHALL be set to `'promoted'`. The system SHALL NOT create Jira tickets autonomously.

#### Scenario: Promote creates Jira ticket
- **WHEN** `POST /api/discovery/candidates/:id/promote` is called with `{ project_key: "DISC", title: "Reduce login friction", description: "Users report…" }`
- **THEN** a Jira issue SHALL be created via `jira-agile-rest`, the candidate's `status` SHALL be `'promoted'`, and `promoted_ticket_key` SHALL be set to the new issue key

#### Scenario: Dismiss records reason
- **WHEN** `POST /api/discovery/candidates/:id/dismiss` is called with `{ reason: "Duplicate of CORE-42" }`
- **THEN** the candidate's `status` SHALL be `'dismissed'` and the reason SHALL be stored; no Jira issue SHALL be created
