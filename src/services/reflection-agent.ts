/**
 * ReflectionAgent — uses LLM to write a sprint-retrospective-style Markdown
 * commentary on OKR progress. (task 2.7)
 */

import type { LLMAdapter } from "../llm/types.js";
import type { OKR, OKRDelta } from "../types/outcomes.js";

const REFLECTION_SCHEMA = {
  type: "object",
  properties: {
    markdown: { type: "string" },
  },
  required: ["markdown"],
} as const;

export class ReflectionAgent {
  constructor(private readonly llm: LLMAdapter) {}

  async reflect(projectKey: string, okrs: OKR[], deltas: OKRDelta[]): Promise<string> {
    const deltaLines = deltas
      .map((d) => `- ${d.description}: ${d.previous} → ${d.current} / ${d.target} (Δ${d.delta_pct > 0 ? "+" : ""}${d.delta_pct}%)`)
      .join("\n");

    const objectiveLines = okrs.map((o) => `- ${o.objective}`).join("\n");

    const prompt =
      `You are a product outcomes coach. Write a brief (≤3 paragraphs) Markdown retrospective commentary ` +
      `for project "${projectKey}" based on the following OKR progress.\n\n` +
      `Objectives:\n${objectiveLines}\n\n` +
      `Key Result deltas:\n${deltaLines || "No deltas yet."}\n\n` +
      `Be specific, highlight wins and risks, and suggest one action.`;

    const { result } = await this.llm.complete<{ markdown: string }>(prompt, REFLECTION_SCHEMA);
    return result.markdown;
  }
}
