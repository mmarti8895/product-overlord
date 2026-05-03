## ADDED Requirements

### Requirement: KT document ingestion via file upload
The system SHALL accept file uploads at `POST /kb/ingest` supporting PDF, Markdown, and plain-text formats up to 50 MB per file. It SHALL parse, chunk (512-token windows, 64-token overlap), embed, and store chunks in LanceDB partitioned by `project_key`. Each source SHALL be assigned a UUID `source_id` and recorded in a sources manifest.

#### Scenario: Successful PDF ingest
- **WHEN** a user POSTs a valid PDF to `/kb/ingest` with a `project_key` field
- **THEN** the system parses the PDF, produces at least one chunk, embeds all chunks, and returns `{source_id, chunk_count, status: "indexed"}`

#### Scenario: Unsupported file type rejected
- **WHEN** a user POSTs a file with an unsupported MIME type (e.g., `.xlsx`)
- **THEN** the system returns HTTP 422 with `{error: "unsupported_file_type"}`

#### Scenario: File too large rejected
- **WHEN** a user POSTs a file exceeding 50 MB
- **THEN** the system returns HTTP 413 with `{error: "file_too_large"}`

### Requirement: KT document ingestion via URL crawl
The system SHALL accept a URL at `POST /kb/crawl` and crawl the HTML content of that URL (single page, no recursive follow by default). It SHALL extract visible text, chunk, embed, and store. A `depth` parameter (default: 1, max: 3) MAY be provided to follow internal links recursively.

#### Scenario: Successful single-page crawl
- **WHEN** a user POSTs `{url: "https://example.com/kt", project_key: "PROJ"}` to `/kb/crawl`
- **THEN** the system fetches the URL, extracts text, and returns `{source_id, chunk_count, status: "indexed"}`

#### Scenario: Unreachable URL
- **WHEN** the crawled URL returns a non-2xx response or times out after 30 seconds
- **THEN** the system returns HTTP 502 with `{error: "crawl_failed", message: "<reason>"}`

### Requirement: KB source management API
The system SHALL provide `GET /kb/sources?project_key=<key>` to list all indexed sources for a project, and `DELETE /kb/sources/:id` to remove a source and all its chunks from the vector store.

#### Scenario: List sources for project
- **WHEN** `GET /kb/sources?project_key=PROJ` is called
- **THEN** the system returns an array of `{source_id, name, type, chunk_count, indexed_at}` for all sources belonging to `PROJ`

#### Scenario: Delete source
- **WHEN** `DELETE /kb/sources/:id` is called with a valid source ID
- **THEN** the system removes all chunks for that source from LanceDB and returns HTTP 204

### Requirement: KB store size guard
The system SHALL enforce a configurable maximum KB store size via `KB_MAX_SIZE_GB` (default: 5). Ingest and crawl requests that would exceed this limit SHALL be rejected with HTTP 507.

#### Scenario: Store full
- **WHEN** an ingest request would push the store over `KB_MAX_SIZE_GB`
- **THEN** the system returns HTTP 507 with `{error: "kb_store_full"}`

### Requirement: Chunking runs in a worker thread
File parsing and chunking SHALL run in a `node:worker_threads` worker to avoid blocking the event loop. The main thread SHALL await the worker result before embedding.

#### Scenario: Large file does not block health endpoint
- **WHEN** a 50 MB PDF is being ingested
- **THEN** `GET /health` continues to respond within 100 ms during the ingest
