## Context

Stage 1 delivers a readiness verdict but no map from ticket language to the codebase. Engineers still locate affected code manually. This design covers the repository adapter, the repo memory store, the Repo Mapper agent, the Solution Planner, the Reviewer agent, and the OpenSpec artifact emitter. All stage-1 components are consumed as-is; this stage adds the repo grounding and synthesis layers above them.

## Goals / Non-Goals

**Goals:**
- Private, least-privilege repository indexing (semantic + structural)
- Parallel execution of readiness analysis and repo-mapping branches
- Conflict-surfacing merge by the Solution Planner
- Reviewer validation gate before any output is emitted
- OpenSpec artifact emission (human-gated write)

**Non-Goals:**
- Autonomous code writes or PR creation
- Forge embedding (stage 4)
- Deep-research subagent (stage 3)

## System Architecture

```mermaid
flowchart LR
    subgraph Stage-1 outputs
        CT[Canonical Ticket]
        RV[Readiness Verdict]
    end

    subgraph Repo Plane
        RA[Repository Adapter\nGitHub Cloud · Bitbucket Cloud]
        RM[Repo Memory Store\ncomponent dossiers · fix patterns]
        MAP[Repo Mapper Agent\nsemantic + structural ranking]
    end

    subgraph Reasoning
        SP[Solution Planner\nmerge · conflict detection]
        REV[Reviewer Agent\nconsistency · permission · evidence]
    end

    subgraph Output
        ES[Evidence Store\nextended with repo traces]
        OE[OpenSpec Artifact Emitter\nhuman-gated write]
        CD[Comment Draft Emitter\nhuman-gated Jira post]
    end

    CT --> MAP
    CT --> SP
    RV --> SP
    RA -->|index| RM
    RM --> MAP
    MAP --> SP
    SP --> REV
    REV -->|approved| OE
    REV -->|approved| CD
    REV --> ES
    SP --> ES
    MAP --> ES
```

## Parallel Execution Sequence

```mermaid
sequenceDiagram
    participant O  as Orchestrator
    participant S1 as Stage-1 Readiness Engine
    participant RA as Repo Adapter
    participant RM as Repo Memory
    participant MAP as Repo Mapper
    participant SP as Solution Planner
    participant REV as Reviewer
    participant OE as OpenSpec Emitter
    participant U  as User

    O->>S1: score(canonical_ticket)
    O->>RA: ensure_index_fresh(repo)

    par Parallel reasoning
        S1-->>O: readiness_result
        RA->>RM: load_component_index
        RM->>MAP: semantic+structural rank
        MAP-->>O: repo_map_result
    end

    O->>SP: merge(readiness_result, repo_map_result)
    SP-->>REV: action_package + evidence

    alt Reviewer approves
        REV-->>O: approved
        O->>U: "Emit OpenSpec + post Jira comment? [Confirm]"
        U-->>O: confirmed
        O->>OE: write openspec/changes/<slug>/
        O->>U: comment draft posted
    else Reviewer rejects
        REV-->>O: rejected + reason
        O-->>U: clarification request
    end
```

## Component Contracts

### Repository Adapter
- **Supported:** GitHub Cloud, Bitbucket Cloud (read access, ≤ 20 GB)
- **Index contents:** component name, root paths, framework/runtime, owners, test dirs, conventions, fix examples
- **Linked-development context:** Teamwork Graph (beta) used for enrichment (PRs, branches, builds) — not sole grounding source
- **Incremental refresh:** on configurable interval; full re-index only on explicit request

### Repo Memory Store (MCP Resources)
```
repo://{repo}/{component}   → component dossier
pattern://{projectKey}/{id} → historical fix pattern
```

### Repo Mapper Agent Output Contract
```json
{
  "ticket_key": "ABC-123",
  "candidate_components": [
    { "name": "payments-api", "confidence": 0.86, "why": "..." }
  ],
  "candidate_files": [
    { "path": "src/payments/webhook.ts", "reason": "..." }
  ],
  "candidate_tests": [
    { "path": "tests/payments/webhook.test.ts", "reason": "..." }
  ],
  "low_confidence": false,
  "test_location_unknown": false,
  "evidence": []
}
```

### Solution Planner Output Contract
```json
{
  "ticket_key": "ABC-123",
  "readiness_status": "ready",
  "readiness_score": 87,
  "candidate_components": [],
  "candidate_files": [],
  "candidate_tests": [],
  "branch_name_suggestion": "ABC-123-improve-webhook-retry",
  "openspec_change_slug": "improve-webhook-retry-observability",
  "operational_risks": [],
  "manual_checks": [],
  "repo_map_confidence": 0.86,
  "low_confidence": false,
  "conflict": null,
  "evidence": []
}
```

### Reviewer Validation Rules
1. All required fields present and non-null (except `conflict`)
2. No referenced data exceeds the invoking user's permission scope
3. Readiness score ≥ minimum threshold OR explicit explanation present
4. `branch_name_suggestion` contains the work-item key
5. `openspec_change_slug` is valid kebab-case

### OpenSpec Artifact Emitter
- Writes to `openspec/changes/<slug>/`: `proposal.md`, `specs/**/*.md`, `design.md`, `tasks.md`
- Requires explicit user confirmation before any disk write
- Logs write event in evidence store with timestamp and run_id

## Failure Modes & Fallbacks

| Failure | Behaviour |
|---|---|
| Repo index unavailable | Emit `repo_map: null`, `reason: repo_index_unavailable`; continue readiness branch |
| Teamwork Graph unavailable | Use structural index only; log `enrichment_source: unavailable` |
| Repo > 20 GB | Reject connection with clear error |
| Reviewer rejects plan | Return to user with rejection reason; do NOT emit |
| Conflict detected | Surface in `conflict` field; never suppress |
