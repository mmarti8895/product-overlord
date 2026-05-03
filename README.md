# product-overlord

> **Modular Product Management Jira Assistant** — an external orchestration host that ingests Jira tickets via Rovo MCP + Jira Agile REST, scores readiness, generates clarification questions, and emits human-gated Jira comment drafts.

---

## Overview

`product-overlord` is a TypeScript/Node.js system that sits outside your Atlassian instance and acts as an intelligent PM assistant. It analyses Jira tickets, scores their development-readiness, maps them to the relevant repo components, and produces structured action packages — all without ever writing to Jira unless a human explicitly confirms.

```
Jira ticket → normalise → score readiness → map to repo → plan → human gate → Jira comment
```

---

## Architecture

The system is built in four stages, each extending the previous:

| Stage | Name | Summary |
|---|---|---|
| 1 | `foundation-jira-ingestion-readiness` | Ingest, normalise, score, clarify, emit comment drafts |
| 2 | `grounded-planning-repo-mapping` | Repo adapter, component index, solution planner, OpenSpec emitter |
| 3 | `jira-native-teammate-shell` | Forge endpoints, Rovo agent actions, A2A connector (EAP), subagent scoping |
| 4 | `operational-hardening-eval-memory` | Eval gold-set, shadow replay, reflection agent, observability, rollout gate |
| 5 | `runtime-server-ci` | Runtime HTTP server (Hono), CI workflow, env config, shadow-mode guard |
| 6 | `llm-knowledge-base` | LLM enrichment (OpenAI-compat adapter), KT document KB (LanceDB), RAG retrieval, GitHub file fetch |

---

## Key Capabilities

- **Dual ingestion** — Rovo MCP adapter (OAuth 2.1) + Jira Agile REST (board/sprint/backlog) with automatic fallback
- **Deterministic readiness scoring** — weighted dimension scoring across `story`, `bug`, and `task` profiles; no LLM calls in the hot path
- **Repo grounding** — GitHub Cloud + Bitbucket Cloud adapter; component dossier indexer; Teamwork Graph enrichment (beta)
- **LLM enrichment** — additive readiness observations and plan justifications via an OpenAI-compatible adapter; always behind a 10s timeout; never overrides `blocked`
- **Knowledge Base** — KT documents (PDF/Markdown/text/HTML) and crawled URLs ingested into a per-project LanceDB vector store; RAG retrieval at analysis time
- **Human-gated output** — `emitCommentDraft()` only produces a draft; a `confirm_post_url` must be explicitly POSTed by a human
- **Forge / Rovo integration** — four HTTP endpoint handlers with 4.5 MB payload guard; three Rovo agent actions; CSRF one-time tokens
- **Subagent safety** — project-scoped operational subagent; isolated research subagent (30/day, 15-min timeout)
- **Eval and memory** — 56-entry gold-set; shadow-mode replay pipeline; reflection candidate queue; human-approval-gated memory promotion; rollout gate

---

## Project Structure

```
src/
  adapters/         # Rovo MCP + Jira Agile REST adapters + ingestion orchestrator
  normaliser/       # Ticket normaliser (AC alias resolution)
  readiness/        # Readiness profiles, scoring engine, clarification generator
  evidence/         # Evidence bundle store (UUID run_id, >=90-day retention)
  output/           # Human-gated Jira comment draft emitter
  repo/             # Repo adapter, component indexer, Teamwork Graph, mapper, stage-2 orchestrator
  planning/         # Solution planner, reviewer, OpenSpec emitter
  forge/            # Forge endpoints, Rovo agent actions, A2A connector, subagent, instrumentation
  eval/             # Gold-set, eval runner, reflection agent, shadow replay, observability
  utils/            # Logger, retry, latency tracker, confidence histogram
  types/            # Shared TypeScript types
  tests/
    contract/       # Adapter + Forge endpoint contract tests
    integration/    # End-to-end pipeline tests
    unit/           # Scorer, normaliser, mapper, reflection, permission-boundary tests
```

---

## Knowledge Base

