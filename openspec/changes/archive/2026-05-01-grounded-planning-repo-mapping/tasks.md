## 1. MVP — Repository Adapter & Memory

- [x] 1.1 Implement repository adapter for GitHub Cloud and Bitbucket Cloud (read access, ≤ 20 GB guard)
- [x] 1.2 Implement component indexer: extract component name, root paths, framework/runtime, owners, test dirs, conventions, fix examples
- [x] 1.3 Implement Teamwork Graph enrichment layer (beta): linked PRs, branches, builds — flagged as enrichment-only, not sole grounding
- [x] 1.4 Implement incremental index refresh on configurable interval; full re-index on explicit request
- [x] 1.5 Expose repo memory as MCP resources: `repo://{repo}/{component}`, `pattern://{projectKey}/{id}`
- [x] 1.6 Unit-test indexer: component extraction, > 20 GB rejection, incremental diff, missing test-dir flag
- [x] 1.7 Contract-test repository adapter: happy path, private repo, rate-limited response, Teamwork Graph unavailable

## 2. MVP — Repo Mapper Agent

- [x] 2.1 Implement semantic retrieval: embedding similarity between ticket description and component dossiers
- [x] 2.2 Implement structural retrieval: file-path patterns, ownership, historical co-change
- [x] 2.3 Combine semantic + structural scores into ranked candidate list with confidence + rationale
- [x] 2.4 Implement `low_confidence: true` flag when no component scores > 0.5
- [x] 2.5 Implement `test_location_unknown: true` flag when component has no test-dir entry
- [x] 2.6 Unit-test mapper: high-confidence match, low-confidence honest surface, repo unavailable → `blocked` branch

## 3. MVP — Solution Planner, Reviewer & Emitter

- [x] 3.1 Implement parallel orchestration: readiness branch and repo-mapping branch start simultaneously after normalisation
- [x] 3.2 Implement Solution Planner merge: produce full action package including `branch_name_suggestion` (with work-item key), `openspec_change_slug`, `conflict` field
- [x] 3.3 Implement conflict detection: surface `conflict` when readiness=`ready` but repo confidence < 0.3
- [x] 3.4 Implement Reviewer agent with five validation rules (fields present, permission scope, score threshold, branch key, valid slug)
- [x] 3.5 Implement OpenSpec artifact emitter: write proposal.md + specs + design.md + tasks.md to `openspec/changes/<slug>/`; require explicit user confirmation
- [x] 3.6 Integration-test full stage-2 pipeline: ticket → parallel branches → planner → reviewer → emitter → evidence store
- [x] 3.7 Unit-test Reviewer: permission violation blocked, insufficient evidence rejected, conflict surfaced

## 4. Hardening

- [x] 4.1 Test repo-index unavailable: `repo_map: null` returned, readiness branch continues independently
- [x] 4.2 Test Teamwork Graph unavailable: structural index used; `enrichment_source: unavailable` logged
- [x] 4.3 Test one parallel branch fails: other branch continues; failure reason in evidence bundle
- [x] 4.4 Validate that `branch_name_suggestion` always contains the work-item key
- [x] 4.5 Security review: repo index is private; connector uses least-privilege token; no repo data leaks into unauthorised context

## 5. Instrumentation & Rollout

- [x] 5.1 Add latency instrumentation per branch (readiness vs. repo-mapping independently observable)
- [x] 5.2 Add repo-mapper confidence histogram metric
- [x] 5.3 Write AGENTS.md entries: repo memory conventions, component ranking, test-location patterns, OpenSpec change slug format
- [x] 5.4 Build initial repo-mapping gold set (≥ 20 labeled tickets with expected top-3 components)
- [x] 5.5 Gate rollout on: component precision-at-3 ≥ 70% on initial gold set, Reviewer blocking tests passing, ≥ 1 manually reviewed planning session
