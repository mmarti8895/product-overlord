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
import { logger } from "../utils/logger.js";
import { latencyTracker } from "../utils/latency.js";
import { confidenceHistogram } from "../utils/confidence-histogram.js";
// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------
const SEMANTIC_WEIGHT = 0.6;
const STRUCTURAL_WEIGHT = 0.4;
// ---------------------------------------------------------------------------
// Semantic scoring (keyword overlap — no external embedding API required)
// ---------------------------------------------------------------------------
function tokenise(text) {
    return new Set(text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2));
}
/**
 * Jaccard similarity between two token sets.
 */
function jaccardSimilarity(a, b) {
    if (a.size === 0 && b.size === 0)
        return 0;
    let intersection = 0;
    for (const t of a)
        if (b.has(t))
            intersection++;
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
function semanticScore(ticket, dossier) {
    const ticketTokens = tokenise([ticket.summary, ticket.description, ticket.acceptance_criteria ?? ""].join(" "));
    const componentTokens = tokenise([
        dossier.name,
        ...dossier.frameworks,
        ...dossier.rootPaths,
        ...dossier.fixExamples.map((e) => e.title + " " + e.summary),
    ].join(" "));
    return jaccardSimilarity(ticketTokens, componentTokens);
}
// ---------------------------------------------------------------------------
// Structural scoring
// ---------------------------------------------------------------------------
function structuralScore(ticket, dossier) {
    let score = 0;
    const text = [ticket.summary, ticket.description].join(" ").toLowerCase();
    // Component name match in ticket text
    if (text.includes(dossier.name.toLowerCase()))
        score += 0.4;
    // Label overlap
    for (const label of ticket.labels) {
        if (dossier.name.toLowerCase().includes(label.toLowerCase()))
            score += 0.1;
        if (dossier.frameworks.some((f) => f.toLowerCase() === label.toLowerCase()))
            score += 0.1;
    }
    // Fix example path overlap (co-change signal)
    const mentionedPaths = dossier.fixExamples.flatMap((e) => e.paths);
    if (mentionedPaths.length > 0)
        score += 0.1;
    // Owner match (heuristic — not full CODEOWNERS parsing)
    if (dossier.owners.length > 0)
        score += 0.05;
    return Math.min(score, 1.0);
}
// ---------------------------------------------------------------------------
// Candidate file + test generation
// ---------------------------------------------------------------------------
function deriveCandidateFiles(ticket, dossier) {
    const files = [];
    // Root source paths
    const sourceRoots = dossier.rootPaths.filter((p) => !p.includes("test") && !p.includes("spec"));
    for (const path of sourceRoots.slice(0, 5)) {
        files.push({ path, reason: `Component root path for ${dossier.name}` });
    }
    // Historical fix examples
    for (const ex of dossier.fixExamples.slice(0, 3)) {
        for (const path of ex.paths.slice(0, 2)) {
            if (!files.some((f) => f.path === path)) {
                files.push({ path, reason: `Historical fix: ${ex.title}` });
            }
        }
    }
    return files;
}
function deriveCandidateTests(dossier) {
    if (dossier.testDirs.length === 0) {
        return { tests: [], testLocationUnknown: true };
    }
    const tests = dossier.testDirs.slice(0, 3).map((dir) => ({
        path: dir,
        reason: `Known test directory for ${dossier.name}`,
    }));
    return { tests, testLocationUnknown: false };
}
export function mapTicketToComponents(args) {
    const { ticket, index, options } = args;
    const topK = options?.topK ?? 5;
    const evidenceLog = [];
    // ── Unavailable path ──────────────────────────────────────────────────────
    if (!index) {
        logger.warn("repo_mapper_blocked", {
            ticket_key: ticket.ticket_key,
            reason: "repo_index_unavailable",
        });
        return {
            ticket_key: ticket.ticket_key,
            candidate_components: [],
            candidate_files: [],
            candidate_tests: [],
            low_confidence: true,
            test_location_unknown: true,
            enrichment_source: "unavailable",
            evidence: ["repo_index_unavailable"],
        };
    }
    const startMs = Date.now();
    // ── Score all components ──────────────────────────────────────────────────
    const scored = index.components.map((dossier) => {
        const sem = semanticScore(ticket, dossier);
        const str = structuralScore(ticket, dossier);
        const combined = SEMANTIC_WEIGHT * sem + STRUCTURAL_WEIGHT * str;
        return { dossier, sem, str, combined };
    });
    scored.sort((a, b) => b.combined - a.combined);
    const top = scored.slice(0, topK);
    latencyTracker.record("repo-mapper", Date.now() - startMs);
    // ── Build candidate list ──────────────────────────────────────────────────
    const candidateComponents = top.map(({ dossier, sem, str, combined }) => {
        const why = `semantic=${sem.toFixed(2)} structural=${str.toFixed(2)} combined=${combined.toFixed(2)}`;
        evidenceLog.push(`component:${dossier.name} ${why}`);
        return { name: dossier.name, confidence: parseFloat(combined.toFixed(3)), why };
    });
    const maxConfidence = candidateComponents[0]?.confidence ?? 0;
    const lowConfidence = maxConfidence <= 0.5;
    // ── Best-match candidate for file/test derivation ─────────────────────────
    const bestDossier = top[0]?.dossier ?? null;
    let candidateFiles = [];
    let candidateTests = [];
    let testLocationUnknown = true;
    if (bestDossier) {
        candidateFiles = deriveCandidateFiles(ticket, bestDossier);
        const { tests, testLocationUnknown: tlu } = deriveCandidateTests(bestDossier);
        candidateTests = tests;
        testLocationUnknown = tlu;
    }
    if (lowConfidence) {
        evidenceLog.push(`low_confidence: max_confidence=${maxConfidence.toFixed(3)}`);
    }
    if (testLocationUnknown) {
        evidenceLog.push("test_location_unknown");
    }
    logger.info("repo_mapper_result", {
        ticket_key: ticket.ticket_key,
        top_component: candidateComponents[0]?.name ?? "none",
        max_confidence: maxConfidence,
        low_confidence: lowConfidence,
    });
    // Record confidence in histogram (task 5.2)
    if (confidenceHistogram)
        confidenceHistogram.record(maxConfidence);
    return {
        ticket_key: ticket.ticket_key,
        candidate_components: candidateComponents,
        candidate_files: candidateFiles,
        candidate_tests: candidateTests,
        low_confidence: lowConfidence,
        test_location_unknown: testLocationUnknown,
        enrichment_source: "structural_only",
        evidence: evidenceLog,
    };
}
