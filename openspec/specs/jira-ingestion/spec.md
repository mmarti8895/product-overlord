# jira-ingestion Specification

## Purpose
TBD - created by archiving change foundation-jira-ingestion-readiness. Update Purpose after archive.
## Requirements
### Requirement: Multi-source ticket ingestion
The system SHALL ingest Jira tickets from all of the following entry points: board, backlog, sprint, direct issue key, JQL query, and Rovo natural-language search. It SHALL use the Jira Agile REST API for board, backlog, sprint, and configuration reads, and Rovo MCP for issue fetch, project context, and natural-language discovery.

#### Scenario: Board sweep ingestion
- **WHEN** the orchestrator is triggered with a board ID
- **THEN** it SHALL retrieve all issues from that board's current sprint and backlog via Jira Agile REST and normalise each into a canonical ticket

#### Scenario: Direct issue key ingestion
- **WHEN** the orchestrator receives a Jira issue key (e.g. `ABC-123`)
- **THEN** it SHALL fetch the full issue via Rovo MCP and return a single canonical ticket

#### Scenario: JQL ingestion
- **WHEN** the orchestrator receives a JQL string
- **THEN** it SHALL execute the query via Rovo MCP JQL search and return canonical tickets for all matching results

#### Scenario: Natural-language discovery
- **WHEN** the orchestrator receives a plain-language description (e.g. "find all open payment bugs")
- **THEN** it SHALL use Rovo natural-language search to identify matching issues and return canonical tickets

---

### Requirement: Canonical ticket normalisation
The system SHALL normalise every ingested ticket into a single canonical schema that includes: summary, description, issue type, status, labels, priority, reporter, assignee, linked artifacts, dependencies, comments, issue metadata, and the acceptance-criteria field family. It SHALL recognise the following acceptance-criteria aliases: Acceptance Criteria, AC, ACs, Business Requirements, Functional Requirements, Requirements, Definition of Done, DoD.

#### Scenario: Acceptance-criteria alias detection — story
- **WHEN** a story has a custom field named "Definition of Done" containing measurable outcomes
- **THEN** the canonical ticket's `acceptance_criteria` field SHALL be populated with that content

#### Scenario: Acceptance-criteria alias detection — missing
- **WHEN** none of the recognised alias fields contain content
- **THEN** the canonical ticket's `acceptance_criteria` field SHALL be `null` and the missing-items list SHALL include `{ dimension: "acceptance_criteria", severity: "high" }`

#### Scenario: Dependency normalisation
- **WHEN** a ticket has "is blocked by" or "depends on" links to other issues
- **THEN** the canonical ticket's `dependencies` array SHALL list each linked issue key and relationship type

---

### Requirement: Adapter fallback behaviour
The system SHALL degrade gracefully when one adapter is unavailable. If the Jira Agile REST adapter is unavailable, the system SHALL fall back to Rovo MCP issue fetch for individual tickets and SHALL log the degradation in the evidence bundle. If the Rovo MCP adapter is unavailable, the system SHALL return an error verdict of `blocked` with reason `adapter_unavailable` rather than a partial result.

#### Scenario: Agile REST unavailable during board sweep
- **WHEN** the Jira Agile REST adapter returns a 5xx error
- **THEN** the system SHALL retry up to 3 times with exponential back-off, then log `adapter_degraded: jira-agile-rest` in the evidence bundle and attempt individual issue fetch via Rovo MCP for known issue keys

#### Scenario: Both adapters unavailable
- **WHEN** both Rovo MCP and Jira Agile REST return errors after retries
- **THEN** the system SHALL emit a `blocked` verdict with `reason: adapter_unavailable` and SHALL NOT produce a partial or fabricated canonical ticket

---

### Requirement: Permission fidelity on ingestion
The system SHALL ingest only tickets visible to the invoking user's credentials. It SHALL NOT cross project boundaries unless the user's token grants access to those projects.

#### Scenario: Cross-project JQL with partial access
- **WHEN** a JQL query spans multiple projects and the user only has access to a subset
- **THEN** the system SHALL return canonical tickets only for the accessible projects and SHALL note inaccessible projects in the evidence bundle

