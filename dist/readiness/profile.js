/**
 * Readiness Profile Schema
 *
 * A ReadinessProfile defines, per project + issue-type, which dimensions are
 * evaluated and what weight (0–1) each carries toward the final 0–100 score.
 *
 * Built-in default profiles ship for story, bug, and task. Project-specific
 * overrides can be loaded at runtime.
 */
// ---------------------------------------------------------------------------
// Default profiles
// ---------------------------------------------------------------------------
export const DEFAULT_STORY_PROFILE = {
    id: "default:story",
    name: "Default Story Profile",
    issueType: "story",
    projectKey: null,
    dimensions: [
        {
            id: "business_intent",
            label: "Business Intent",
            weight: 0.15,
            severity: "high",
            fields: ["description"],
            clarificationPersona: "pm",
            clarificationTemplate: "What is the business outcome this story is intended to achieve for {ticket_key}? Please add a brief goal statement to the description.",
        },
        {
            id: "acceptance_criteria",
            label: "Acceptance Criteria",
            weight: 0.30,
            severity: "high",
            fields: ["acceptance_criteria"],
            clarificationPersona: "pm",
            clarificationTemplate: "What are the measurable acceptance criteria for {ticket_key}? Please provide at least one verifiable success condition.",
        },
        {
            id: "scope_boundaries",
            label: "Scope Boundaries",
            weight: 0.15,
            severity: "medium",
            fields: ["description"],
            clarificationPersona: "pm",
            clarificationTemplate: "What is explicitly out of scope for {ticket_key}? Adding a brief 'Not in scope' section will prevent scope creep.",
        },
        {
            id: "dependencies_declared",
            label: "Dependencies Declared",
            weight: 0.20,
            severity: "high",
            fields: ["dependencies"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Are there any service or ticket dependencies for {ticket_key}? Please declare them as 'is blocked by' links so they appear in the dependency graph.",
        },
        {
            id: "rollout_constraints",
            label: "Rollout Constraints",
            weight: 0.10,
            severity: "low",
            fields: ["description", "labels"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Does {ticket_key} have any rollout constraints (feature flags, dark launches, migration steps)? If so, please document them in the description.",
        },
        {
            id: "test_hints",
            label: "Test Hints",
            weight: 0.10,
            severity: "medium",
            fields: ["acceptance_criteria", "description"],
            clarificationPersona: "qa",
            clarificationTemplate: "What test scenarios should QA validate for {ticket_key}? Adding test hints to the acceptance criteria will speed up test planning.",
        },
    ],
};
export const DEFAULT_BUG_PROFILE = {
    id: "default:bug",
    name: "Default Bug Profile",
    issueType: "bug",
    projectKey: null,
    dimensions: [
        {
            id: "actual_behaviour",
            label: "Actual Behaviour",
            weight: 0.15,
            severity: "high",
            fields: ["description"],
            clarificationPersona: "pm",
            clarificationTemplate: "What is the actual (broken) behaviour observed in {ticket_key}? Please describe it clearly in the description.",
        },
        {
            id: "expected_behaviour",
            label: "Expected Behaviour",
            weight: 0.15,
            severity: "high",
            fields: ["description", "acceptance_criteria"],
            clarificationPersona: "pm",
            clarificationTemplate: "What is the expected (correct) behaviour for {ticket_key}? Please add the expected outcome to the description or acceptance criteria.",
        },
        {
            id: "repro_steps",
            label: "Reproducible Steps",
            weight: 0.25,
            severity: "high",
            fields: ["description"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Can you provide step-by-step reproduction instructions for {ticket_key}? This is the single most important field for diagnosing the bug.",
        },
        {
            id: "environment",
            label: "Environment",
            weight: 0.15,
            severity: "medium",
            fields: ["description", "labels"],
            clarificationPersona: "engineer",
            clarificationTemplate: "In which environment was {ticket_key} observed (production / staging / local)? What version or deployment was running?",
        },
        {
            id: "evidence",
            label: "Evidence (logs / screenshots)",
            weight: 0.15,
            severity: "medium",
            fields: ["linked_artifacts", "description"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Are there any logs, screenshots, or traces attached to {ticket_key}? Please attach or link them — they dramatically reduce investigation time.",
        },
        {
            id: "affected_services",
            label: "Affected Services",
            weight: 0.10,
            severity: "medium",
            fields: ["labels", "description"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Which services or components are affected by {ticket_key}? Please add relevant service labels.",
        },
        {
            id: "exit_criteria",
            label: "Exit Criteria",
            weight: 0.05,
            severity: "low",
            fields: ["acceptance_criteria"],
            clarificationPersona: "qa",
            clarificationTemplate: "How will we verify that {ticket_key} is fixed? Please add an acceptance criterion describing the passing state.",
        },
    ],
};
export const DEFAULT_TASK_PROFILE = {
    id: "default:task",
    name: "Default Task Profile",
    issueType: "task",
    projectKey: null,
    dimensions: [
        {
            id: "summary_clarity",
            label: "Summary Clarity",
            weight: 0.30,
            severity: "high",
            fields: ["summary"],
            clarificationPersona: "pm",
            clarificationTemplate: "The summary for {ticket_key} is too vague. Can you rewrite it as '<verb> <object> so that <outcome>'?",
        },
        {
            id: "acceptance_criteria",
            label: "Done Definition",
            weight: 0.35,
            severity: "high",
            fields: ["acceptance_criteria"],
            clarificationPersona: "pm",
            clarificationTemplate: "How will we know {ticket_key} is complete? Please add a brief definition of done.",
        },
        {
            id: "dependencies_declared",
            label: "Dependencies Declared",
            weight: 0.20,
            severity: "medium",
            fields: ["dependencies"],
            clarificationPersona: "engineer",
            clarificationTemplate: "Does {ticket_key} depend on any other tickets or services? If so, please add 'is blocked by' links.",
        },
        {
            id: "assignee_set",
            label: "Assignee Set",
            weight: 0.15,
            severity: "low",
            fields: ["assignee"],
            clarificationPersona: "pm",
            clarificationTemplate: "Who is responsible for delivering {ticket_key}? Please set an assignee.",
        },
    ],
};
// ---------------------------------------------------------------------------
// Profile registry
// ---------------------------------------------------------------------------
const BUILT_IN_PROFILES = [
    DEFAULT_STORY_PROFILE,
    DEFAULT_BUG_PROFILE,
    DEFAULT_TASK_PROFILE,
];
export class ProfileRegistry {
    profiles = new Map();
    constructor(extraProfiles = []) {
        for (const p of BUILT_IN_PROFILES) {
            this.profiles.set(p.id, p);
        }
        for (const p of extraProfiles) {
            this.profiles.set(p.id, p);
        }
    }
    /**
     * Resolve the best-matching profile for a given project key + issue type.
     * Returns { profile, source } where source is "project" | "default".
     */
    resolve(projectKey, issueType) {
        const normalised = issueType.toLowerCase();
        // Project-specific override first
        const projectId = `${projectKey}:${normalised}`;
        if (this.profiles.has(projectId)) {
            return { profile: this.profiles.get(projectId), source: "project" };
        }
        // Fall back to default by issue type
        const defaultId = `default:${normalised}`;
        if (this.profiles.has(defaultId)) {
            return { profile: this.profiles.get(defaultId), source: "default" };
        }
        // Ultimate fallback: task profile
        return { profile: DEFAULT_TASK_PROFILE, source: "default" };
    }
    /** Register a project-specific profile override */
    register(profile) {
        this.profiles.set(profile.id, profile);
    }
}
