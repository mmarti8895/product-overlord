## ADDED Requirements

### Requirement: RAG retrieval at analysis time
The system SHALL perform an ANN (approximate nearest-neighbour) vector search against the LanceDB KB store at the start of every analysis run. The query SHALL be the concatenation of the ticket summary and acceptance criteria. The system SHALL retrieve the top-5 chunks by cosine similarity, filtered by `project_key`. Retrieved chunks SHALL be attached to the evidence bundle as `retrieved_chunks`.

#### Scenario: Relevant chunks retrieved
- **WHEN** an analysis run begins for ticket `PROJ-42` with a non-empty KB for project `PROJ`
- **THEN** up to 5 chunks are returned, each with `{source_id, text, score, source_type}`
- **AND** all chunks have `score >= 0.0` (cosine similarity 0–1)

#### Scenario: Empty KB — no chunks retrieved
- **WHEN** no KB documents have been indexed for the ticket's project
- **THEN** `retrieved_chunks` is an empty array and analysis continues normally

#### Scenario: Retrieval failure — analysis continues
- **WHEN** LanceDB returns an error during ANN search
- **THEN** `retrieved_chunks` is an empty array, a warning is logged, and analysis continues with the deterministic scorer

### Requirement: GitHub file content retrieval
After component mapping, the system SHALL fetch the raw file content for the top-3 highest-confidence candidate files from the repo adapter (max 100 KB per file, truncated to 8 K tokens). Fetched contents SHALL be chunked and passed to the LLM grounding prompt. File content SHALL NOT be persisted to LanceDB.

#### Scenario: File content fetched for top candidates
- **WHEN** the component mapper returns candidate files with confidence scores
- **THEN** the top-3 files by confidence are fetched from GitHub
- **AND** each fetched content is truncated to 8 K tokens before being passed to the LLM

#### Scenario: File fetch failure — plan proceeds without content
- **WHEN** a file fetch returns a non-2xx response
- **THEN** that file is skipped, a warning is logged, and the LLM grounding prompt is called with whatever content was successfully fetched

### Requirement: Context injection into LLM prompts
Retrieved KT chunks and fetched file contents SHALL be injected into LLM prompts as a structured `<context>` block. The total injected context SHALL not exceed 12 K tokens. If retrieved chunks plus file content exceed 12 K tokens, KT chunks SHALL be preferred and file content truncated first.

#### Scenario: Context within token budget
- **WHEN** total retrieved chunks + file content is under 12 K tokens
- **THEN** all content is included in the LLM prompt

#### Scenario: Context exceeds token budget
- **WHEN** total retrieved chunks + file content exceeds 12 K tokens
- **THEN** file content is truncated first, then KT chunks are truncated by lowest similarity score, until total is under 12 K tokens
