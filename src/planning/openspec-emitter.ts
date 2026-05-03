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

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { ActionPackage, ReviewerVerdict } from "../types/index.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface EmitterConfig {
  /** Root of the repo (default: process.cwd()) */
  repoRoot?: string;
  /** If true, skip file writes (shadow mode) */
  shadowMode?: boolean;
}

// ---------------------------------------------------------------------------
// Emit result
// ---------------------------------------------------------------------------

export interface EmitResult {
  confirmed: boolean;
  writtenPaths: string[];
  shadowMode: boolean;
  confirm_post_url: string;
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function renderProposal(pkg: ActionPackage): string {
  return `# OpenSpec Change Proposal: ${pkg.openspec_change_slug}

## Intent
Auto-generated planning output for Jira ticket \`${pkg.ticket_key}\`.

## Readiness
- Status: \`${pkg.readiness_status}\`
- Score: ${pkg.readiness_score}/100

## Repo Grounding
- Top component: ${pkg.candidate_components[0]?.name ?? "none"}
- Confidence: ${pkg.repo_map_confidence.toFixed(2)}
- Low confidence: ${pkg.low_confidence}
${pkg.conflict ? `\n## ⚠️ Conflict\n${pkg.conflict.reason}\n` : ""}
## Branch
\`${pkg.branch_name_suggestion}\`

## Operational Risks
${pkg.operational_risks.length > 0 ? pkg.operational_risks.map((r) => `- ${r}`).join("\n") : "None identified."}

## Manual Checks
${pkg.manual_checks.length > 0 ? pkg.manual_checks.map((c) => `- [ ] ${c}`).join("\n") : "None."}
`;
}

function renderDesign(pkg: ActionPackage): string {
  const components = pkg.candidate_components
    .map((c) => `- **${c.name}** (confidence: ${c.confidence.toFixed(2)}): ${c.why}`)
    .join("\n");

  const files = pkg.candidate_files
    .map((f) => `- \`${f.path}\` — ${f.reason}`)
    .join("\n");

  const tests = pkg.candidate_tests
    .map((t) => `- \`${t.path}\` — ${t.reason}`)
    .join("\n");

  return `# Design Notes: ${pkg.openspec_change_slug}

## Candidate Components
${components || "None identified."}

## Candidate Files
${files || "None identified."}

## Candidate Tests
${tests || "None identified."}

## Evidence
${pkg.evidence.map((e) => `- ${e}`).join("\n")}
`;
}

function renderTasks(pkg: ActionPackage): string {
  return `# Implementation Tasks: ${pkg.openspec_change_slug}

Auto-generated for \`${pkg.ticket_key}\` on ${new Date().toISOString()}.

## Tasks

- [ ] 1. Review candidate components: ${pkg.candidate_components.map((c) => c.name).join(", ") || "TBD"}
- [ ] 2. Validate branch name: \`${pkg.branch_name_suggestion}\`
- [ ] 3. Confirm affected files and add/update tests
- [ ] 4. Address all manual checks listed in proposal.md
- [ ] 5. Human review before merge
`;
}

function renderOutputContractSpec(pkg: ActionPackage): string {
  return `## ADDED Requirements — ${pkg.openspec_change_slug}

### Requirement: Action package for ${pkg.ticket_key}
The action package for \`${pkg.ticket_key}\` SHALL include candidate components,
candidate files, candidate tests, branch name suggestion, and OpenSpec slug as
defined by the stage-2 output contract.
`;
}

// ---------------------------------------------------------------------------
// Emitter
// ---------------------------------------------------------------------------

export function emitOpenSpecArtifact(
  pkg: ActionPackage,
  verdict: ReviewerVerdict,
  config: EmitterConfig = {}
): EmitResult {
  const shadowMode =
    config.shadowMode ?? process.env["SHADOW_MODE"] === "true";
  const repoRoot = config.repoRoot ?? process.cwd();
  const slug = pkg.openspec_change_slug;

  // Not approved
  if (!verdict.approved) {
    logger.warn("openspec_emit_blocked", {
      ticket_key: pkg.ticket_key,
      reasons: verdict.reasons,
    });
    return {
      confirmed: false,
      writtenPaths: [],
      shadowMode,
      confirm_post_url: "",
    };
  }

  const confirmUrl = shadowMode
    ? `shadow://no-op/openspec/${slug}`
    : `file://${repoRoot}/openspec/changes/${slug}`;

  if (shadowMode) {
    logger.info("openspec_emit_shadow", { ticket_key: pkg.ticket_key, slug });
    return {
      confirmed: true,
      writtenPaths: [],
      shadowMode: true,
      confirm_post_url: confirmUrl,
    };
  }

  // Write artifacts
  const changeDir = join(repoRoot, "openspec", "changes", slug);
  const specsDir = join(changeDir, "specs", "output-contracts");

  mkdirSync(specsDir, { recursive: true });

  const files: Array<{ path: string; content: string }> = [
    { path: join(changeDir, "proposal.md"), content: renderProposal(pkg) },
    { path: join(changeDir, "design.md"), content: renderDesign(pkg) },
    { path: join(changeDir, "tasks.md"), content: renderTasks(pkg) },
    { path: join(specsDir, "spec.md"), content: renderOutputContractSpec(pkg) },
  ];

  const writtenPaths: string[] = [];
  for (const { path, content } of files) {
    writeFileSync(path, content, "utf-8");
    writtenPaths.push(path);
    logger.info("openspec_file_written", { path });
  }

  logger.info("openspec_emit_complete", {
    ticket_key: pkg.ticket_key,
    slug,
    files_written: writtenPaths.length,
  });

  return {
    confirmed: true,
    writtenPaths,
    shadowMode: false,
    confirm_post_url: confirmUrl,
  };
}
