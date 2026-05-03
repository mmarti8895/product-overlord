## Why

Stage 1 produced a readiness verdict but no map from requirement language to the codebase. Engineers still must manually locate the affected components, files, and tests. This change adds repository grounding — a semantic + structural repo memory — and a Solution Planner that synthesises the readiness verdict and repo map into a single implementation package. It also introduces OpenSpec artifact emission so every analysis produces a machine-readable change package alongside the Jira comment draft.

**Rollout stage:** 2 — Grounded Planning

## What Changes

- Introduce a **repository adapter** that indexes a connected GitHub or Bitbucket repository (≤ 20 GB) into a component-level memory using both semantic and structural retrieval.
- Introduce a **repo memory store** containing component dossiers, path summaries, runtime/framework info, ownership hints, test locations, architectural boundaries, coding conventions, and historical fix examples.
- Introduce a **Repo Mapper agent** that ranks components, likely files, and likely tests against the canonical ticket using repo memory.
- Introduce a **Solution Planner** that merges the readiness verdict (from stage 1) and the repo map into an action package: candidate components, files, tests, branch-name suggestion (including work-item key), operational risks, manual checks, and an OpenSpec change slug.
- Introduce a **Reviewer agent** that validates the plan for internal consistency, permission safety, and evidence sufficiency before emitting output.
- Introduce an **OpenSpec artifact emitter** (`output.emitOpenSpecChange`) that writes a proposal-intent + spec-deltas + design-notes + tasks package into the `openspec/changes/` directory.
- Extend the evidence store to capture repo mapper outputs and planner/reviewer traces.

## Capabilities

### New Capabilities

- `repo-understanding`: Index, store, and query a repository memory. Rank components, files, tests, and owners against a canonical ticket.
- `orchestration`: Coordinate the parallel readiness-analysis and repo-mapping branches; merge into a single action package via the Solution Planner and Reviewer.

### Modified Capabilities

- `output-contracts`: Extend the action package schema to include candidate components, files, tests, branch-name suggestion, OpenSpec change slug, and repo-mapper confidence scores.

## Impact

- **New services/modules:** repository-adapter, repo-memory-store, repo-mapper-agent, solution-planner, reviewer-agent, openspec-artifact-emitter.
- **External dependencies:** GitHub Cloud or Bitbucket Cloud (read access, repo ≤ 20 GB); Teamwork Graph linked-development context (beta) used for enrichment only, not as sole grounding source.
- **Depends on:** `foundation-jira-ingestion-readiness` (canonical ticket model, readiness verdict, evidence store).
- **Platform constraints:** Repository indexing is private and least-privilege. Teamwork Graph data is treated as enrichment; structural repo reads remain the authoritative grounding source.
- **Assumptions:** Repository connector is pre-configured with at least read access. Newly connected GitHub content may lag by hours; fresh structural reads supplement Search.
- **Non-goals:** No autonomous code writes or PRs; no Forge embedding; no deep-research subagent path (deferred to stage 3).
- **Rollback:** Disable repository adapter credentials. Existing stage-1 readiness outputs remain unaffected.
