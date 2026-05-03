## ADDED Requirements

### Requirement: Gold-set dataset management
The system SHALL maintain a versioned gold-set dataset of at least 48 labeled tickets covering story, bug, task, regression, blocked, and ambiguous issue types. Each entry SHALL include: prompt, expected readiness status, expected missing dimensions, expected top-3 components, expected clarification questions, and expected manual checks. At least 10 entries SHALL test acceptance-criteria alias handling; at least 10 SHALL test repo-mapping ambiguity; at least 6 SHALL test permission-sensitive evidence.

#### Scenario: Gold set loaded for evaluation
- **WHEN** an evaluation run is triggered
- **THEN** the system SHALL load the current gold-set version and run all entries through the planning engine in read-only shadow mode

#### Scenario: Gold-set update requires review
- **WHEN** a new ticket is proposed for addition to the gold set
- **THEN** it SHALL not be included in scored evaluations until a human reviewer approves it

---

### Requirement: Evaluation metrics and targets
The system SHALL measure and report: readiness-classification agreement with human labels (target ≥ 85%), component-ranking precision-at-3 (target ≥ 80%), and any regressions vs. the previous evaluation run. Results SHALL be persisted per run with timestamp, model version, and schema version.

#### Scenario: Classification agreement below target
- **WHEN** readiness-classification agreement falls below 85% on the gold set
- **THEN** the evaluation run SHALL be marked `failing` and the system SHALL NOT advance to the next rollout stage until the issue is resolved

#### Scenario: Regression detected
- **WHEN** a metric regresses by more than 5 percentage points vs. the previous run
- **THEN** the system SHALL surface a regression alert with the affected cases identified

---

### Requirement: Reflection agent and memory-promotion workflow
After a ticket is completed, declined, or corrected by a human, the Reflection Agent SHALL produce a structured reflection candidate comparing: predicted verdict, predicted missing fields, predicted repo targets, and proposed tests against what actually happened. Reflection candidates SHALL enter a human-review queue; only approved candidates SHALL be promoted into readiness policy memory or repo memory.

#### Scenario: Reflection candidate created on correction
- **WHEN** a user corrects a readiness verdict
- **THEN** the Reflection Agent SHALL store a candidate containing: original prediction, correction, evidence delta, and suggested policy update

#### Scenario: Promotion blocked without review
- **WHEN** a reflection candidate exists in the queue
- **THEN** live readiness profiles and repo memory SHALL remain unchanged until a reviewer explicitly approves or rejects the candidate

---

### Requirement: Shadow-mode replay
The system SHALL support a shadow-mode replay pipeline that re-runs production tickets in read-only mode, compares outputs to human triage records, and surfaces quality deltas without posting to Jira.

#### Scenario: Shadow replay run
- **WHEN** the shadow pipeline is triggered for a date range
- **THEN** it SHALL replay all production tickets from that range, produce action packages, compare against human triage records, and emit a diff report

---

### Requirement: Permission-boundary enforcement
The system SHALL enforce that no analysis output leaks data across Jira project boundaries, Confluence spaces, or repository access scopes. Permission-boundary tests SHALL be part of the standard evaluation suite.

#### Scenario: Cross-project data isolation
- **WHEN** the invoking user has access to project A but not project B
- **THEN** no output — verdict, evidence, questions, repo data — from project B SHALL appear in any analysis output for project A tickets
