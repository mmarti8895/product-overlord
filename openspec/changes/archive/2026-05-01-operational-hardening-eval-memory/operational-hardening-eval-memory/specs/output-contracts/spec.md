## MODIFIED Requirements

### Requirement: Correction-log and promotion-status in evidence bundle
The evidence bundle schema SHALL be extended to include: `correction_log` (array of `{ run_id, original_verdict, corrected_verdict, corrected_by, corrected_at }`) and `promotion_status` (`pending | approved | rejected | n/a`).

#### Scenario: Correction logged
- **WHEN** a user corrects an output and a reflection candidate is created
- **THEN** the original run's evidence bundle SHALL be updated with a correction_log entry
