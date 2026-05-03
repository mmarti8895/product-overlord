## Why

Stages 1 and 2 produce high-quality plans, but without systematic evaluation and a supervised learning loop the system has no way to know whether plan quality is actually improving — or degrading — over time. Human corrections get lost, readiness policies drift, and repo memory goes stale. This change introduces the gold-set evaluation framework, the memory-promotion review workflow, an audit dashboard, and shadow-mode replay so the system can continuously improve and prove it is production-ready.

**Rollout stage:** 3 — Operational Hardening

## What Changes

- Introduce a **readiness gold-set dataset** (≤ 48 labeled tickets: story, bug, task, regression, blocked, ambiguous) with expected verdicts, missing dimensions, top components, clarification questions, and manual checks.
- Introduce a **repo-mapping gold set** with precision-at-3 component labels.
- Introduce a **Reflection Agent** that compares predicted verdict/targets/tests against actual completed work and produces a structured reflection candidate.
- Introduce a **memory-promotion review workflow**: reflection candidates are queued for human review; only approved reflections are promoted into readiness policy memory or repo memory.
- Introduce a **shadow-mode replay** pipeline that replays real production tickets in read-only mode and compares outputs to human triage without posting to Jira.
- Introduce an **audit dashboard** exposing evidence bundles, adapter traces, agent outputs, final verdicts, correction logs, and telemetry per analysis run.
- Introduce **permission-boundary tests** that vary invocation credentials and assert no cross-project, cross-Confluence, or cross-repo data leakage.
- Add deep-research subagent path (isolated, rate-limited: ≤ 30/day, ≤ 15 min) for heavyweight architectural tickets; isolated from the default fast path.

## Capabilities

### New Capabilities

- `evaluation-governance`: Gold-set management, evaluation runs, reflection-candidate lifecycle, memory-promotion review, and shadow-mode replay.

### Modified Capabilities

- `readiness-memory`: Add reflection-driven update path; policy changes MUST pass promotion review before taking effect.
- `repo-understanding`: Add reflection-driven update path for component dossiers and fix-pattern memory; same promotion gate.
- `output-contracts`: Add correction-log and promotion-status fields to the evidence bundle schema.
- `orchestration`: Add Reflection Agent to the post-analysis flow; add deep-research subagent branch (opt-in, isolated).

## Impact

- **New services/modules:** reflection-agent, memory-promotion-review-queue, shadow-replay-pipeline, audit-dashboard, eval-dataset-store, permission-boundary-test-suite.
- **External dependencies:** Atlassian Rovo evaluation flow (CSV datasets, ≤ 50 prompts, ≤ 3 concurrent runs) for the Jira-facing surface; internal gold-set runner for the planning engine.
- **Depends on:** `foundation-jira-ingestion-readiness`, `grounded-planning-repo-mapping`.
- **Assumptions:** Human reviewers are available to approve or reject reflection candidates before promotion. Deep-research path is opt-in and isolated.
- **Non-goals:** Fully automated memory promotion without human review; automated production deployments; Forge embedding (stage 4).
- **Rollback:** Disable reflection agent and shadow-replay pipeline. Memory stores revert to their last human-promoted state.
