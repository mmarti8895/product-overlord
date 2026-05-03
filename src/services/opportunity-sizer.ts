/**
 * OpportunitySizer — converts a FeedbackTheme into an OpportunityCandidate (task 2.7)
 *
 * Uses LLM to estimate reach and impact, falls back to heuristics.
 */

import { randomUUID } from "crypto";
import type { LLMAdapter } from "../llm/types.js";
import type { FeedbackTheme, OpportunityCandidate } from "../types/discovery.js";

const SIZING_SCHEMA = {
  type: "object",
  properties: {
    title:             { type: "string" },
    problem_statement: { type: "string" },
    estimated_reach:   { type: "number" },
    estimated_impact:  { type: "number" },
  },
  required: ["title", "problem_statement", "estimated_reach", "estimated_impact"],
} as const;

export class OpportunitySizer {
  constructor(private readonly llm: LLMAdapter) {}

  async size(theme: FeedbackTheme): Promise<OpportunityCandidate> {
    const quoteSample = theme.representative_quotes.slice(0, 3).join(" | ");
    const prompt =
      `You are a product manager. Given a feedback theme, return:\n` +
      `- title: one-line opportunity title\n` +
      `- problem_statement: 2–3 sentence problem description\n` +
      `- estimated_reach: integer number of customers affected\n` +
      `- estimated_impact: float 0–10 business impact score\n\n` +
      `Theme: ${theme.name}\nFrequency: ${theme.frequency} signals\nAvg sentiment: ${theme.avg_sentiment}\nSample quotes: ${quoteSample}`;

    let title = theme.name;
    let problem_statement = `Customers are reporting issues related to: ${theme.name}`;
    let estimated_reach = theme.frequency;
    let estimated_impact = Math.min(10, theme.frequency * 0.5);

    try {
      const { result } = await this.llm.complete<{
        title: string;
        problem_statement: string;
        estimated_reach: number;
        estimated_impact: number;
      }>(prompt, SIZING_SCHEMA);
      title            = result.title;
      problem_statement = result.problem_statement;
      estimated_reach  = result.estimated_reach;
      estimated_impact = result.estimated_impact;
    } catch { /* use heuristics above */ }

    return {
      id:                  randomUUID(),
      theme_id:            theme.id,
      title,
      problem_statement,
      estimated_reach:     Math.round(estimated_reach),
      estimated_impact:    parseFloat(estimated_impact.toFixed(2)),
      status:              "pending",
      promoted_ticket_key: null,
      dismiss_reason:      null,
      created_at:          new Date().toISOString(),
      updated_at:          new Date().toISOString(),
    };
  }
}
