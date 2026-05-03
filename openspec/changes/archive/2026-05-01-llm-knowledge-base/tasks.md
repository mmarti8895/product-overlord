# Tasks: llm-knowledge-base

## 1. Dependencies and Config

- [x] 1.1 Install runtime deps: `npm install openai lancedb pdf-parse cheerio`
- [x] 1.2 Install dev/type deps: `npm install --save-dev @types/pdf-parse @types/cheerio`
- [x] 1.3 Add `DEGRADED_LLM=true` to `vitest.config.ts` env so existing 236 tests pass unchanged
- [x] 1.4 Add `.kb/` to `.gitignore`
- [x] 1.5 Extend `src/server/config.ts` with new env vars: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `KB_STORE_PATH`, `KB_MAX_SIZE_GB`, `LLM_CALLS_PER_MINUTE`, `DEGRADED_LLM`
- [x] 1.6 Update `.env.example` with all new variables (required/optional labels, example values)

## 2. LLM Adapter (`src/llm/`)

- [x] 2.1 Create `src/llm/types.ts` — `LLMAdapter` interface, `LLMTrace`, `LLMDegradedError`, `PromptContext`
- [x] 2.2 Create `src/llm/openai-compat.ts` — `OpenAICompatAdapter` implementing `LLMAdapter` (structured JSON output, call tracing)
- [x] 2.3 Create `src/llm/mock-adapter.ts` — deterministic mock for tests (returns configurable fixture responses)
- [x] 2.4 Create `src/llm/rate-limiter.ts` — per-process call budget with exponential back-off queue
- [x] 2.5 Create `src/llm/prompts.ts` — prompt registry: `enrichReadinessPrompt`, `groundPlanPrompt` as typed template functions
- [x] 2.6 Create `src/llm/index.ts` — `createLLMAdapter(config): LLMAdapter` factory (returns mock when `DEGRADED_LLM=true`)
- [x] 2.7 Unit tests `src/tests/unit/llm-adapter.test.ts`: structured call, degraded fallback, rate-limit queue, prompt rendering

## 3. Knowledge Base (`src/knowledge/`)

- [x] 3.1 Create `src/knowledge/types.ts` — `KBChunk`, `KBSource`, `RetrievedChunk`, `IngestResult`
- [x] 3.2 Create `src/knowledge/chunker.ts` — 512-token / 64-token-overlap chunker; runs in `node:worker_threads`
- [x] 3.3 Create `src/knowledge/parser.ts` — PDF (`pdf-parse`), Markdown, plain-text parser; returns raw text + metadata
- [x] 3.4 Create `src/knowledge/crawler.ts` — URL HTML fetcher/extractor using `cheerio`; `depth` param (1–3); 30 s timeout
- [x] 3.5 Create `src/knowledge/embedder.ts` — wraps `LLMAdapter.embed()` to batch-embed chunks
- [x] 3.6 Create `src/knowledge/store.ts` — `KBStore` class wrapping LanceDB: `ingest()`, `search()`, `listSources()`, `deleteSource()`, `sizeBytes()` — partitioned by `project_key`
- [x] 3.7 Create `src/knowledge/index.ts` — `KnowledgeBase` facade orchestrating parser → chunker → embedder → store; enforces 50 MB upload limit and `KB_MAX_SIZE_GB` guard
- [x] 3.8 Unit tests `src/tests/unit/knowledge-base.test.ts`: chunking, parsing (mock PDF), crawl (mock fetch), store size guard, unsupported file type rejection

## 4. RAG Retrieval (`src/rag/`)

- [x] 4.1 Create `src/rag/retrieval.ts` — `retrieveChunks(query, projectKey, topK=5): Promise<RetrievedChunk[]>` with 2 s timeout guard
- [x] 4.2 Create `src/rag/file-fetcher.ts` — `fetchTopFiles(candidates, repoAdapter, topN=3): Promise<FetchedFile[]>` with 100 KB + 8 K token limits
- [x] 4.3 Create `src/rag/context-builder.ts` — assembles KT chunks + file contents into a `<context>` block respecting 12 K token budget (file content truncated first)
- [x] 4.4 Unit tests `src/tests/unit/rag-retrieval.test.ts`: chunk retrieval, 2 s timeout fallback, context budget truncation, file size guard

## 5. Pipeline Integration

