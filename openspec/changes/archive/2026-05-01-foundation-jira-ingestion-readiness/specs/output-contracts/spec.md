## ADDED Requirements

### Requirement: Readiness action package schema
The system SHALL produce a structured readiness action package for every analysis run conforming to the following schema: `ticket_key`, `ticket_type`, `readiness_status`, `readiness_score`, `missing_items` (array of `{ dimension, severity, reason }`), `questions_for_pm` (array), `questions_for_engineer` (array), `manual_checks` (array), `confidence`, and `evidence` (array of trace references).

#### Scenario: Complete package emitted
- **WHEN** the readiness engine completes analysis of a ticket
- **THEN** the output SHALL include all required fields; no field SHALL be absent or `undefined`

#### Scenario: Evidence bundle retained
- **WHEN** any analysis run completes (regardless of verdict)
- **THEN** the evidence bundle SHALL contain: adapter traces, normaliser output, scorer inputs/outputs, verdict, and ISO-8601 timestamp

---

### Requirement: Jira comment draft output
The system SHALL produce a human-readable Jira comment draft summarising the readiness verdict, score, missing items, and clarification questions. The draft SHALL be presented to the user for approval before any Jira write is attempted. The system SHALL NOT post the comment autonomously.

#### Scenario: Draft presented for approval
- **WHEN** the analysis completes and produces a `needs_clarification` verdict
- **THEN** a formatted Jira comment draft SHALL be returned to the user interface with an explicit "Post to Jira?" confirmation prompt

#### Scenario: No autonomous post
- **WHEN** the user does not explicitly confirm the post
- **THEN** the system SHALL NOT write to Jira and SHALL discard the draft after the session ends

---

### Requirement: Auditability
Every analysis run SHALL be assigned a unique run ID. The run ID SHALL appear in the evidence bundle, the Jira comment draft, and any emitted output package. Run records SHALL be retained for at least 90 days.

#### Scenario: Run ID traceable
- **WHEN** a Jira comment is posted (human-approved)
- **THEN** the comment SHALL include the run ID so the originating analysis can be retrieved from the audit store
