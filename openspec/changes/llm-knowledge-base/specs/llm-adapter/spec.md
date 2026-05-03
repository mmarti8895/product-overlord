## ADDED Requirements

### Requirement: Pluggable OpenAI-compatible LLM adapter
The system SHALL provide an `LLMAdapter` interface with a concrete `OpenAICompatAdapter` implementation. The adapter SHALL accept `LLM_BASE_URL`, `LLM_API_KEY`, and `LLM_MODEL` from server config. It SHALL support structured JSON output mode. All calls SHALL be traced and appended to the evidence bundle's `llm_traces` array.

#### Scenario: Successful structured call
- **WHEN** `LLMAdapter.complete(prompt, schema)` is called with a valid prompt and JSON schema
- **THEN** the adapter returns a parsed, schema-validated object and records a `LLMTrace` with `degraded: false`

#### Scenario: LLM unavailable — degraded fallback
- **WHEN** `LLM_API_KEY` is absent or the LLM endpoint returns a non-2xx response
- **THEN** the adapter throws a `LLMDegradedError` and records a `LLMTrace` with `degraded: true`
- **AND** the calling pipeline falls back to the deterministic-only result

### Requirement: Prompt registry
The system SHALL maintain a typed prompt registry in `src/llm/prompts.ts`. Each prompt SHALL be a pure TypeScript function `(context: PromptContext) => string`. Prompts SHALL NOT be loaded from external files at runtime.

#### Scenario: Prompt renders without external I/O
- **WHEN** any prompt function is called with a valid context object
- **THEN** it returns a non-empty string with no file reads or network calls

### Requirement: LLM rate-limit guard
The adapter SHALL enforce a per-process call budget configurable via `LLM_CALLS_PER_MINUTE` (default: 60). Calls exceeding the budget SHALL be queued with exponential back-off, not dropped.

#### Scenario: Rate limit reached
- **WHEN** more than `LLM_CALLS_PER_MINUTE` calls are made within a 60-second window
- **THEN** subsequent calls are queued and retried with exponential back-off
- **AND** no call is silently dropped