The Knowledge Base (KB) lets you seed project-specific KT documents so the LLM enrichment pass has grounded context when analysing tickets.

### How it works

1. Documents are uploaded or crawled → parsed → chunked (512 tokens, 64-token overlap) → embedded → stored in a per-project LanceDB vector store under `KB_STORE_PATH` (default `.kb/`).
2. At analysis time, `retrieveChunks()` runs a vector search against the project's KB and the top-K chunks are assembled into a `<context>` block (12 000-token budget) passed to `enrichReadinessPrompt` and `groundPlanPrompt`.
3. All retrieval is project-scoped — chunks from one project are never served to another.

### Seeding KT documents

**Upload a file** (PDF, Markdown, plain text, or HTML):

```sh
curl -X POST http://localhost:3000/kb/ingest \
  -F "file=@docs/architecture.md" \
  -F "project_key=DEMO"
```

**Crawl a URL** (depth 1–3, same-origin links only):

```sh
curl -X POST http://localhost:3000/kb/crawl \
  -H "Content-Type: application/json" \
  -d '{"url": "https://wiki.example.com/kt/auth-service", "project_key": "DEMO", "depth": 2}'
```

### KB API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/kb/ingest` | Upload a file; returns `IngestResult` |
| `POST` | `/kb/crawl` | Crawl a URL; returns `IngestResult` |
| `GET` | `/kb/sources?project_key=X` | List all sources for a project |
| `DELETE` | `/kb/sources/:id` | Delete a source and its chunks |

**Error codes:**

| Code | Meaning |
|---|---|
| 413 | File exceeds 50 MB upload limit |
| 422 | Unsupported file format |
| 507 | KB store is full (`KB_MAX_SIZE_GB` exceeded) |
| 403 | Write rejected in shadow mode |

> All write endpoints (`ingest`, `crawl`, `delete`) return **HTTP 403** when `SHADOW_MODE=true`.

---

## Readiness Verdicts

| Verdict | Condition |
|---|---|
| `ready` | Score >= 80 AND no open blockers AND no missing `high`-severity items |
| `needs_clarification` | Score < 80 OR any `high`-severity missing item (no blockers) |
| `blocked` | Any dependency has status `Open` / `To Do` |

Scores are 0–100 from the weighted sum of dimension checks. Clarification questions are grouped by persona: **PM**, **engineer**, **QA**.

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install

```bash
npm install
```

### Run tests

```bash
npm test                  # run all 299 tests once
npm run test:watch        # watch mode
npm run test:coverage     # coverage report
```

### Rollout gate check

```bash
npm run rollout:check
```

Verifies classification agreement >= 85%, precision@3 >= 80%, permission-boundary tests passing, and >= 1 shadow replay reviewed.

---

## Core Invariants

1. **No autonomous Jira writes** — every write requires an explicit human `confirm_post_url` POST.
2. **No credential logging** — tokens and API keys never appear in logs or evidence bundles.
3. **Scoring is deterministic** — no LLM calls inside `scoreTicket()`.
4. **Evidence is always persisted** — even on `blocked` / `needs_clarification`; never silently dropped.
5. **Partial output is prohibited** — on ingestion failure, no bundle is written and no draft is emitted.
6. **Subagent knowledge is project-scoped** — `assertScopeExcludes` enforces project boundaries.
7. **Research subagent is isolated** — different `session_id` than operational subagent; `assertSubagentIsolation` verifies.
8. **A2A is feature-flagged off by default** — `FEATURE_ROVO_AGENT_CONNECTOR=false`; requires EAP approval to enable.
9. **Live memory is frozen until approval** — policy and repo memory deltas never apply until a human approves via `approveCandidate()`.
10. **Rollout is gated** — `checkRolloutGate()` must return `gate_pass: true` before any delta reaches production.
11. **LLM cannot override `blocked`** — the LLM enrichment pass is additive only; it never changes a `blocked` verdict, never reduces the score, and never removes existing missing items.
12. **LLM enrichment is additive only** — the enrichment pass may append new `MissingItem` entries (`source: "llm"`) and add `justification` strings, but the deterministic score is always the floor.
13. **KB is project-scoped** — every vector-store query is filtered by `project_key`; cross-project data leakage is structurally impossible.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `FEATURE_ROVO_AGENT_CONNECTOR` | `"false"` | Enable EAP A2A connector (requires EAP approval) |
| `JIRA_BASE_URL` | — | Base URL for Jira Agile REST calls |
| `JIRA_ACCESS_TOKEN` | — | Jira API token |
| `ROVO_MCP_CLOUD_ID` | — | Atlassian cloud ID for Rovo MCP |
| `ROVO_MCP_ACCESS_TOKEN` | — | Rovo MCP access token |
| `GITHUB_ACCESS_TOKEN` | — | GitHub API token for repo adapter |
| `BITBUCKET_ACCESS_TOKEN` | — | Bitbucket API token for repo adapter |

