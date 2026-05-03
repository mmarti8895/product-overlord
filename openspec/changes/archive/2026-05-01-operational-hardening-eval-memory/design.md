## Context

Stages 1 and 2 produce high-quality plans but have no feedback loop. Human corrections are lost, readiness policies drift, and there is no objective measure of plan quality. This design covers the gold-set evaluation framework, the Reflection Agent, the memory-promotion review workflow, shadow-mode replay, the audit dashboard, permission-boundary testing, and the optional deep-research subagent path.

## Goals / Non-Goals

**Goals:**
- Reproducible, versioned evaluation against human-labeled gold sets
- Structured reflection → human review → memory promotion pipeline
- Shadow-mode replay without production writes
- Audit dashboard for observability and debugging
- Permission-boundary test suite
- Isolated deep-research subagent (opt-in, rate-limited)

**Non-Goals:**
- Fully automated memory promotion without human review
- Forge embedding (stage 4)
- Changes to ingestion or repo-grounding logic (stages 1–2)

## System Architecture

```mermaid
flowchart LR
    subgraph Production path
        O[Orchestrator\nstages 1+2]
        ES[Evidence Store]
    end

    subgraph Evaluation loop
        GS[Gold-Set Store\nversioned · human-labeled]
        ER[Eval Runner\nread-only shadow mode]
        ED[Eval Dashboard\nmetrics · regressions]
    end

    subgraph Learning loop
        RA[Reflection Agent\nasync]
        RQ[Reflection Queue\npending candidates]
        PR[Promotion Reviewer\nhuman gate]
        RM2[Readiness Policy Memory]
        REPO[Repo Memory Store]
    end

    subgraph Observability
        AD[Audit Dashboard\nbundles · traces · correction log]
    end

    O --> ES
    ES --> RA
    RA --> RQ
    RQ --> PR
    PR -->|approved| RM2
    PR -->|approved| REPO
    GS --> ER
    ER --> ED
    ES --> AD
    RQ --> AD
    PR --> AD
```

## Reflection Sequence

```mermaid
sequenceDiagram
    participant U  as User
    participant O  as Orchestrator
    participant RA as Reflection Agent
    participant RQ as Reflection Queue
    participant PR as Promotion Reviewer
    participant PM as Policy Memory
    participant RP as Repo Memory

    U->>O: Correct verdict for ABC-123
    O->>ES: update correction_log(run_id, corrected_verdict)
    O-->>U: correction acknowledged

    O-)RA: enqueue_reflection(run_id) [async]
    RA->>ES: load(run_id) — original prediction + correction
    RA-->>RQ: reflection_candidate{...}

    PR->>RQ: review candidate
    alt Approved
        PR->>PM: promote readiness policy delta
        PR->>RP: promote repo memory delta
        PR->>ES: update promotion_status: approved
    else Rejected
        PR->>ES: update promotion_status: rejected
    end
```

## Component Contracts

### Gold-Set Entry Schema
```json
{
  "id": "gs-001",
  "prompt": "Analyse ABC-123",
  "issue_type": "story",
  "bucket": "needs_clarification",
  "expected_readiness_status": "needs_clarification",
  "expected_missing_dimensions": ["acceptance_criteria"],
  "expected_top_components": ["payments-api"],
  "expected_questions": ["What is the measurable success condition?"],
  "expected_manual_checks": ["Verify webhook idempotency key behaviour"],
  "tags": ["ac-alias", "repo-ambiguity"]
}
```

### Evaluation Metrics
| Metric | Target | Blocking |
|---|---|---|
| Readiness classification agreement | ≥ 85% | Yes |
| Component ranking precision-at-3 | ≥ 80% | Yes |
| Regression vs. previous run | < 5 pp drop | Yes |

### Reflection Candidate Schema
```json
{
  "candidate_id": "rc-uuid",
  "run_id": "run-uuid",
  "original_verdict": "needs_clarification",
  "corrected_verdict": "ready",
  "original_top_components": ["payments-api"],
  "actual_components": ["billing-service"],
  "evidence_delta": {},
  "suggested_policy_update": {},
  "suggested_repo_update": {},
  "status": "pending | approved | rejected",
  "reviewed_by": null,
  "reviewed_at": null
}
```

### Deep-Research Subagent
- Triggered only on explicit user request or `ambiguous` ticket flag
- Rate limit: 30 requests / user / day (calendar day UTC)
- Timeout: 15 minutes; on timeout emit `status: timeout` partial result
- Isolated context: separate MCP session, no shared state with operational subagent
- Results enter the standard evidence store but are tagged `source: deep-research`

## Audit Dashboard Data Model
Each run record exposes: `run_id`, `timestamp`, `trigger`, `verdict`, `score`, `adapter_traces[]`, `agent_outputs{}`, `correction_log[]`, `promotion_status`, `eval_run_id` (if part of shadow replay).

## Permission-Boundary Test Strategy
- Vary invoking credentials across project-A-only, project-B-only, cross-project, and read-only-repo tokens
- Assert zero cross-boundary data in: verdict text, evidence bundle, questions, repo candidates, comment draft
- Run as part of every evaluation suite and as a pre-promotion gate

## Failure Modes & Fallbacks

| Failure | Behaviour |
|---|---|
| Reflection Agent queue full | Drop oldest non-reviewed candidate; log warning |
| Promotion reviewer unavailable | Candidates remain pending; memory unchanged |
| Eval runner timeout | Mark run `partial`; report completed entries only |
| Deep-research timeout | Return `status: timeout` partial; never block primary path |
| Shadow replay Jira read error | Skip affected tickets; log in replay report |
