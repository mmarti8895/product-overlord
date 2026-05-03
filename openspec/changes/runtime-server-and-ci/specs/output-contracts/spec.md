## MODIFIED Requirements

### Requirement: confirm_post_url must use BASE_URL
The `confirm_post_url` field in every Forge envelope SHALL be constructed using the `BASE_URL` environment variable as its origin. Hardcoded `localhost` or relative URLs are prohibited. This ensures the URL is reachable by Forge and by the Jira user's browser.

#### Scenario: confirm_post_url is absolute and uses BASE_URL
- **GIVEN** `BASE_URL=https://overlord.example.com`
- **WHEN** a Forge envelope is generated for run_id `abc-123`
- **THEN** `confirm_post_url` SHALL equal `https://overlord.example.com/forge/output/confirm/abc-123`

#### Scenario: confirm_post_url is blocked when BASE_URL is absent
- **WHEN** `BASE_URL` is not set
- **THEN** the server SHALL not start (see orchestration spec), preventing any envelope with an invalid `confirm_post_url` from being emitted
