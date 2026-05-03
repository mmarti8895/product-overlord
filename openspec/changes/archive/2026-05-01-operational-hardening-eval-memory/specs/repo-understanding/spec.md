## MODIFIED Requirements

### Requirement: Reflection-driven repo memory updates
Component dossiers and fix-pattern memory SHALL be updatable via promoted reflection candidates only. Each update SHALL record the source reflection candidate ID, reviewer, and promotion timestamp.

#### Scenario: Component dossier updated
- **WHEN** a reflection reveals that a predicted component was incorrect and the actual component is confirmed by a reviewer
- **THEN** the component dossier for the actual component SHALL be updated with the new fix example and the incorrect prediction SHALL be recorded as a negative example
