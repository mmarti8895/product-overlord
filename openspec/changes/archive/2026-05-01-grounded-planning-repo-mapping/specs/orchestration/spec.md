## ADDED Requirements

### Requirement: Parallel readiness and repo-mapping execution
The system SHALL execute the readiness analysis branch and the repo-mapping branch in parallel after canonical ticket normalisation is complete. It SHALL NOT wait for one branch before starting the other.

#### Scenario: Parallel branches complete
- **WHEN** both the readiness agent and the repo mapper finish
- **THEN** the Solution Planner SHALL merge their outputs within one orchestration cycle

#### Scenario: One branch fails
- **WHEN** the repo-mapping branch fails but the readiness branch succeeds
- **THEN** the orchestrator SHALL continue with the readiness output, mark `repo_map: null`, and surface the failure reason in the evidence bundle

---

### Requirement: Solution Planner merge
The Solution Planner SHALL merge the readiness verdict and the repo map into a single action package. If readiness and repo evidence conflict (e.g., readiness says `ready` but no component matches with confidence > 0.3), the Planner SHALL surface the conflict explicitly rather than suppressing it.

#### Scenario: Conflict surfaced
- **WHEN** readiness verdict is `ready` but repo mapper returns `low_confidence: true`
- **THEN** the action package SHALL include a `conflict` field explaining the discrepancy and SHALL NOT present the plan as fully confident

#### Scenario: Clean merge
- **WHEN** readiness verdict is `ready` and top component confidence ≥ 0.8
- **THEN** the action package SHALL include candidate components, files, tests, branch-name suggestion (with work-item key), operational risks, manual checks, and OpenSpec change slug

---

### Requirement: Reviewer validation gate
Before the orchestrator emits any action package or OpenSpec artifact, the Reviewer agent SHALL validate the plan for: internal consistency, permission safety (no data the user cannot see), evidence sufficiency, and completeness of required fields.

#### Scenario: Permission violation blocked
- **WHEN** the action package references repository data inaccessible to the invoking user
- **THEN** the Reviewer SHALL reject the plan and return an error; the package SHALL NOT be emitted

#### Scenario: Insufficient evidence blocked
- **WHEN** the plan's readiness score is below the minimum threshold and no explanation is provided
- **THEN** the Reviewer SHALL request clarification from the Planner rather than approving emission

---

### Requirement: OpenSpec artifact emission
The system SHALL emit a valid OpenSpec change package when the Reviewer approves the plan. The package SHALL include: proposal intent, spec deltas (requirements in SHALL/MUST language with scenarios), design notes, and implementation tasks. It SHALL be written to `openspec/changes/<slug>/`.

#### Scenario: Artifact emitted on approval
- **WHEN** the Reviewer approves the action package
- **THEN** the OpenSpec artifact emitter SHALL write proposal.md, specs, design.md, and tasks.md to `openspec/changes/<openspec_change_slug>/`

#### Scenario: Human gate before emission
- **WHEN** the Reviewer approves but the user has not confirmed the write
- **THEN** the emitter SHALL present the package for user confirmation before writing to disk
