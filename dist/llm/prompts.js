/**
 * Prompt registry.
 * All prompts are typed template functions — no external files, no I/O.
 */
/**
 * Prompt for enriching a deterministic readiness result with LLM analysis.
 * Returns JSON matching EnrichedReadinessOutput schema.
 */
export function enrichReadinessPrompt(ctx) {
    return `You are an expert product manager reviewing a Jira ticket for development readiness.

Ticket: ${ctx.ticketKey}
Summary: ${ctx.ticketSummary}
Description: ${ctx.description}
Acceptance Criteria: ${ctx.acceptanceCriteria ?? "(none provided)"}

<context>
${ctx.contextBlock}
</context>

Deterministic readiness analysis:
${ctx.deterministicResult ?? "{}"}

Your task: Review the ticket and deterministic analysis above. Identify ANY additional missing items or clarification questions that the deterministic analysis may have missed, referencing specific context above.

Rules:
- You MUST NOT change the readiness_status if it is "blocked"
- You MUST NOT reduce readiness_score
- Only add items you are confident about based on the provided context
- Each clarification question must include a justification citing specific context

Respond with JSON matching this exact schema:
{
  "additional_missing_items": [
    { "dimension": string, "severity": "high"|"medium"|"low", "reason": string, "source": "llm" }
  ],
  "additional_questions_for_pm": [
    { "question": string, "justification": string }
  ],
  "additional_questions_for_engineer": [
    { "question": string, "justification": string }
  ],
  "additional_questions_for_qa": [
    { "question": string, "justification": string }
  ]
}`;
}
/**
 * Prompt for grounding the solution plan with code context.
 * Returns JSON matching GroundedPlanOutput schema.
 */
export function groundPlanPrompt(ctx) {
    const fileSection = ctx.fileContents
        ? Object.entries(ctx.fileContents)
            .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
            .join("\n\n")
        : "(no file contents available)";
    return `You are an expert software engineer providing grounding for a development plan.

Ticket: ${ctx.ticketKey}
Summary: ${ctx.ticketSummary}

Candidate components and files:
${ctx.candidateComponents ?? "{}"}

<context>
${ctx.contextBlock}
</context>

Relevant source files:
${fileSection}

Your task: For each candidate component and file, write a concise "why" justification (1–2 sentences) explaining why it is relevant to this ticket. Reference specific code patterns, function names, or context from the files above.

Respond with JSON matching this exact schema:
{
  "component_justifications": [
    { "name": string, "why": string }
  ],
  "file_justifications": [
    { "path": string, "reason": string }
  ]
}`;
}
