/**
 * SprintMonitor
 *
 * Background service that polls configured Jira boards on a fixed interval,
 * derives health metrics, caches SprintSnapshot per board, and emits
 * `sprint:snapshot-updated` on AgentEventBus.
 *
 * Health score formula (tasks 2.5, 2.6):
 *   health_score = clamp(100
 *     - (blockers.length * 10)
 *     - (scope_creep_delta * 2)
 *     - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0)
 *   , 0, 100)
 *
 *   health_label:
 *     >= 75 → "on-track"
 *     >= 40 → "at-risk"
 *     <  40 → "off-track"
 */
import { VelocityTracker } from "./velocity-tracker.js";
import { BlockerDetector } from "./blocker-detector.js";
import { ScopeCreepDetector } from "./scope-creep-detector.js";
import { AgentEventBus } from "../agents/AgentEventBus.js";
import { logger } from "../utils/logger.js";
export class SprintMonitor {
    jira;
    cfg;
    cache = new Map();
    timer = null;
    velocity;
    blockerDetector;
    scopeDetector;
    constructor(jira, cfg) {
        this.jira = jira;
        this.cfg = cfg;
        this.velocity = new VelocityTracker(jira, cfg.doneStatuses);
        this.blockerDetector = new BlockerDetector(cfg.doneStatuses);
        this.scopeDetector = new ScopeCreepDetector();
    }
    // ── Lifecycle ──────────────────────────────────────────────────────────
    start() {
        if (this.timer)
            return;
        void this._pollAll();
        this.timer = setInterval(() => void this._pollAll(), this.cfg.pollIntervalMs);
        logger.info("sprint_monitor_started", {
            board_ids: this.cfg.boardIds,
            interval_ms: this.cfg.pollIntervalMs,
        });
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    // ── Public accessors ───────────────────────────────────────────────────
    getSnapshot(boardId) {
        return this.cache.get(boardId);
    }
    getAllSnapshots() {
        return Array.from(this.cache.values());
    }
    // ── Poll cycle ─────────────────────────────────────────────────────────
    async _pollAll() {
        for (const boardId of this.cfg.boardIds) {
            await this._pollBoard(boardId);
        }
    }
    async _pollBoard(boardId) {
        try {
            const numericId = Number(boardId);
            // Get active sprint(s) for the board
            const { sprints } = await this.jira.listSprints(numericId, { state: "active", maxResults: 1 });
            if (sprints.length === 0) {
                logger.info("sprint_monitor_no_active_sprint", { board_id: boardId });
                return;
            }
            const sprint = sprints[0];
            // Fetch active sprint issues
            const { issues } = await this.jira.getSprintIssues(sprint.id, { maxResults: 200 });
            // ── Committed & completed points (task 2.5: story_points → original_estimate fallback)
            let committed = 0;
            let completed = 0;
            let pointsEstimatedFromTime = false;
            for (const issue of issues) {
                const fields = issue.fields;
                const { points, fromTime } = this._resolvePoints(fields);
                if (fromTime)
                    pointsEstimatedFromTime = true;
                committed += points;
                const status = String(fields.status?.name ?? "");
                if (this.cfg.doneStatuses.some(d => d.toLowerCase() === status.toLowerCase())) {
                    completed += points;
                }
            }
            // ── Velocity (last 6 closed sprints)
            const velocityTrend = await this.velocity.getVelocity(numericId);
            // ── Blockers
            const sprintWindow = {
                startDate: sprint.startDate ?? new Date().toISOString(),
                endDate: sprint.endDate ?? new Date(Date.now() + 14 * 86_400_000).toISOString(),
            };
            const blockers = this.blockerDetector.detect(issues.map(i => ({ key: i.key, fields: i.fields })), sprintWindow);
            // ── Scope creep
            const { additions: scopeAdditions, delta: scopeCreepDelta } = this.scopeDetector.detect(issues.map(i => ({ key: i.key, fields: i.fields })), sprintWindow.startDate);
            // ── Days remaining
            const now = Date.now();
            const endMs = new Date(sprintWindow.endDate).getTime();
            const daysRemaining = Math.max(0, Math.ceil((endMs - now) / 86_400_000));
            // ── Health score (task 2.6)
            const completedRatio = committed > 0 ? completed / committed : 1;
            const rawScore = 100
                - blockers.length * 10
                - scopeCreepDelta * 2
                - (completedRatio < 0.5 && daysRemaining < 3 ? 30 : 0);
            const healthScore = Math.max(0, Math.min(100, rawScore));
            const healthLabel = healthScore >= 75 ? "on-track" : healthScore >= 40 ? "at-risk" : "off-track";
            const snapshot = {
                board_id: boardId,
                sprint_id: String(sprint.id),
                sprint_name: sprint.name,
                fetched_at: new Date().toISOString(),
                start_date: sprintWindow.startDate,
                end_date: sprintWindow.endDate,
                days_remaining: daysRemaining,
                committed_points: committed,
                completed_points: completed,
                points_estimated_from_time: pointsEstimatedFromTime,
                velocity_trend: velocityTrend,
                blockers,
                scope_additions: scopeAdditions,
                scope_creep_delta: scopeCreepDelta,
                health_score: healthScore,
                health_label: healthLabel,
                stale: false,
                warnings: [],
            };
            this.cache.set(boardId, snapshot);
            // Emit on AgentEventBus — reuse "finding" event kind
            AgentEventBus.emit({
                event: "finding",
                agent: "sprint-monitor",
                run_id: `sprint:${boardId}`,
                ts: snapshot.fetched_at,
                severity: healthLabel === "off-track" ? "critical" : healthLabel === "at-risk" ? "warn" : "info",
                message: `sprint:snapshot-updated:${boardId}`,
                finding_id: `sprint-snapshot-${boardId}-${snapshot.sprint_id}`,
                // Attach snapshot as extra payload (consumers can cast)
                ...{ snapshot },
            });
            logger.info("sprint_monitor_snapshot_updated", {
                board_id: boardId,
                sprint_id: sprint.id,
                health_score: healthScore,
                health_label: healthLabel,
            });
        }
        catch (err) {
            logger.error("sprint_monitor_poll_error", { board_id: boardId, error: String(err) });
            // Mark cached snapshot as stale (task 2.4 degraded mode)
            const prev = this.cache.get(boardId);
            if (prev) {
                this.cache.set(boardId, {
                    ...prev,
                    stale: true,
                    stale_since: new Date().toISOString(),
                    warnings: [...(prev.warnings ?? []), `Poll failed: ${String(err)}`],
                });
            }
        }
    }
    // ── Helpers ────────────────────────────────────────────────────────────
    _resolvePoints(fields) {
        for (const key of ["story_points", "customfield_10016", "storyPoints"]) {
            const v = fields[key];
            if (typeof v === "number" && !isNaN(v))
                return { points: v, fromTime: false };
        }
        const est = fields["original_estimate"] ?? fields["timeoriginalestimate"];
        if (typeof est === "number" && est > 0) {
            return { points: Math.round(est / 3600 / 8), fromTime: true };
        }
        return { points: 0, fromTime: false };
    }
}
