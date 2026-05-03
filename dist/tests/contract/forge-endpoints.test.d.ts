/**
 * Contract tests — Forge endpoints (Task 2.6)
 *
 * Covers:
 *   2.6a  POST /forge/ingest/issue — happy path
 *   2.6b  GET  /forge/ingest/board/{id} — happy path + "load more" cursor
 *   2.6c  GET  /forge/plan/{run_id} — happy path + not found
 *   2.6d  POST /forge/output/confirm/{run_id} — happy path + CSRF rejection
 *   2.6e  Oversized response truncation (size guard)
 *   2.6f  Timeout — orchestrator exceeds ENDPOINT_TIMEOUT_MS
 *   2.6g  Unauthenticated request — all four endpoints return 401
 */
export {};
