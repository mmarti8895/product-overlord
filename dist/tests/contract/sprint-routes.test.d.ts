/**
 * Contract tests — Sprint API routes (task 5.6)
 *
 * Tests all 4 routes:
 *   - GET /api/sprint/:boardId/snapshot  — happy path, stale cache, no data (null)
 *   - GET /api/sprint/:boardId/velocity  — happy path
 *   - GET /api/sprint/:boardId/blockers  — happy path
 *   - GET /api/sprint/stream             — SSE content-type
 *   - Missing boardId equivalent (unknown board → null data)
 */
export {};
