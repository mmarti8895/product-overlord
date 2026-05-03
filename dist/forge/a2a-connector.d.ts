/**
 * EAP rovo:agentConnector Shell (Tasks 4.1 – 4.5)
 *
 * This module implements the A2A server that projects the external
 * orchestrator as an assignable / @mentionable Jira teammate.
 *
 * IMPORTANT — feature-flagged off by default:
 *   FEATURE_ROVO_AGENT_CONNECTOR=false (default)
 *
 * The connector MUST NOT be activated in production without confirmed
 * Atlassian EAP approval (task 1.3 / 4.3).  When the flag is false every
 * handler returns HTTP 503 with a clear "feature disabled" message and logs
 * a diagnostic entry — no data is lost and callers can fall back to the
 * manual Forge action path (task 4.5).
 *
 * When the flag is true the connector:
 *   1. Receives assignment / @mention events from the Jira webhook layer
 *   2. Calls the orchestrator endpoint (same as the Forge action path)
 *   3. Returns a draft comment + confirm_post_url — NEVER writes to Jira
 *      autonomously
 */
import type { A2AEvent, A2AResponse } from "./types.js";
export declare function isA2AEnabled(): boolean;
export declare function handleA2AEvent(event: A2AEvent, authToken: string): Promise<A2AResponse>;
export interface A2AFallbackInfo {
    fallback: true;
    message: string;
    manual_action_hint: string;
    run_id: string;
}
export declare function buildA2AFallback(issueKey: string): A2AFallbackInfo;
export interface ForgeManifestEntry {
    type: "rovo:agentConnector";
    key: string;
    name: string;
    description: string;
    feature_flag: string;
    enabled: boolean;
}
export declare function getAgentConnectorManifestEntry(): ForgeManifestEntry;
