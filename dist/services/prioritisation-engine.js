/**
 * PrioritisationEngine (roadmap-planning, task 2.2)
 *
 * Computes RICE and ICE scores for an Epic using LLM estimates and Jira data.
 * Gracefully returns null scores on LLM failure — never throws.
 */
import { logger } from "../utils/logger.js";
const IMPACT_LABEL_MAP = {
    critical: 3,
    high: 2,
    medium: 1,
    low: 0.5,
};
export class PrioritisationEngine {
    llm;
    constructor(llm) {
        this.llm = llm;
    }
    async score(epic, overrides) {
        let rice = null;
        let ice = null;
        try {
            rice = await this._computeRICE(epic, overrides);
            ice = this._computeICE(rice);
        }
        catch (err) {
            logger.warn("prioritisation_engine_llm_failure", { epic_key: epic.key, error: String(err) });
            // Return epic with null scores — not fatal
        }
        return { ...epic, rice_score: rice, ice_score: ice };
    }
    async _computeRICE(epic, overrides) {
        // --- Reach: LLM estimate ---
        let reach = overrides?.reach ?? 0;
        if (overrides?.reach === undefined) {
            try {
                const promptStr = `You are a product analyst. Estimate how many users this feature affects on a scale 0–1000.\n\nFeature: ${epic.summary}\n${epic.description ?? ""}\n\nRespond as JSON: {"reach": <number>}`;
                const schema = { type: "object", properties: { reach: { type: "number" } }, required: ["reach"] };
                const { result } = await this.llm.complete(promptStr, schema);
                reach = Math.max(0, Math.min(1000, result.reach ?? 0));
            }
            catch {
                reach = 100; // fallback
            }
        }
        // --- Impact: label mapping ---
        const impact = overrides?.impact ?? (() => {
            for (const [label, value] of Object.entries(IMPACT_LABEL_MAP)) {
                if (epic.summary.toLowerCase().includes(label))
                    return value;
            }
            return 0.25;
        })();
        // --- Confidence: health_score proxy ---
        const confidence = overrides?.confidence ?? epic.health_score;
        // --- Effort: sum of child estimates (assume 1 point = 1 hour, 40h = 1 person-week) ---
        const effort = overrides?.effort ?? Math.max(0.5, epic.child_keys.length * 0.5);
        const score = effort > 0 ? (reach * impact * (confidence / 100)) / effort : 0;
        return {
            reach,
            impact,
            confidence,
            effort,
            score: Math.round(score * 100) / 100,
            estimated_by: overrides && Object.keys(overrides).length > 0 ? "human" : "llm",
        };
    }
    _computeICE(rice) {
        // Normalise RICE values to 1–10 scale
        const impact = Math.max(1, Math.min(10, Math.round((rice.impact / 3) * 10)));
        const confidence = Math.max(1, Math.min(10, Math.round(rice.confidence / 10)));
        const ease = Math.max(1, Math.min(10, Math.round(10 - Math.min(9, rice.effort))));
        return {
            impact,
            confidence,
            ease,
            score: impact * confidence * ease,
            estimated_by: rice.estimated_by,
        };
    }
}
