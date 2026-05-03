/**
 * Clarification Question Generator
 *
 * Given a scorer output (missing items) and the originating readiness profile,
 * generates persona-targeted clarification questions.
 *
 * Each question is derived deterministically from the profile's
 * `clarificationTemplate` for the corresponding dimension.
 */
// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------
/**
 * Generate persona-targeted clarification questions from a scorer output.
 * Mutates (fills) the question arrays on the passed `result` and also
 * returns the questions map for convenience.
 */
export function generateQuestions(result, profile) {
    const pm = [];
    const engineer = [];
    const qa = [];
    // Build a dimension lookup from the profile for fast access
    const dimMap = new Map(profile.dimensions.map((d) => [d.id, d]));
    for (const item of result.missing_items) {
        const rule = dimMap.get(item.dimension);
        if (!rule)
            continue;
        const question = rule.clarificationTemplate.replaceAll("{ticket_key}", result.ticket_key);
        switch (rule.clarificationPersona) {
            case "pm":
                pm.push(question);
                break;
            case "engineer":
                engineer.push(question);
                break;
            case "qa":
                qa.push(question);
                break;
        }
    }
    // Write back into the result
    result.questions_for_pm = pm;
    result.questions_for_engineer = engineer;
    result.questions_for_qa = qa;
    return { questions_for_pm: pm, questions_for_engineer: engineer, questions_for_qa: qa };
}
/**
 * Convenience: generate questions only when the verdict warrants it.
 * Returns the same result object (with questions populated if applicable).
 */
export function applyQuestions(result, profile) {
    if (result.readiness_status === "needs_clarification" || result.readiness_status === "blocked") {
        generateQuestions(result, profile);
    }
    return result;
}
