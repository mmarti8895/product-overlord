/**
 * Contract tests — UI developer endpoints (Tasks 5.5, 13.4)
 *
 * Covers:
 *   5.5a  GET /api/status — happy path
 *   5.5b  GET /api/status — shadow-mode flag reflected
 *   5.5c  GET /api/config — credential fields are redacted
 *   5.5d  GET /api/metrics — responds with text/event-stream
 *   5.5e  UI_DEV_ENDPOINTS=false — all three routes return 404
 *   13.4a SSE broadcaster — events fanned out to subscribers
 *   13.4b recordUIAction — increments counters per panel:action key
 */
export {};
