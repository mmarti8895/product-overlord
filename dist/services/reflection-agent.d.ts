/**
 * ReflectionAgent — uses LLM to write a sprint-retrospective-style Markdown
 * commentary on OKR progress. (task 2.7)
 */
import type { LLMAdapter } from "../llm/types.js";
import type { OKR, OKRDelta } from "../types/outcomes.js";
export declare class ReflectionAgent {
    private readonly llm;
    constructor(llm: LLMAdapter);
    reflect(projectKey: string, okrs: OKR[], deltas: OKRDelta[]): Promise<string>;
}
