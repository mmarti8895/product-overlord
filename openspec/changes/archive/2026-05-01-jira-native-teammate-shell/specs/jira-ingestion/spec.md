## MODIFIED Requirements

### Requirement: Forge-compatible ingestion entry points
Ingestion entry points (board sweep, direct issue key, JQL) SHALL be exposed as deterministic HTTP endpoints callable from Forge actions. Each endpoint response SHALL be ≤ 4.5 MB to stay safely within the 5 MB Forge action payload limit. When the natural response exceeds this limit, the endpoint SHALL return a paginated summary and a cursor for continuation.

#### Scenario: Board sweep endpoint called from Forge
- **WHEN** a Forge action calls the `/ingest/board/{boardId}` endpoint
- **THEN** the endpoint SHALL return a paginated list of canonical ticket summaries within the payload limit

#### Scenario: Oversized response truncated
- **WHEN** a full canonical ticket bundle for a board exceeds 4.5 MB
- **THEN** the endpoint SHALL return the first page and a `next_cursor` field; the Forge action SHALL display the first page and offer a "load more" control
