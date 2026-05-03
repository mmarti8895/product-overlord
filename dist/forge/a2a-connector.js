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
import { randomUUID } from "crypto";
import { handleIngestIssue } from "./endpoints.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Feature-flag helpers
// ---------------------------------------------------------------------------
export function isA2AEnabled() {
    return process.env["FEATURE_ROVO_AGENT_CONNECTOR"] === "true";
}
const FEATURE_DISABLED_RESPONSE = {
    accepted: false,
    feature_disabled: true,
    error: "rovo:agentConnector is feature-flagged off (FEATURE_ROVO_AGENT_CONNECTOR=false). " +
        "Use the stable Forge Rovo agent path instead.  " +
        "Enable only after confirmed EAP approval.",
};
// ---------------------------------------------------------------------------
// 4.1  Receive assignment / @mention event → call orchestrator → return draft
// ---------------------------------------------------------------------------
export async function handleA2AEvent(event, authToken) {
    // 4.2  Feature-flag check
    if (!isA2AEnabled()) {
        logger.info("a2a_feature_disabled", { event_type: event.event_type, issue_key: event.issue_key });
        return FEATURE_DISABLED_RESPONSE;
    }
    if (!authToken) {
        return { accepted: false, error: "Unauthorized — A2A server token required" };
    }
    logger.info("a2a_event_received", {
        event_type: event.event_type,
        issue_key: event.issue_key,
        triggered_by: event.triggered_by_account_id,
    });
    // Delegate to the same ingest-issue endpoint the Forge agent uses
    const forgeReq = {
        headers: { authorization: `Bearer ${authToken}` },
        body: { issue_key: event.issue_key },
    };
    const response = await handleIngestIssue(forgeReq);
    if (response.status !== 200) {
        return {
            accepted: false,
            error: `Orchestrator returned ${response.status}`,
        };
    }
    const envelope = response.body;
    logger.info("a2a_draft_ready", {
        run_id: envelope.run_id,
        issue_key: event.issue_key,
        verdict: envelope.verdict,
    });
    return {
        accepted: true,
        run_id: envelope.run_id,
        draft_summary: envelope.summary,
        confirm_post_url: envelope.confirm_post_url,
    };
}
export function buildA2AFallback(issueKey) {
    logger.warn("a2a_unavailable_fallback", { issue_key: issueKey });
    return {
        fallback: true,
        message: "A2A connector is unavailable. No data was lost.",
        manual_action_hint: `Use the Rovo agent 'Analyse this ticket' action for ${issueKey} in the Jira UI.`,
        run_id: randomUUID(),
    };
}
export function getAgentConnectorManifestEntry() {
    return {
        type: "rovo:agentConnector",
        key: "product-overlord-a2a",
        name: "Product Overlord A2A Connector",
        description: "EAP: projects the external orchestrator as an assignable Jira teammate via A2A. " +
            "Disabled until EAP approval confirmed.",
        feature_flag: "FEATURE_ROVO_AGENT_CONNECTOR",
        enabled: isA2AEnabled(),
    };
}
