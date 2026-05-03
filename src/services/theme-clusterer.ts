/**
 * ThemeClusterer — groups FeedbackDocuments into FeedbackThemes (task 2.6)
 *
 * Algorithm:
 *  1. Embed all document texts via LLM.
 *  2. k-means (cosine) into up to K clusters.
 *  3. LLM call to name each cluster and pick representative quotes.
 */

import { randomUUID } from "crypto";
import type { LLMAdapter } from "../llm/types.js";
import type { FeedbackDocument, FeedbackTheme } from "../types/discovery.js";

const THEME_NAMING_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    representative_quotes: { type: "array", items: { type: "string" }, maxItems: 3 },
  },
  required: ["name", "representative_quotes"],
} as const;

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function centroid(vecs: number[][]): number[] {
  const dim = vecs[0].length;
  const c = new Array<number>(dim).fill(0);
  for (const v of vecs) for (let i = 0; i < dim; i++) c[i] += v[i] / vecs.length;
  return c;
}

export class ThemeClusterer {
  constructor(private readonly llm: LLMAdapter) {}

  async cluster(docs: FeedbackDocument[], k = 8): Promise<FeedbackTheme[]> {
    if (docs.length === 0) return [];

    // ── 1. Embed ──────────────────────────────────────────────────────────
    const texts = docs.map((d) => d.text.slice(0, 512));
    let vectors: number[][];
    try {
      ({ vectors } = await this.llm.embed(texts));
    } catch {
      // fallback: single theme containing everything
      return [this.buildTheme(docs, "General Feedback", [], new Date().toISOString())];
    }

    const n = docs.length;
    const actualK = Math.min(k, n);

    // ── 2. k-means (cosine) ───────────────────────────────────────────────
    // Init: spread seeds by picking maximally distant vectors
    const seeds: number[] = [0];
    while (seeds.length < actualK) {
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        if (seeds.includes(i)) continue;
        const minSim = Math.min(...seeds.map((s) => cosineSim(vectors[i], vectors[s])));
        if (minSim > bestScore) { bestScore = minSim; best = i; }
      }
      seeds.push(best);
    }

    let centroids = seeds.map((s) => [...vectors[s]]);
    let assignments = new Array<number>(n).fill(0);

    for (let iter = 0; iter < 20; iter++) {
      const newAssign = vectors.map((v) => {
        let best = 0, bestSim = -Infinity;
        for (let c = 0; c < actualK; c++) {
          const sim = cosineSim(v, centroids[c]);
          if (sim > bestSim) { bestSim = sim; best = c; }
        }
        return best;
      });
      if (newAssign.every((a, i) => a === assignments[i])) break;
      assignments = newAssign;
      centroids = Array.from({ length: actualK }, (_, c) => {
        const vecs = vectors.filter((_, i) => assignments[i] === c);
        return vecs.length ? centroid(vecs) : centroids[c];
      });
    }

    // ── 3. Group docs and name clusters ──────────────────────────────────
    const groups = new Map<number, FeedbackDocument[]>();
    docs.forEach((d, i) => {
      const c = assignments[i];
      groups.set(c, [...(groups.get(c) ?? []), d]);
    });

    const now = new Date().toISOString();
    const themes: FeedbackTheme[] = [];

    for (const [, clusterDocs] of groups) {
      const sample = clusterDocs.slice(0, 6).map((d) => d.text.slice(0, 300)).join("\n---\n");
      let name = "User Feedback";
      let representative_quotes: string[] = [];

      try {
        const prompt = `You are a product analyst. Given the following customer feedback snippets, return a short theme name (≤6 words) and up to 3 representative verbatim quotes.\n\nFeedback:\n${sample}`;
        const { result } = await this.llm.complete<{ name: string; representative_quotes: string[] }>(
          prompt, THEME_NAMING_SCHEMA,
        );
        name = result.name;
        representative_quotes = result.representative_quotes;
      } catch { /* use defaults */ }

      themes.push(this.buildTheme(clusterDocs, name, representative_quotes, now));
    }

    return themes;
  }

  private buildTheme(docs: FeedbackDocument[], name: string, quotes: string[], now: string): FeedbackTheme {
    const avgSentiment = docs.reduce((s, d) => s + d.sentiment_score, 0) / (docs.length || 1);
    return {
      id: randomUUID(),
      name,
      document_ids: docs.map((d) => d.id),
      frequency: docs.length,
      avg_sentiment: parseFloat(avgSentiment.toFixed(3)),
      representative_quotes: quotes,
      created_at: now,
      updated_at: now,
    };
  }
}
