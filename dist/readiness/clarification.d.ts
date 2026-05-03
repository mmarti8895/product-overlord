/**
 * Clarification Question Generator
 *
 * Given a scorer output (missing items) and the originating readiness profile,
 * generates persona-targeted clarification questions.
 *
 * Each question is derived deterministically from the profile's
 * `clarificationTemplate` for the corresponding dimension.
 */
import type { ReadinessResult } from "../types/index.js";
import type { ReadinessProfile } from "./profile.js";
export interface GeneratedQuestions {
    questions_for_pm: string[];
    questions_for_engineer: string[];
    questions_for_qa: string[];
}
/**
 * Generate persona-targeted clarification questions from a scorer output.
 * Mutates (fills) the question arrays on the passed `result` and also
 * returns the questions map for convenience.
 */
export declare function generateQuestions(result: ReadinessResult, profile: ReadinessProfile): GeneratedQuestions;
/**
 * Convenience: generate questions only when the verdict warrants it.
 * Returns the same result object (with questions populated if applicable).
 */
export declare function applyQuestions(result: ReadinessResult, profile: ReadinessProfile): ReadinessResult;
