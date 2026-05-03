/**
 * Readiness Profile Schema
 *
 * A ReadinessProfile defines, per project + issue-type, which dimensions are
 * evaluated and what weight (0–1) each carries toward the final 0–100 score.
 *
 * Built-in default profiles ship for story, bug, and task. Project-specific
 * overrides can be loaded at runtime.
 */
import type { Severity, Persona } from "../types/index.js";
export type DimensionId = "business_intent" | "acceptance_criteria" | "scope_boundaries" | "dependencies_declared" | "rollout_constraints" | "test_hints" | "actual_behaviour" | "expected_behaviour" | "repro_steps" | "environment" | "evidence" | "affected_services" | "exit_criteria" | "summary_clarity" | "assignee_set" | "priority_set";
export interface DimensionRule {
    /** Unique identifier for this dimension */
    id: DimensionId | string;
    /** Human-readable label */
    label: string;
    /** Weight toward the total score (all weights in a profile should sum to 1.0) */
    weight: number;
    /** Severity of missing this dimension */
    severity: Severity;
    /**
     * Which canonical ticket field(s) to inspect.
     * If ALL listed fields are null / empty the dimension is considered missing.
     */
    fields: string[];
    /** Persona who should answer a clarification question for this dimension */
    clarificationPersona: Persona;
    /** Template for the clarification question (use {ticket_key} as placeholder) */
    clarificationTemplate: string;
}
export interface ReadinessProfile {
    /** Unique profile ID, e.g. "default:story" or "PROJECT-KEY:bug" */
    id: string;
    /** Display name */
    name: string;
    /** Issue type this profile applies to */
    issueType: "story" | "bug" | "task" | string;
    /**
     * Optional project key. When null this is a built-in default applied to all
     * projects that don't have an explicit override.
     */
    projectKey: string | null;
    dimensions: DimensionRule[];
}
export declare const DEFAULT_STORY_PROFILE: ReadinessProfile;
export declare const DEFAULT_BUG_PROFILE: ReadinessProfile;
export declare const DEFAULT_TASK_PROFILE: ReadinessProfile;
export declare class ProfileRegistry {
    private readonly profiles;
    constructor(extraProfiles?: ReadinessProfile[]);
    /**
     * Resolve the best-matching profile for a given project key + issue type.
     * Returns { profile, source } where source is "project" | "default".
     */
    resolve(projectKey: string, issueType: string): {
        profile: ReadinessProfile;
        source: "project" | "default";
    };
    /** Register a project-specific profile override */
    register(profile: ReadinessProfile): void;
}
