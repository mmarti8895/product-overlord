## MODIFIED Requirements

### Requirement: Extended action package schema
The action package schema SHALL be extended from stage 1 to include the following additional fields: `candidate_components` (array of `{ name, confidence, why }`), `candidate_files` (array of `{ path, reason }`), `candidate_tests` (array of `{ path, reason }`), `branch_name_suggestion` (string, MUST include work-item key), `openspec_change_slug` (string), `operational_risks` (array), `manual_checks` (array), `repo_map_confidence` (float), `low_confidence` (bool), `conflict` (object or null).

#### Scenario: Full package with repo grounding
- **WHEN** the Reviewer approves an action package with repo grounding
- **THEN** all fields above SHALL be present and non-null (except `conflict` which may be null when there is no conflict)

#### Scenario: Branch name includes work-item key
- **WHEN** a branch_name_suggestion is generated
- **THEN** it SHALL include the Jira issue key as a prefix or infix (e.g., `ABC-123-improve-webhook-retry`)
