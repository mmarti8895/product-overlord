/**
 * Solution Planner
 *
 * Merges a ReadinessResult and a RepoMapResult into a single ActionPackage.
 * Surfaces conflicts when readiness says `ready` but repo confidence is low.
 */
import { logger } from "../utils/logger.js";
import { groundPlanPrompt } from "../llm/prompts.js";
// ---------------------------------------------------------------------------
// Branch-name helpers
// ---------------------------------------------------------------------------
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);
}
/** Produces: {ticketKey}-{summary-slug}, e.g. ABC-123-improve-webhook-retry */
export function buildBranchName(ticketKey, summary) {
    const slug = slugify(summary);
    return `${ticketKey.toLowerCase()}-${slug}`;
}
/** Produces a valid OpenSpec change slug, e.g. abc-123-improve-webhook-retry */
export function buildOpenspecSlug(ticketKey, summary) {
    return buildBranchName(ticketKey, summary);
}
// ---------------------------------------------------------------------------
// Conflict detection (task 3.3)
// ---------------------------------------------------------------------------
const CONFLICT_CONFIDENCE_THRESHOLD = 0.3;
function detectConflict(readiness, repoMap) {
    if (readiness.readiness_status !== "ready")
        return null;
    if (!repoMap)
        return null;
    const topConfidence = repoMap.candidate_components[0]?.confidence ?? 0;
    if (topConfidence < CONFLICT_CONFIDENCE_THRESHOLD) {
        return {
            reason: `Readiness verdict is 'ready' but repo-mapping confidence is ${topConfidence.toFixed(2)} ` +
                `(threshold: ${CONFLICT_CONFIDENCE_THRESHOLD}). Component grounding is insufficient.`,
            readiness_status: readiness.readiness_status,
            repo_map_confidence: topConfidence,
        };
    }
    return null;
}
export async function planActionPackage(input) {
    const { readiness, repoMap, summary, llmAdapter, contextBlock, fileContents } = input;
    const ticketKey = readiness.ticket_key;
    const branchName = buildBranchName(ticketKey, summary);
    const openspecSlug = buildOpenspecSlug(ticketKey, summary);
    const conflict = detectConflict(readiness, repoMap);
    const repoMapConfidence = repoMap?.candidate_components[0]?.confidence ?? 0;
    const evidence = [
        ...readiness.evidence,
        ...(repoMap?.evidence ?? ["repo_map_unavailable"]),
    ];
    let candidateComponents = repoMap?.candidate_components ?? [];
    let candidateFiles = repoMap?.candidate_files ?? [];
    const llmTraces = [];
    // ── LLM ground-plan (optional, non-fatal) ──────────────────────────────
    if (llmAdapter && repoMap) {
        try {
            const prompt = groundPlanPrompt({
                ticketKey,
                ticketSummary: summary,
                acceptanceCriteria: readiness.missing_items.length > 0 ? null : "(all met)",
                description: summary,
                contextBlock: contextBlock ?? "",
                candidateComponents: JSON.stringify(repoMap.candidate_components),
                fileContents,
            });
            const schema = {
                type: "object",
                properties: {
                    component_justifications: { type: "array" },
                    file_justifications: { type: "array" },
                },
            };
            const { result, trace } = await Promise.race([
                llmAdapter.complete(prompt, schema),
                new Promise((_, reject) => setTimeout(() => reject(new Error("groundPlan timeout")), 10_000)),
            ]);
            llmTraces.push(trace);
            // Apply justifications from LLM, falling back to heuristic strings
            const compJust = new Map(result.component_justifications.map((j) => [j.name, j.why]));
            const fileJust = new Map(result.file_justifications.map((j) => [j.path, j.reason]));
            candidateComponents = candidateComponents.map((c) => ({
                ...c,
                why: compJust.get(c.name) ?? c.why,
            }));
            candidateFiles = candidateFiles.map((f) => ({
                ...f,
                reason: fileJust.get(f.path) ?? f.reason,
            }));
            evidence.push("ground_plan_llm");
        }
        catch (err) {
            logger.warn("ground_plan_llm_failed", { ticket_key: ticketKey, error: String(err) });
            evidence.push("ground_plan_heuristic_fallback");
        }
    }
    const pkg = {
        ticket_key: ticketKey,
        readiness_status: readiness.readiness_status,
        readiness_score: readiness.readiness_score,
        candidate_components: candidateComponents,
        candidate_files: candidateFiles,
        candidate_tests: repoMap?.candidate_tests ?? [],
        branch_name_suggestion: branchName,
        openspec_change_slug: openspecSlug,
        operational_risks: readiness.missing_items
            .filter((m) => m.severity === "high")
            .map((m) => m.reason),
        manual_checks: readiness.manual_checks,
        repo_map_confidence: repoMapConfidence,
        low_confidence: repoMap?.low_confidence ?? true,
        conflict,
        evidence,
    };
    logger.info("solution_planner_merge", {
        ticket_key: ticketKey,
        readiness_status: readiness.readiness_status,
        repo_map_confidence: repoMapConfidence,
        conflict: !!conflict,
        branch_name_suggestion: branchName,
        llm_grounded: llmTraces.length > 0,
    });
    return pkg;
}
