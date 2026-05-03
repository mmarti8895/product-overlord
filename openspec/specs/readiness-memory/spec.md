## MODIFIED Requirements

### Requirement: Reflection-driven profile updates
Readiness profiles SHALL be updatable via promoted reflection candidates only. A profile update SHALL record the source reflection candidate ID, the reviewer who approved it, and the timestamp of promotion.

#### Scenario: Profile updated after promotion
- **WHEN** a reflection candidate is approved by a reviewer
- **THEN** the readiness profile for the affected project+issue-type SHALL be updated and the change SHALL be logged with full provenance
## Requirements
### Requirement: Per-project, per-issue-type readiness profiles
The system SHALL maintain a separate readiness profile for each combination of Jira project key and issue type (story, bug, task). Each profile SHALL define the dimensions required for a ticket to be considered `ready`, with severity weights per dimension.

#### Scenario: Story profile applied
- **WHEN** a canonical story ticket is scored against its project's story profile
- **THEN** the scorer SHALL evaluate: business intent, scope boundaries, measurable acceptance criteria, dependencies declared, rollout constraints, and test hints

#### Scenario: Bug profile applied
- **WHEN** a canonical bug ticket is scored against its project's bug profile
- **THEN** the scorer SHALL evaluate: actual behaviour, expected behaviour, reproducible steps, environment, evidence (logs/screenshots), affected services, and exit criteria

#### Scenario: Missing profile — default applied
- **WHEN** no profile exists for a project+issue-type combination
- **THEN** the system SHALL apply a built-in default profile and SHALL log `profile_source: default` in the evidence bundle

---

### Requirement: Readiness verdict and score
The system SHALL produce exactly one of three verdicts for each canonical ticket: `ready`, `needs_clarification`, or `blocked`. The verdict SHALL be accompanied by a numeric readiness score (0–100), a list of missing items with dimension and severity, a confidence estimate (0.0–1.0), and a plain-language explanation.

#### Scenario: All required dimensions present — story
- **WHEN** a story has business intent, measurable acceptance criteria, defined scope, and no unresolved blockers
- **THEN** the verdict SHALL be `ready` with score ≥ 80

#### Scenario: Acceptance criteria absent — story
- **WHEN** a story's `acceptance_criteria` field is null
- **THEN** the verdict SHALL be `needs_clarification`, the missing-items list SHALL include `{ dimension: "acceptance_criteria", severity: "high" }`, and score SHALL be ≤ 50

#### Scenario: Blocked by unresolved dependency
- **WHEN** a ticket's dependencies list contains at least one issue in status `Open` or `To Do` that is a hard blocker
- **THEN** the verdict SHALL be `blocked` with the blocking issue key cited in the explanation

---

### Requirement: Persona-targeted clarification questions
When the verdict is `needs_clarification`, the system SHALL generate specific, minimal questions directed at the correct persona. PM questions SHALL focus on requirements, outcomes, and boundaries. Engineer questions SHALL focus on dependencies, interfaces, rollout constraints, and testability. Bug questions SHALL focus on reproduction, environment, and expected behaviour.

#### Scenario: PM question for missing acceptance criteria
- **WHEN** a story is missing acceptance criteria
- **THEN** at least one generated question SHALL be addressed to the PM persona and SHALL ask for a measurable success condition

#### Scenario: Engineer question for missing dependency declaration
- **WHEN** a story references an external service but no dependency link is declared
- **THEN** at least one generated question SHALL ask the engineer to confirm the interface contract and declare the dependency

---

### Requirement: Profile learning gate
The system SHALL accept human corrections to readiness verdicts. A corrected verdict SHALL be stored as a reflection candidate. A reflection candidate SHALL NOT modify the live readiness profile until a human reviewer explicitly promotes it.

#### Scenario: Human correction recorded
- **WHEN** a user marks a `needs_clarification` verdict as incorrect and provides the actual verdict
- **THEN** the system SHALL store a reflection candidate containing the original verdict, the corrected verdict, and the evidence delta

#### Scenario: Promotion blocked without review
- **WHEN** a reflection candidate exists but has not been reviewed
- **THEN** the readiness profile SHALL remain unchanged and future scorings SHALL continue to use the pre-correction profile

