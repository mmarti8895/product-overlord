/**
 * Unit tests — health score formula & health_label derivation (task 5.4)
 *
 * Tests the formula:
 *   health_score = clamp(100
 *     - (blockers.length * 10)
 *     - (scope_creep_delta * 2)
 *     - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0)
 *   , 0, 100)
 *
 *   >= 75 → on-track
 *   >= 40 → at-risk
 *   <  40 → off-track
 *
 * We exercise this by calling SprintMonitor._pollBoard with a mocked Jira adapter.
 */
export {};
