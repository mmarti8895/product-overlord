/**
 * OpenSpec Artifact Emitter
 *
 * Writes a valid OpenSpec change package to `openspec/changes/<slug>/` when:
 *   1. The Reviewer has approved the ActionPackage
 *   2. The caller has explicitly confirmed the write
 *
 * Produces:
 *   proposal.md  — intent + rationale
 *   design.md    — architectural notes
 *   tasks.md     — implementation tasks
 *   specs/output-contracts/spec.md — output contract delta
 *
 * When SHADOW_MODE=true, the confirm URL is a no-op and no files are written.
 */
import type { ActionPackage, ReviewerVerdict } from "../types/index.js";
export interface EmitterConfig {
    /** Root of the repo (default: process.cwd()) */
    repoRoot?: string;
    /** If true, skip file writes (shadow mode) */
    shadowMode?: boolean;
}
export interface EmitResult {
    confirmed: boolean;
    writtenPaths: string[];
    shadowMode: boolean;
    confirm_post_url: string;
}
export declare function emitOpenSpecArtifact(pkg: ActionPackage, verdict: ReviewerVerdict, config?: EmitterConfig): EmitResult;
