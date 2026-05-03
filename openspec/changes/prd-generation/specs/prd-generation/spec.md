## ADDED Requirements

### Requirement: PRD draft generation with readiness guard
The system SHALL generate a `PRDDraft` for a given ticket key and document type (`prd` | `one-pager` | `release-note`) on demand via `POST /api/prd/:ticketKey/draft`. Before generating, the system SHALL verify that the ticket's `readiness_score >= 0.4`; if below threshold it SHALL return `400` with `{ error: 'readiness_too_low', current_score, threshold: 0.4 }` and SHALL NOT invoke the LLM. Each draft SHALL be versioned (incrementing integer) and stored in LanceDB with `status: 'draft'`.

#### Scenario: Successful PRD draft generation
- **WHEN** `POST /api/prd/ABC-42/draft` is called with `{ document_type: 'prd' }` and `ABC-42` has `readiness_score = 0.75`
- **THEN** the system SHALL retrieve RAG context, call the LLM in structured-output mode, and return a `PRDDraft` with all template sections populated and `status: 'draft'`

#### Scenario: Readiness guard blocks generation
- **WHEN** `POST /api/prd/ABC-10/draft` is called and `ABC-10` has `readiness_score = 0.25`
- **THEN** the system SHALL return `400` with `error: 'readiness_too_low'` and SHALL NOT make any LLM call

#### Scenario: Version increments on regeneration
- **WHEN** a second draft is requested for the same ticket
- **THEN** the new `PRDDraft` SHALL have `version = 2` and the first draft SHALL remain stored with `version = 1`

---

### Requirement: RAG-grounded draft content
The system SHALL ground every PRD draft in context retrieved from LanceDB: related tickets, Confluence pages, and repo file summaries. Each `PRDDraft` SHALL include a `rag_sources` array listing the document IDs, titles, relevance scores, and source types used. When RAG retrieval returns zero results the system SHALL proceed with generation but SHALL include a warning comment in the first section body: `<!-- Low grounding confidence: no related documents found -->`.

#### Scenario: RAG sources recorded in draft
- **WHEN** a PRD draft is generated and LanceDB returns 6 related documents
- **THEN** `draft.rag_sources` SHALL contain exactly those 6 entries each with `doc_id`, `title`, `score`, and `source_type`

#### Scenario: Zero RAG results — warning injected
- **WHEN** the LanceDB embedding search returns 0 results for the ticket summary
- **THEN** the first section of the generated draft SHALL contain `<!-- Low grounding confidence: no related documents found -->`

---

### Requirement: Human review and approval gate
A `PRDDraft` SHALL not be eligible for Confluence publishing until its `status` is explicitly set to `'approved'` via `POST /api/prd/:ticketKey/drafts/:id/approve`. The system SHALL enforce this gate: `POST .../publish` SHALL return `403` with `{ error: 'draft_not_approved' }` if called on a draft with `status = 'draft'`.

#### Scenario: Publish blocked on unapproved draft
- **WHEN** `POST /api/prd/ABC-42/drafts/:id/publish` is called with `status = 'draft'`
- **THEN** the system SHALL return `403 Forbidden` with `{ error: 'draft_not_approved' }`

#### Scenario: Approval unlocks publish
- **WHEN** `POST /api/prd/ABC-42/drafts/:id/approve` is called followed by `POST .../publish`
- **THEN** the publish call SHALL proceed to the Confluence write path

---

### Requirement: Pre-publish Confluence diff
Before publishing, `GET /api/prd/:ticketKey/drafts/:id/diff` SHALL fetch the existing Confluence page for the ticket (if one exists, matched by a configured page title pattern or stored `confluence_url`) and return a section-by-section diff. The UI SHALL display this diff in a `GlassModal` before the publish confirmation button is enabled.

#### Scenario: Diff returned when page exists
- **WHEN** `GET /api/prd/ABC-42/drafts/:id/diff` is called and a Confluence page already exists for `ABC-42`
- **THEN** the response SHALL include `{ existing_page_url, sections_added, sections_changed, sections_removed }`

#### Scenario: Diff returns null when no existing page
- **WHEN** no Confluence page exists for the ticket
- **THEN** the diff endpoint SHALL return `{ existing_page_url: null, sections_added: <all sections>, sections_changed: [], sections_removed: [] }`

---

### Requirement: Draft version history
`GET /api/prd/:ticketKey/drafts` SHALL return all stored drafts for a ticket sorted by `version` descending. Drafts SHALL not be automatically deleted. The `PRDPanel` SHALL render a version history list; clicking a previous version SHALL display it in read-only mode.

#### Scenario: Version history listing
- **WHEN** three drafts exist for ticket `ABC-42` with versions 1, 2, 3
- **THEN** `GET /api/prd/ABC-42/drafts` SHALL return all three, ordered `version: 3, 2, 1`