- [x] 5.1 Extend `EvidenceBundle` in `src/evidence/store.ts` with `llm_traces: LLMTrace[]` and `retrieved_chunks: RetrievedChunk[]` (default `[]`)
- [x] 5.2 Update `src/types/index.ts` — add `source?: "llm"` to `MissingItem`; add `justification?: string` to `ClarificationQuestion`
- [x] 5.3 Wire RAG retrieval step into the stage-1 pipeline (after normalise, before `scoreTicket`) in the Forge endpoint handler
- [x] 5.4 Wire LLM enrichment pass after `scoreTicket` in the stage-1 pipeline; enforce 10 s timeout; fall back to deterministic result
- [x] 5.5 Wire LLM `groundPlan` into `src/planning/solution-planner.ts` to populate `why` / `reason` fields; fallback to heuristic strings when degraded
- [x] 5.6 Wire `fetchTopFiles` into `src/repo/stage2-orchestrator.ts` after component mapper; pass fetched content to `groundPlan`
- [x] 5.7 Integration tests `src/tests/integration/llm-enrichment.test.ts`: mock LLM, assert enriched fields present; degraded mode returns deterministic result unchanged

## 6. KB HTTP Endpoints

- [x] 6.1 Add `POST /kb/ingest` to `src/server/app.ts` — multipart file upload, calls `KnowledgeBase.ingestFile()`; returns `IngestResult`
- [x] 6.2 Add `POST /kb/crawl` to `src/server/app.ts` — JSON body `{url, project_key, depth?}`, calls `KnowledgeBase.crawlUrl()`
- [x] 6.3 Add `GET /kb/sources` to `src/server/app.ts` — query param `project_key`, returns `KBSource[]`
- [x] 6.4 Add `DELETE /kb/sources/:id` to `src/server/app.ts` — calls `KBStore.deleteSource()`; returns 204
- [x] 6.5 Apply shadow-mode 403 guard to all `/kb/*` write endpoints (ingest, crawl, delete)
- [x] 6.6 Contract tests `src/tests/contract/kb-endpoints.test.ts`: happy path, 413 too large, 422 bad type, 507 store full, 403 shadow mode

## 7. Repo Adapter Extension

- [x] 7.1 Add `getFileContent(owner, repo, path, ref?): Promise<{content: string; trace: AdapterTrace}>` to `src/repo/repo-adapter.ts`
- [x] 7.2 Enforce 100 KB size limit in `getFileContent` — throw `FileTooLargeError` if exceeded
- [x] 7.3 Add `getFileContent` tests to `src/tests/contract/repo-adapter.test.ts`: happy path, 100 KB guard, retry on 5xx

## 8. Instrumentation and Observability

- [x] 8.1 Extend `src/forge/instrumentation.ts` to log `llm_call` structured events (model, latency, tokens, degraded flag)
- [x] 8.2 Extend `src/forge/instrumentation.ts` to log `rag_retrieval` events (chunk_count, latency, timeout flag)
- [x] 8.3 Add `llmCallsTotal`, `llmDegradedTotal`, `ragRetrievalLatencyP95` metrics to `src/eval/observability.ts`
- [x] 8.4 Add LLM degraded-rate alert: if `llmDegradedTotal / llmCallsTotal > 0.1` in last 100 runs, emit `degraded_rate_high` warning

## 9. Eval and Gold-Set

- [x] 9.1 Add 8 gold-set entries to `src/eval/gold-set.ts` exercising LLM enrichment paths (4 with KT context, 4 without)
- [x] 9.2 Extend `src/eval/eval-runner.ts` to assert that `llm_traces` and `retrieved_chunks` are present on every evidence bundle
- [x] 9.3 Add `llm_enrichment_agreement` metric to eval runner: % of runs where LLM enrichment verdict matches human label
- [x] 9.4 Update gold-set distribution validation to include LLM-enriched entries in coverage check

## 10. AGENTS.md and README

- [x] 10.1 Add stage-6 section to `AGENTS.md`: LLM adapter contract, RAG retrieval invariants, KB ingestion invariants, new env vars
- [x] 10.2 Update `README.md`: add "Knowledge Base" section documenting KB API endpoints and how to seed KT documents
- [x] 10.3 Add new invariants to `README.md` Core Invariants: LLM cannot override `blocked` verdict; enrichment is additive only; KB is project-scoped
- [x] 10.4 Mark this tasks.md complete and run `/opsx:archive`