---

## Test Coverage

**299 tests passing** across 23 test files (as of stage-6):

| Suite | Type | Description |
|---|---|---|
| `adapters.test.ts` | Contract | adapter ingestion paths |
| `repo-adapter.test.ts` | Contract | GitHub + Bitbucket + Teamwork Graph + file content fetch |
| `forge-endpoints.test.ts` | Contract | Forge HTTP handlers + CSRF |
| `kb-endpoints.test.ts` | Contract | KB HTTP endpoints + shadow mode |
| `pipeline.test.ts` | Integration | full stage-1 pipeline |
| `stage2-pipeline.test.ts` | Integration | stage-2 repo-mapping pipeline |
| `forge-agent.test.ts` | Integration | Rovo agent actions + A2A |
| `shadow-replay.test.ts` | Integration | shadow-mode replay + audit log |
| `deep-research.test.ts` | Integration | deep-research subagent |
| `llm-enrichment.test.ts` | Integration | LLM enrichment pipeline + degraded mode |
| `normaliser.test.ts` | Unit | AC alias normalisation |
| `scorer.test.ts` | Unit | readiness scoring engine |
| `clarification.test.ts` | Unit | question generation |
| `hardening.test.ts` | Unit | edge cases |
| `indexer.test.ts` | Unit | component indexer |
| `mapper.test.ts` | Unit | repo-component mapper |
| `reviewer.test.ts` | Unit | solution reviewer |
| `stage2-hardening.test.ts` | Unit | stage-2 edge cases |
| `reflection.test.ts` | Unit | reflection candidate queue + approval |
| `permission-boundary.test.ts` | Unit | subagent permission boundaries |
| `llm-adapter.test.ts` | Unit | LLM adapter, mock, rate limiter, prompts |
| `knowledge-base.test.ts` | Unit | KB chunker, parser, store guards |
| `rag-retrieval.test.ts` | Unit | RAG retrieval timeout, context budget, file size guard |

---

## Running the Server

Copy `.env.example` to `.env` and fill in your credentials:

```sh
cp .env.example .env
```

Required variables:

| Variable | Description |
|---|---|
| `JIRA_BASE_URL` | Base URL of your Jira instance |
| `JIRA_API_TOKEN` | Jira API token |
| `JIRA_USER_EMAIL` | Jira user email |
| `GITHUB_TOKEN` | GitHub access token |

Optional degraded-mode flags (default `false`):

| Variable | Description |
|---|---|
| `SHADOW_MODE` | Return 403 on all write endpoints |
| `DEGRADED_REPO` | Skip repo-adapter calls |
| `DEGRADED_DEEP_RESEARCH` | Skip deep-research subagent calls |
| `DEGRADED_A2A` | Skip A2A connector calls |
| `DEGRADED_LLM` | Use mock LLM adapter (no real API calls) |
| `PORT` | HTTP port (default `3000`) |

LLM / Knowledge Base (all optional):

