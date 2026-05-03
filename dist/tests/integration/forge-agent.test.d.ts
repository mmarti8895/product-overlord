/**
 * Integration test — Forge agent end-to-end (Task 3.5)
 *
 * Simulates the full user journey inside the Jira Forge UI:
 *   trigger → analysis → summary card → confirm post → Jira comment written
 *
 * Also covers:
 *   3.6  No autonomous Jira writes without user confirmation
 *   4.4  A2A: ticket assignment → analysis triggered → draft presented
 *   4.5  A2A unavailability: fallback to manual Forge action, no data loss
 *   5.2  Knowledge-boundary assertion (scoped subagent excludes other projects)
 *   5.4  Research subagent isolation (different session_id)
 */
export {};
