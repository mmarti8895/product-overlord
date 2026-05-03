## Why

Stages 1–3 deliver a high-quality external planning engine, but product managers and engineers still switch context to use it. Projecting the assistant into Jira as a first-class teammate — assignable, @mentionable, and chattable — removes that friction. This change adds the optional Jira-native shell: a lightweight Forge Rovo agent (stable path) and, once EAP access is confirmed, a `rovo:agentConnector` remote-agent shell (ambitious path). Neither replaces the external orchestrator; both are thin UI projections that delegate to it.

**Rollout stage:** 4 — Jira-Native Teammate (EAP-gated)

## What Changes

- Introduce a **Forge Rovo agent** (stable path) whose Forge actions call the external orchestrator's deterministic HTTP endpoints. Payloads are kept under the 5 MB Forge action limit; heavy repository bundles remain outside Forge.
- Introduce a **`rovo:agentConnector` shell** (EAP/ambitious path) that projects the external orchestrator into Jira as a remote teammate via an A2A server. Requires EAP approval before activating in production.
- Scope the Jira-facing subagent to the **relevant Jira project + associated Confluence space + exposed repo-doc memory only** — not all organisational knowledge.
- Add a separate **heavyweight research subagent** (opt-in, scoped) for ambiguous or architectural tickets; isolated from the default operational subagent.
- Integrate the Forge agent with the existing **human-approval gate**: Forge actions may propose Jira comment posts or field updates, but final write is confirmed by the user inside Jira.
- Add AGENTS.md entries for Jira-native invocation patterns, subagent scoping rules, and branch-name conventions visible to Rovo Dev CLI.

## Capabilities

### New Capabilities

- `jira-native-shell`: Forge Rovo agent and optional `rovo:agentConnector` remote-agent shell; subagent scoping; heavyweight research subagent path.

### Modified Capabilities

- `jira-ingestion`: Expose ingestion entry points as Forge-callable deterministic endpoints (≤ 5 MB response). No requirement changes; implementation boundary only.
- `output-contracts`: Add Forge-compatible response envelope for comment-draft and action-package payloads.

## Impact

- **New services/modules:** forge-rovo-agent, a2a-server (EAP), forge-action-endpoints, research-subagent.
- **External dependencies:** Atlassian Forge (Rovo agent surface, actions); `rovo:agentConnector` EAP program; A2A server infrastructure.
- **Depends on:** All three prior stages (stages 1–3) must be stable and passing evaluation gates.
- **Platform constraints:** Forge action payloads ≤ 5 MB; `rovo:agentConnector` is EAP — do not activate in production without approved EAP access. Teamwork Graph Forge API is EAP-only; use Rovo MCP Teamwork Graph (beta) instead.
- **Assumptions:** External orchestrator has demonstrated ≥ 85% readiness-classification agreement and ≥ 80% component-ranking precision-at-3 on the gold set before this stage begins.
- **Non-goals:** Full Forge-native orchestration (all-in-Forge design); autonomous merge; replacing the external orchestrator.
- **Rollback:** Disable the Forge app and/or `rovo:agentConnector` registration. External orchestrator continues operating independently.
