## MODIFIED Requirements

### Requirement: Correction-log and promotion-status in evidence bundle
The evidence bundle schema SHALL be extended to include: `correction_log` (array of `{ run_id, original_verdict, corrected_verdict, corrected_by, corrected_at }`) and `promotion_status` (`pending | approved | rejected | n/a`).

#### Scenario: Correction logged
- **WHEN** a human submits a verdict correction
- **THEN** a correction entry is appended to `correction_log` with the original and corrected verdicts

## ADDED Requirements

### Requirement: Evidence bundle extended with LLM traces and retrieved chunks
The `EvidenceBundle` schema SHALL be extended with two new optional fields: `llm_traces` (array of `LLMTrace`) and `retrieved_chunks` (array of `RetrievedChunk`). Both fields SHALL default to empty arrays and SHALL be populated during every analysis run where LLM and RAG are active. Their presence SHALL be recorded even in degraded mode (as empty arrays).

#### Scenario: LLM traces recorded
- **WHEN** an analysis run completes with LLM enrichment active
- **THEN** `evidence_bundle.llm_traces` contains at least one entry with `{model, prompt_tokens, completion_tokens, latency_ms, degraded: false}`

#### Scenario: Retrieved chunks recorded
- **WHEN** an analysis run completes with KB documents indexed for the project
- **THEN** `evidence_bundle.retrieved_chunks` contains up to 5 entries each with `{source_id, text, score, source_type}`

#### Scenario: Degraded mode — empty arrays recorded
- **WHEN** `DEGRADED_LLM=true` and no RAG retrieval occurs
- **THEN** `evidence_bundle.llm_traces` and `evidence_bundle.retrieved_chunks` are both present as empty arrays
