## 1. MVP — Gold-Set Dataset & Evaluation Runner

- [x] 1.1 Define gold-set entry schema (id, prompt, issue_type, bucket, expected fields, tags)
- [x] 1.2 Seed initial gold set: ≥ 48 labeled tickets (story, bug, task, regression, blocked, ambiguous); distribute 1/3 ready, 1/3 needs_clarification, 1/3 blocked
- [x] 1.3 Tag ≥ 10 entries for AC-alias handling; ≥ 10 for repo-mapping ambiguity; ≥ 6 for permission-sensitive evidence
- [x] 1.4 Implement eval runner: load gold set → shadow-mode analysis (no Jira writes) → compare outputs vs. labels
- [x] 1.5 Implement evaluation metrics: readiness classification agreement, component precision-at-3, regression vs. previous run
- [x] 1.6 Implement regression alert: fire when any metric drops > 5 pp vs. previous run
- [x] 1.7 Persist each eval run: run_id, timestamp, model version, schema version, per-entry results

## 2. MVP — Reflection Agent & Memory-Promotion Workflow

- [x] 2.1 Implement Reflection Agent: async, non-blocking; triggered on correction / ticket completion / declined plan
- [x] 2.2 Implement reflection candidate schema and reflection queue store
- [x] 2.3 Implement human-review UI for the promotion queue (approve / reject per candidate)
- [x] 2.4 Implement promotion write: approved candidate → readiness profile delta with provenance (candidate_id, reviewer, timestamp)
- [x] 2.5 Implement promotion write: approved candidate → repo memory delta with same provenance
- [x] 2.6 Unit-test that live profile and repo memory are unchanged until approval
- [x] 2.7 Unit-test reflection candidate creation on correction

## 3. MVP — Shadow-Mode Replay & Audit Dashboard

- [x] 3.1 Implement shadow-mode replay pipeline: accepts date range, replays production tickets in read-only mode, emits diff report vs. human triage
- [x] 3.2 Implement audit dashboard data model: run_id, verdict, adapter_traces, agent_outputs, correction_log, promotion_status, eval_run_id
- [x] 3.3 Build audit dashboard UI (or structured log export) with per-run evidence drill-down
- [x] 3.4 Integration-test shadow replay: confirm zero Jira writes, correct diff report format

## 4. Hardening — Permission-Boundary & Security Tests

- [x] 4.1 Implement permission-boundary test suite: vary credentials across project-A-only, project-B-only, cross-project, read-only-repo
- [x] 4.2 Assert zero cross-boundary data in verdict, evidence, questions, repo candidates, comment draft for each credential variant
- [x] 4.3 Run permission-boundary tests as part of every evaluation suite and as a pre-promotion gate
- [x] 4.4 Security review: evidence store access controls, audit log immutability, reflection queue isolation

## 5. Deep-Research Subagent (opt-in)

- [x] 5.1 Implement deep-research subagent with isolated MCP session and `source: deep-research` tagging
- [x] 5.2 Implement rate limiter: 30 requests / user / calendar day UTC; clear error on limit exceeded
- [x] 5.3 Implement 15-minute timeout: cancel job, return `status: timeout` partial, log to evidence store
- [x] 5.4 Integration-test: rate limit enforcement, timeout handling, isolation (no shared state with operational subagent)

## 6. Instrumentation & Rollout

- [x] 6.1 Add evaluation metrics to observability dashboard (classification agreement, precision-at-3 trends over time)
- [x] 6.2 Add promotion queue depth metric and alert on stale candidates (> 7 days unreviewed)
- [x] 6.3 Write AGENTS.md updates: reflection workflow, memory promotion rules, eval dataset conventions
- [x] 6.4 Gate rollout on: readiness classification agreement ≥ 85%, precision-at-3 ≥ 80%, all permission-boundary tests passing, ≥ 1 full shadow-replay run reviewed by team
