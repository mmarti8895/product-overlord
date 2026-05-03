## MODIFIED Requirements

### Requirement: Reflection agent in the post-analysis flow
The orchestrator SHALL invoke the Reflection Agent after every analysis run that produces a human correction, a completed ticket, or a declined plan. The Reflection Agent SHALL run asynchronously and SHALL NOT block the primary response path.

#### Scenario: Correction triggers reflection
- **WHEN** a user submits a correction to a readiness verdict
- **THEN** the orchestrator SHALL enqueue a Reflection Agent job within 60 seconds and SHALL NOT hold up the corrected response

---

### Requirement: Deep-research subagent path (opt-in, isolated)
The orchestrator MAY route a ticket to a deep-research subagent when the ticket is flagged as architecturally ambiguous or when the user explicitly requests deep research. The deep-research path SHALL be isolated from the default fast path, rate-limited to 30 requests per user per day, and SHALL time out after 15 minutes.

#### Scenario: Deep-research rate limit exceeded
- **WHEN** a user has already consumed 30 deep-research requests in the current calendar day
- **THEN** the orchestrator SHALL reject the deep-research request with a clear rate-limit message and SHALL offer the standard fast-path analysis instead

#### Scenario: Deep-research timeout
- **WHEN** the deep-research subagent does not complete within 15 minutes
- **THEN** the orchestrator SHALL cancel the job, emit a partial result with `status: timeout`, and log the event in the evidence bundle
