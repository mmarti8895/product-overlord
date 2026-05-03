## MODIFIED Requirements

### Requirement: Reflection agent in the post-analysis flow
The orchestrator SHALL invoke the Reflection Agent after every analysis run that produces a human correction, a completed ticket, or a declined plan. The Reflection Agent SHALL run asynchronously and SHALL NOT block the primary response path.

#### Scenario: Correction triggers reflection
- **WHEN** a user submits a correction to a readiness verdict
- **THEN** the Reflection Agent is enqueued asynchronously with the corrected verdict

## ADDED Requirements

### Requirement: RAG retrieval step in analysis pipeline
The analysis pipeline SHALL execute a RAG retrieval step immediately after ticket normalisation and before the deterministic scorer. The retrieved chunks SHALL be passed to both the deterministic scorer (for context logging) and the LLM enrichment pass. The retrieval step SHALL complete within 2 seconds; if it exceeds this, it SHALL time out and return an empty chunk list without blocking the rest of the pipeline.

#### Scenario: Retrieval step runs before scoring
- **WHEN** the analysis pipeline processes a ticket
- **THEN** `retrievedChunks` is populated before `scoreTicket()` is called

#### Scenario: Retrieval timeout does not block analysis
- **WHEN** the LanceDB ANN search takes longer than 2 seconds
- **THEN** `retrievedChunks` is set to `[]` and `scoreTicket()` proceeds normally

### Requirement: LLM enrichment step in analysis pipeline
After the deterministic scorer, the pipeline SHALL invoke the LLM enrichment pass with the deterministic result and retrieved chunks. The LLM enrichment step SHALL complete within 10 seconds; if it exceeds this, the pipeline SHALL fall back to the deterministic result. The enrichment step runs in parallel with repo mapping.

#### Scenario: LLM enrichment completes in time
- **WHEN** the LLM enrichment pass returns within 10 seconds
- **THEN** the enriched result is used for the output package

#### Scenario: LLM enrichment times out
- **WHEN** the LLM enrichment pass exceeds 10 seconds
- **THEN** the deterministic result is used and `llm_traces` records a `{degraded: true, reason: "timeout"}` entry
