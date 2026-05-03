/**
 * Forge Stage-3 Types
 *
 * Shared envelope types used by all Forge-callable endpoints and the
 * Rovo agent action layer.  All response sizes are guarded to ≤ 4.5 MB;
 * payloads that exceed that limit are replaced with a summary envelope
 * that carries a `deep_link` to the full package outside Forge.
 */
export const RESEARCH_SUBAGENT_RATE_LIMIT = 30;
export const RESEARCH_SUBAGENT_TIMEOUT_MS = 15 * 60 * 1000; // 15 min
