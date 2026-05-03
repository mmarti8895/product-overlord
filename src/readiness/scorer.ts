/**
 * Readiness Scoring Engine
 *
 * Deterministic, code-based scoring (no LLM logic).
 *
 * Algorithm:
 *   1. For each dimension in the profile, check whether the ticket's relevant
 *      fields have non-empty values.
 *   2. Dimensions that pass contribute their weight to the raw score.
 *   3. Raw score is scaled to 0–100.
 *   4. Dependency check: any dependency with status "Open" | "To Do" is a
 *      hard blocker → verdict forced to "blocked".
 *   5. Confidence is driven by data completeness (ratio of fields populated
 *      across all dimensions).
 *   6. Verdict:
 *       score ≥ 80 AND no blockers → "ready"
 *       any high-severity missing item OR blocker → "blocked" / "needs_clarification"
 *       otherwise → "needs_clarification"
 */

import { logger } from "../utils/logger.js";
import type {
  CanonicalTicket,
  ReadinessStatus,
  MissingItem,
  ReadinessResult,
} from "../types/index.js";
import type { ReadinessProfile, DimensionRule } from "./profile.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OPEN_STATUSES = new Set(["open", "to do", "todo"]);

/** True when the dimension's required fields are all null/empty */
function isDimensionMissing(rule: DimensionRule, ticket: CanonicalTicket): boolean {
  return rule.fields.every((field) => {
    const val = (ticket as unknown as Record<string, unknown>)[field];
    if (val === null || val === undefined) return true;
    if (typeof val === "string" && val.trim() === "") return true;
    if (Array.isArray(val) && val.length === 0) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

export interface ScorerOptions {
  /** Override the ready score threshold (default 80) */
  readyThreshold?: number;
}

export interface ScorerInput {
  ticket: CanonicalTicket;
  profile: ReadinessProfile;
  profileSource: "project" | "default";
  options?: ScorerOptions;
}

export interface ScorerOutput extends ReadinessResult {}

export function scoreTicket(input: ScorerInput): ScorerOutput {
  const { ticket, profile, profileSource, options = {} } = input;
  const threshold = options.readyThreshold ?? 80;

  // ------------------------------------------------------------------
  // 1. Dependency / blocker check
  // ------------------------------------------------------------------
  const blockers = ticket.dependencies.filter((dep) => {
    if (!dep.status) return false;
    return OPEN_STATUSES.has(dep.status.toLowerCase());
  });

  // ------------------------------------------------------------------
  // 2. Evaluate each dimension
  // ------------------------------------------------------------------
  const missingItems: MissingItem[] = [];
  let weightedScore = 0;
  let totalWeight = 0;
  let populatedFieldCount = 0;
  let totalFieldCount = 0;

  for (const rule of profile.dimensions) {
    totalWeight += rule.weight;
    totalFieldCount += rule.fields.length;

    if (isDimensionMissing(rule, ticket)) {
      missingItems.push({
        dimension: rule.id,
        severity: rule.severity,
        reason: `"${rule.label}" is missing or empty.`,
      });
    } else {
      weightedScore += rule.weight;
      populatedFieldCount += rule.fields.length;
    }
  }

  // ------------------------------------------------------------------
  // 3. Normalise score (0–100)
  // ------------------------------------------------------------------
  const normalisedScore = totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 0;

  // ------------------------------------------------------------------
  // 4. Confidence: ratio of populated fields + penalise for blockers
  // ------------------------------------------------------------------
  const fieldRatio = totalFieldCount > 0 ? populatedFieldCount / totalFieldCount : 0;
  const blockerPenalty = blockers.length > 0 ? 0.2 : 0;
  const confidence = Math.max(0, Math.round((fieldRatio - blockerPenalty) * 100) / 100);

  // ------------------------------------------------------------------
  // 5. Determine verdict
  // ------------------------------------------------------------------
  let verdict: ReadinessStatus;

  if (blockers.length > 0) {
    verdict = "blocked";
  } else if (normalisedScore >= threshold && missingItems.length === 0) {
    verdict = "ready";
  } else if (missingItems.some((m) => m.severity === "high")) {
    verdict = "needs_clarification";
  } else if (normalisedScore < threshold) {
    verdict = "needs_clarification";
  } else {
    verdict = "ready";
  }

  // ------------------------------------------------------------------
  // 6. Build explanation
  // ------------------------------------------------------------------
  let explanation: string;

  if (verdict === "blocked") {
    const keys = blockers.map((b) => b.key).join(", ");
    explanation = `Ticket ${ticket.ticket_key} is blocked by unresolved dependencies: ${keys}. Resolve these before grooming.`;
  } else if (verdict === "ready") {
    explanation = `Ticket ${ticket.ticket_key} meets all readiness dimensions (score ${normalisedScore}/100).`;
  } else {
    const highItems = missingItems
      .filter((m) => m.severity === "high")
      .map((m) => m.dimension)
      .join(", ");
    explanation =
      `Ticket ${ticket.ticket_key} scored ${normalisedScore}/100 and needs clarification.` +
      (highItems ? ` Critical missing: ${highItems}.` : "");
  }

  // ------------------------------------------------------------------
  // 7. Log profile source when default
  // ------------------------------------------------------------------
  if (profileSource === "default") {
    logger.info("readiness_score", {
      ticket_key: ticket.ticket_key,
      profile_source: "default",
      profile_id: profile.id,
      verdict,
      score: normalisedScore,
    });
  }

  return {
    ticket_key: ticket.ticket_key,
    ticket_type: ticket.ticket_type,
    readiness_status: verdict,
    readiness_score: normalisedScore,
    missing_items: missingItems,
    questions_for_pm: [],      // populated by clarification generator
    questions_for_engineer: [],
    questions_for_qa: [],
    manual_checks: [],
    confidence,
    explanation,
    evidence: [],              // populated by evidence store
  };
}
