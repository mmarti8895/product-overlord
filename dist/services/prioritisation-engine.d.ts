/**
 * PrioritisationEngine (roadmap-planning, task 2.2)
 *
 * Computes RICE and ICE scores for an Epic using LLM estimates and Jira data.
 * Gracefully returns null scores on LLM failure — never throws.
 */
import type { Epic, RICEScore } from "../types/roadmap.js";
import type { LLMAdapter } from "../llm/types.js";
export declare class PrioritisationEngine {
    private readonly llm;
    constructor(llm: LLMAdapter);
    score(epic: Epic, overrides?: Partial<RICEScore>): Promise<Epic>;
    private _computeRICE;
    private _computeICE;
}
