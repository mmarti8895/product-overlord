/**
 * Integration test — full stage-2 pipeline (task 3.6)
 *
 * ticket → parallel branches → planner → reviewer → emitter → evidence store
 *
 * Scenarios:
 *   1. Clean run: readiness=ready, repo confidence ≥ 0.8, reviewer approves
 *   2. Repo-mapping branch fails: readiness continues, repo_map=null
 *   3. Conflict surfaced: readiness=ready, repo confidence < 0.3
 */
export {};
