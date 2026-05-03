## ADDED Requirements

### Requirement: Forge Rovo agent (stable path)
The system SHALL provide a Forge Rovo agent that exposes the external orchestrator's planning capabilities inside Jira. All Forge actions SHALL delegate to deterministic external HTTP endpoints. Response payloads routed through Forge actions SHALL NOT exceed 5 MB; heavy repository bundles SHALL remain outside Forge and be linked by reference.

#### Scenario: Action delegates to external orchestrator
- **WHEN** a Jira user invokes the Rovo agent action to analyse a ticket
- **THEN** the Forge action SHALL call the external orchestrator endpoint, receive the action package, and display a summary within Jira

#### Scenario: Payload size guard
- **WHEN** the external orchestrator response exceeds 4.5 MB
- **THEN** the Forge action SHALL request a truncated summary response and include a deep-link to the full package

---

### Requirement: rovo:agentConnector remote-agent shell (EAP path)
The system MAY provide a `rovo:agentConnector` shell that projects the external orchestrator as an assignable, @mentionable Jira teammate via an A2A server. This capability SHALL NOT be activated in production without confirmed EAP approval. It SHALL be feature-flagged and disabled by default.

#### Scenario: Remote agent assigned a ticket
- **WHEN** a Jira ticket is assigned to the remote-agent teammate
- **THEN** the A2A server SHALL receive the assignment event, trigger the orchestrator, and post a Jira comment draft pending human approval

#### Scenario: EAP gate enforced
- **WHEN** `rovo:agentConnector` is not EAP-approved for the organisation
- **THEN** the feature flag SHALL remain off and the Forge Rovo agent (stable path) SHALL be the only active surface

---

### Requirement: Subagent knowledge scoping
The Jira-facing subagent SHALL be scoped exclusively to the relevant Jira project, its associated Confluence space, and the repo-doc memory exposed by the Memory MCP server. It SHALL NOT search organisation-wide knowledge by default. A separate heavyweight research subagent MAY be invoked for ambiguous tickets, but it MUST be separately scoped and isolated from the operational subagent.

#### Scenario: Scoped subagent cannot access other projects
- **WHEN** the Jira-facing subagent is invoked in the context of project A
- **THEN** it SHALL have no access to project B's Jira issues, Confluence pages, or repository data unless the invoking user has explicit cross-project access and has granted it

#### Scenario: Research subagent isolated
- **WHEN** the research subagent is invoked
- **THEN** its context, tool access, and output SHALL be isolated from the operational subagent's session
