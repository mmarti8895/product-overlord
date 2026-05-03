/**
 * Canonical Ticket Normaliser
 *
 * Merges raw Jira API fields into a single CanonicalTicket schema.
 * Resolves all 8 Atlassian acceptance-criteria field aliases.
 * Normalises linked artifacts and dependency relationships.
 */
import type { CanonicalTicket } from "../types/index.js";
import type { RawIssue } from "../adapters/rovo-mcp.js";
export declare const AC_ALIASES: readonly ["Acceptance Criteria", "AC", "ACs", "Business Requirements", "Functional Requirements", "Requirements", "Definition of Done", "DoD"];
export type AcAlias = (typeof AC_ALIASES)[number];
export declare function normaliseTicket(raw: RawIssue, opts?: {
    boardId?: string;
    sprintId?: string;
}): CanonicalTicket;
export declare function resolveAc(fields: Record<string, unknown>): {
    value: string | null;
    source: string | null;
};
