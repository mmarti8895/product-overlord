/**
 * Repo Mapper Agent
 *
 * Ranks repository components against a canonical ticket using:
 *   1. Semantic retrieval — keyword/domain similarity between ticket and component
 *   2. Structural retrieval — file-path patterns, ownership, historical co-change
 *
 * The two scores are combined into a ranked candidate list.
 *
 * Invariants:
 *   - low_confidence: true when no component scores > 0.5
 *   - test_location_unknown: true when top component has no testDirs
 *   - If component index is unavailable, returns verdict { blocked: true }
 */
import type { CanonicalTicket, RepoMapResult } from "../types/index.js";
import type { ComponentIndex } from "./component-indexer.js";
export interface MapperOptions {
    /** Maximum candidates to return (default: 5) */
    topK?: number;
}
export interface MapTicketArgs {
    ticket: CanonicalTicket;
    index: ComponentIndex | null;
    options?: MapperOptions;
}
export declare function mapTicketToComponents(args: MapTicketArgs): RepoMapResult;
