/**
 * CustomAgentBuilder — scaffolds AGENTS.md, SOUL.md, SKILLS.md for a custom agent.
 */
export type AgentRole = "planner" | "executor" | "reviewer" | "orchestrator";
export interface AgentSpec {
    name: string;
    description: string;
    role: AgentRole;
    persona: string;
    skills: string[];
    maxConcurrency: number;
    rpmCap: number;
    tpmCap: number;
    retryPolicy: "none" | "exponential" | "fixed";
}
export interface BuiltAgent {
    name: string;
    dir: string;
    files: {
        "AGENTS.md": string;
        "SOUL.md": string;
        "SKILLS.md": string;
    };
}
export declare function buildAgent(spec: AgentSpec): BuiltAgent;
export declare const CAPABILITY_REGISTRY: string[];
