## ADDED Requirements

### Requirement: HTTP server startup contract
The system SHALL expose all Forge endpoint handlers via an HTTP server process. On startup, the server SHALL validate the environment using a Zod schema. If `BASE_URL` is absent, the server SHALL exit with a non-zero code and a clear error message. If optional adapter tokens (`JIRA_ACCESS_TOKEN`, `ROVO_MCP_ACCESS_TOKEN`, `GITHUB_ACCESS_TOKEN`, `BITBUCKET_ACCESS_TOKEN`) are absent, the server SHALL start in degraded mode, log which capabilities are unavailable, and never log the token values.

#### Scenario: Server starts with full environment
- **WHEN** all required and optional environment variables are set
- **THEN** the server SHALL start, log a startup line including the port and `degraded: false`, and respond to `GET /health` with HTTP 200

#### Scenario: Server starts with missing adapter tokens
- **WHEN** `BASE_URL` is set but adapter tokens are absent
- **THEN** the server SHALL start with degraded-mode flags set, log which capabilities are unavailable (without logging token values), and respond to `GET /health` with HTTP 200

#### Scenario: Server hard-fails on missing BASE_URL
- **WHEN** `BASE_URL` is absent from the environment
- **THEN** the server SHALL exit with a non-zero code before binding to any port

### Requirement: Shadow-mode guard on confirm endpoint
The system SHALL enforce a shadow-mode guard on `POST /forge/output/confirm/:run_id`. When `SHADOW_MODE=true`, this endpoint SHALL return HTTP 403 with a message indicating shadow mode is active. No Jira write SHALL occur.

#### Scenario: Confirm endpoint blocked in shadow mode
- **GIVEN** `SHADOW_MODE=true`
- **WHEN** `POST /forge/output/confirm/:run_id` is called
- **THEN** the response SHALL be HTTP 403 with `{ "error": "shadow mode active" }` and no Jira comment SHALL be posted

### Requirement: CI gate on every push
The repository SHALL include a CI workflow that runs on every push and pull request. The workflow SHALL execute: dependency installation, all tests (`npm test`), TypeScript type-check (`tsc --noEmit`). On pushes to `main` only, the workflow SHALL additionally run the rollout gate check.

#### Scenario: CI blocks a PR with failing tests
- **WHEN** a pull request is opened and tests fail
- **THEN** the CI check SHALL be marked failing and the PR SHALL not be mergeable until tests pass