| Variable | Description |
|---|---|
| `LLM_API_KEY` | API key for the OpenAI-compatible LLM endpoint |
| `LLM_BASE_URL` | Base URL of the LLM API (default `https://api.openai.com/v1`) |
| `LLM_MODEL` | Completion model (default `gpt-4o-mini`) |
| `EMBEDDING_MODEL` | Embedding model (default `text-embedding-3-small`) |
| `KB_STORE_PATH` | LanceDB data directory (default `.kb/`) |
| `KB_MAX_SIZE_GB` | Maximum KB store size in GB (default `2`) |
| `LLM_CALLS_PER_MINUTE` | Rate-limit budget for LLM API calls (default `60`) |

Start the server:

```sh
npm start
```

The server exposes four Forge routes under `/forge/*` plus a `/health` endpoint.

---

## OpenSpec

Spec-driven changes are tracked in `openspec/changes/`. Completed stages are archived under `openspec/changes/archive/`. Main specs live in `openspec/specs/`:

- `evaluation-governance/` — eval dataset, shadow replay, rollout gate
- `orchestration/` — ingestion, pipeline, stage orchestration
- `output-contracts/` — comment draft, human-gate protocol
- `readiness-memory/` — scoring, profiles, reflection, memory promotion
- `repo-understanding/` — repo adapter, component index, mapper

### Completed & archived changes

| Archived slug | Stage | Summary |
|---|---|---|
| `2026-05-01-foundation-jira-ingestion-readiness` | 1 | Ingest, normalise, score, clarify, comment drafts |
| `2026-05-01-grounded-planning-repo-mapping` | 2 | Repo adapter, component index, solution planner, OpenSpec emitter |
| `2026-05-01-jira-native-teammate-shell` | 3 | Forge endpoints, Rovo agent actions, A2A connector, subagent scoping |
| `2026-05-01-operational-hardening-eval-memory` | 4 | Eval gold-set, shadow replay, reflection agent, observability, rollout gate |
| `2026-05-01-runtime-server-and-ci` | 5 | Hono server, CI workflow, env config, shadow-mode guard |
| `2026-05-01-llm-knowledge-base` | 6 | LLM enrichment (OpenAI-compat adapter), LanceDB KB, RAG retrieval, GitHub file fetch; 299 tests |

---

## Desktop UI

The `ui/` directory contains a native desktop application built with **Tauri 2 + React 18 + TypeScript** that provides a full GUI layer over the orchestration backend.

### Features

- **Connection Setup** — Save and test Jira, OpenAI, and GitHub credentials via Tauri Stronghold (falls back to an AES-encrypted file at `CREDENTIAL_STORE_PATH`).
- **Decision Review** — Approve, reject, or patch agent decisions from a live ring-buffered queue with JSON diff view and a pending-decisions badge on the sidebar.
- **Workflow Execution** — Run or dry-run the `crawl → normalise → embed → LanceDB` pipeline. Select any combination of stages, estimate token/cost before running (plan mode), view run history, and manage cron schedules.
- **Live Agent Reporting** — Real-time SSE feed of agent and sub-agent events per run. Color-coded status rows with per-agent stop controls.
- **Custom Agent Builder** — 4-step wizard (Identity → Persona → Skills → Config) that generates and writes `AGENTS.md`, `SOUL.md`, and `SKILLS.md` to `data/agents/<name>/` with a live file-preview panel.
- **Orchestrator Monitoring** — OrchestratorTeam watchdog emits findings for thrash, stall, and runaway patterns. The findings panel lets you acknowledge or escalate each one.
- **Stop All** — TitleBar "Stop All" button is visible whenever any agent run is active; it stops every run with a single click.

### Quick Start

```bash
cd ui
npm install
npm run tauri dev   # dev build with hot reload
npm test            # vitest unit tests
```

See [`ui/README.md`](ui/README.md) for the full panel, store, and hook reference.

### Environment Variables — Desktop UI

| Variable | Default | Description |
|---|---|---|
| `UI_DEV_ENDPOINTS` | `true` | Expose `GET /api/status`, `GET /api/config`, and `GET /api/metrics` (SSE). Set to `false` to disable in server-only deployments. |

---

## License

See [LICENSE](LICENSE).
