## MODIFIED Requirements

### Requirement: Forge-compatible output envelope
Action package and Jira comment draft responses SHALL be wrapped in a Forge-compatible envelope when delivered through a Forge action. The envelope SHALL include: `run_id`, `summary` (≤ 500 chars), `verdict`, `score`, `top_missing_items` (max 3), `deep_link` (URL to full package outside Forge), and `confirm_post_url` (for human approval of the Jira comment).

#### Scenario: Envelope delivered to Forge action
- **WHEN** the orchestrator returns an action package via a Forge action endpoint
- **THEN** the response SHALL conform to the Forge envelope schema and all required fields SHALL be present

#### Scenario: Deep link resolves
- **WHEN** the user clicks the `deep_link` in the Forge UI
- **THEN** they SHALL be taken to the full action package in the external planning tool interface
