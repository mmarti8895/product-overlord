## MODIFIED Requirements

### Requirement: Reflection-driven profile updates
Readiness profiles SHALL be updatable via promoted reflection candidates only. A profile update SHALL record the source reflection candidate ID, the reviewer who approved it, and the timestamp of promotion.

#### Scenario: Profile updated after promotion
- **WHEN** a reflection candidate is approved by a reviewer
- **THEN** the readiness profile for the affected project+issue-type SHALL be updated and the change SHALL be logged with full provenance
