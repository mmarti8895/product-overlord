## Why

Jira tickets are understandable to humans but not actionable for agents. The missing pieces are hidden project conventions, unstated definitions of ready, absent measurable acceptance criteria, and no map from requirement language to the target repository. This change delivers the stable foundation that every subsequent stage depends on: board-aware ingestion, canonical ticket normalization, and a scored readiness verdict — all read-only, with Jira comment drafts as the only output.

**Rollout stage:** 1 — Foundation

## What Changes

- Introduce a **Rovo MCP adapter** for issue/project/JQL search and Rovo natural-language fetch.
- Introduce a **Jira Agile REST adapter** for deterministic board, backlog, sprint, and configuration reads.
- Introduce a **canonical ticket normalizer** that merges both adapter outputs into a single internal schema, recognising all Atlassian acceptance-criteria field aliases (Acceptance Criteria, AC, ACs, Business Requirements, Functional Requirements, Requirements, Definition of Done, DoD).
- Introduce a **readiness policy engine** that scores tickets against a per-project, per-issue-type definition-of-ready profile and produces one of three verdicts: `ready`, `needs_clarification`, or `blocked`.
- Introduce a **clarification question generator** that emits targeted questions addressed to the right persona (PM, engineer, or QA).
- Introduce a **Jira comment draft emitter** as the sole write-path output; no autonomous Jira writes; human must approve before posting.
- Introduce an **evidence store** that retains adapter traces, agent outputs, and final verdict for every analysis run.

## Capabilities

### New Capabilities

- `jira-ingestion`: Ingest tickets from board, backlog, sprint, direct issue key, JQL, and natural-language search via Rovo MCP and Jira Agile REST. Normalize results into the canonical ticket schema.
- `readiness-memory`: Learn and apply a per-project, per-issue-type definition-of-ready profile. Score tickets, produce verdicts, and generate persona-targeted clarification questions.
- `output-contracts`: Define the structure of the readiness action package (verdict, score, missing items, questions, evidence bundle) and the Jira comment draft format.

### Modified Capabilities

_(none — this is the initial change)_

## Impact

- **New services/modules:** rovo-mcp-adapter, jira-agile-rest-adapter, ticket-normalizer, readiness-policy-engine, clarification-generator, jira-comment-draft-emitter, evidence-store.
- **External dependencies:** Atlassian Rovo MCP server (OAuth 2.1 / API token), Jira Software Agile REST API.
- **Platform constraints:** All adapter calls are read-only in this stage. The comment-draft emitter produces a payload for human review but does not post autonomously.
- **Assumptions:** The invoking user has at minimum read access to the target Jira project and board. Repository grounding is deferred to stage 2.
- **Non-goals:** No repository analysis, no OpenSpec artifact emission, no autonomous Jira writes, no Forge embedding — all deferred to later stages.
- **Rollback:** Because all writes are human-gated, rollback is a no-op; disabling the adapter credentials is sufficient to halt the system.
