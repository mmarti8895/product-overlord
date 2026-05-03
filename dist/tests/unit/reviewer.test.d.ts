/**
 * Unit tests — Reviewer agent (task 3.7)
 *
 * Covers:
 *   - permission violation: component not in allowedComponents → blocked
 *   - insufficient evidence: score below threshold without conflict → blocked
 *   - conflict surfaced: conflict present → still approved if other rules pass
 *   - branch key missing → blocked
 *   - invalid slug → blocked
 *   - clean approval path
 */
export {};
