## ADDED Requirements

### Requirement: Repository indexing
The system SHALL index a connected GitHub Cloud or Bitbucket Cloud repository (≤ 20 GB) into a component-level memory store. Each component entry SHALL contain: component name, root paths, runtime/framework info, ownership hints, test locations, architectural boundary notes, coding conventions, and examples of similar historical fixes.

#### Scenario: Initial index on connection
- **WHEN** a repository is connected for the first time
- **THEN** the system SHALL index all components and confirm index completion before accepting ranking requests

#### Scenario: Incremental index refresh
- **WHEN** the repository index is older than the configured refresh interval
- **THEN** the system SHALL perform an incremental refresh and update only changed components

#### Scenario: Repo too large
- **WHEN** a repository exceeds 20 GB
- **THEN** the system SHALL reject the connection with a clear error and SHALL NOT attempt partial indexing

---

### Requirement: Semantic and structural component ranking
The system SHALL rank candidate components against a canonical ticket using both semantic retrieval (embedding similarity) and structural retrieval (file-path patterns, ownership, historical co-change). The top-ranked candidates SHALL include a confidence score (0.0–1.0) and a human-readable rationale.

#### Scenario: High-confidence component match
- **WHEN** a ticket's description closely matches a component's domain keywords and historical fix examples
- **THEN** the top-ranked component SHALL have confidence ≥ 0.8 and the rationale SHALL cite the matching evidence

#### Scenario: Low-confidence match surfaced honestly
- **WHEN** no component scores above 0.5
- **THEN** the mapper SHALL return its best candidates with confidence scores and SHALL include a flag `low_confidence: true`; it SHALL NOT fabricate a high-confidence match

#### Scenario: Repo index unavailable
- **WHEN** the repo memory store is unreachable
- **THEN** the system SHALL emit a `blocked` verdict for the repo-mapping branch with `reason: repo_index_unavailable` and SHALL continue the readiness branch independently

---

### Requirement: Candidate file and test identification
In addition to component ranking, the system SHALL identify likely affected files (paths or glob patterns) and likely tests to add or update, based on component conventions and historical fix patterns.

#### Scenario: Test location identified
- **WHEN** a component has a known test directory convention
- **THEN** the mapper SHALL include at least one candidate test path in the output

#### Scenario: No test location known
- **WHEN** the component has no test-location entry in memory
- **THEN** the mapper SHALL flag `test_location_unknown: true` rather than omitting the field
