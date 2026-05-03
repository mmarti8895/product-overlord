## Why

The system currently scores readiness and maps repo components using deterministic keyword heuristics — no LLM is involved anywhere. This means it cannot understand nuanced acceptance criteria, interpret code semantics, reason about company-specific terminology from KT documents, or answer "why is this component relevant?" with real justification. To become a **fully autonomous PM agent** it needs: (1) semantic understanding of tickets and code via an LLM, (2) a knowledge base of company KT documents (uploaded files or crawled URLs) and GitHub file contents, and (3) a durable vector store to retrieve relevant context at analysis time.

## What Changes

- **New**: LLM adapter (`src/llm/`) — pluggable provider interface (OpenAI-compatible), rate-limit guard, structured output (JSON mode), prompt templates for scoring enrichment and clarification generation
- **New**: Knowledge base ingestion pipeline (`src/knowledge/`) — accepts file uploads (PDF, Markdown, plain text) and website URLs; chunks, embeds, and indexes into a local vector store (LanceDB)
- **New**: GitHub content reader — extends repo adapter to fetch and chunk actual file contents for semantically relevant files (filtered by component mapper output)
- **New**: RAG retrieval layer — at analysis time, queries vector store with ticket summary + AC for top-K chunks; injects as context into LLM prompts
- **Modified**: Readiness scorer — LLM enrichment pass runs after deterministic scoring; LLM can upgrade confidence, add missing items, and generate persona-specific clarification questions with real justification
- **Modified**: Solution planner — LLM generates `why` field for each candidate component/file using retrieved code context; no longer TBD placeholders
- **Modified**: Evidence store — persists retrieved chunks and LLM call traces alongside existing adapter traces; `degraded` flag when LLM unavailable (deterministic fallback preserved)
- **Modified**: Server config — adds `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `KB_STORE_PATH` env vars with degraded-mode flag if LLM absent
- **New**: HTTP endpoints for KB management — `POST /kb/ingest` (file upload), `POST /kb/crawl` (URL), `GET /kb/sources`, `DELETE /kb/sources/:id`

**Non-goals:**
- No autonomous Jira writes (human gate remains unchanged)
- No LLM in the hot scoring path — deterministic score is always computed first; LLM is an enrichment pass
- No cloud vector DB required — LanceDB runs embedded, zero infra
- No fine-tuning or model training

**Assumptions:**
- LLM provider is OpenAI-compatible (OpenAI, Azure OpenAI, Ollama, etc.)
- Rollback: if `LLM_API_KEY` is absent or LLM call fails, system falls back to deterministic-only mode (existing behaviour)

## Capabilities

### New Capabilities

- `llm-adapter`: Pluggable LLM provider interface, structured output, prompt registry, rate-limit guard, call tracing
- `knowledge-base`: KT document ingestion (file upload + URL crawl), chunking, embedding, vector store (LanceDB), source management API
- `rag-retrieval`: At-analysis-time retrieval of relevant KT and code chunks; context injection into LLM prompts

### Modified Capabilities

- `readiness-memory`: Readiness scorer gains LLM enrichment pass; clarification questions gain justification field populated by LLM
- `repo-understanding`: Repo adapter gains file-content fetching for mapper-selected files; solution planner `why` fields populated by LLM
- `orchestration`: Analysis pipeline gains RAG retrieval step between ingestion and scoring; evidence bundle extended with `llm_traces` and `retrieved_chunks`
- `output-contracts`: Evidence bundle schema extended; comment draft gains richer justification from LLM

## Impact

- New runtime dependencies: `lancedb` (embedded vector store), `@xenova/transformers` or `openai` SDK (embeddings + LLM calls), `pdf-parse` (PDF chunking), `cheerio` (URL crawling)
- New env vars: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `KB_STORE_PATH`
- Existing 236 tests unaffected — LLM is behind a degraded-mode flag; tests run with `DEGRADED_LLM=true`
- New test suites: `llm-adapter.test.ts` (unit), `knowledge-base.test.ts` (unit), `rag-retrieval.test.ts` (unit), `llm-enrichment.test.ts` (integration)
- No breaking changes to existing Forge endpoints or Rovo agent actions
