/**
 * PRDWriter — generates a structured PRD draft using RAG + LLM (task 2.3)
 */

import type { DraftStore } from "../stores/draft-store.js";
import type { KBStore } from "../knowledge/store.js";
import type { LLMAdapter } from "../llm/types.js";
import type { PRDDraft, PRDContent, RAGSource, DocumentType } from "../types/prd.js";
import { retrieveChunks } from "../rag/retrieval.js";
import { randomUUID } from "crypto";

const PRD_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          body:    { type: "string" },
        },
        required: ["heading", "body"],
      },
    },
  },
  required: ["title", "sections"],
} as const;

interface GenerateInput {
  project_key:   string;
  epic_key:      string | null;
  document_type: DocumentType;
  context:       string;   // user-provided context / brief
}

export class PRDWriter {
  constructor(
    private readonly store: DraftStore,
    private readonly kb: KBStore,
    private readonly llm: LLMAdapter,
  ) {}

  async generate(input: GenerateInput): Promise<PRDDraft> {
    // ── RAG retrieval ────────────────────────────────────────────────────
    const chunks = await retrieveChunks(input.context, input.project_key, this.kb, this.llm, 6);
    const ragSources: RAGSource[] = chunks.map((c) => ({
      chunk_id:   c.source_id,
      source_url: c.url ?? c.file_path ?? "",
      excerpt:    c.text.slice(0, 200),
      score:      c.score,
    }));
    const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.text.slice(0, 400)}`).join("\n\n");

    // ── LLM generation ───────────────────────────────────────────────────
    const typeLabel = { prd: "Product Requirements Document", rfc: "RFC", brief: "Product Brief" }[input.document_type];
    const prompt =
      `You are a senior product manager. Generate a well-structured ${typeLabel} in Markdown.\n\n` +
      `Project: ${input.project_key}\n` +
      (input.epic_key ? `Epic: ${input.epic_key}\n` : "") +
      `Context provided by user:\n${input.context}\n\n` +
      (contextBlock ? `Knowledge base context:\n${contextBlock}\n\n` : "") +
      `Return a JSON with: title (string) and sections (array of {heading, body}).`;

    let title = `${typeLabel} — ${input.project_key}`;
    let sections: { heading: string; body: string }[] = [
      { heading: "Overview", body: input.context },
      { heading: "Goals", body: "_To be defined_" },
      { heading: "Requirements", body: "_To be defined_" },
    ];

    try {
      const { result } = await this.llm.complete<{ title: string; sections: typeof sections }>(prompt, PRD_SCHEMA);
      title    = result.title;
      sections = result.sections;
    } catch { /* use fallback skeleton */ }

    const content: PRDContent = {
      sections: sections.map((s, i) => ({ id: randomUUID(), heading: s.heading, body: s.body, order: i })),
      rag_sources: ragSources,
    };

    return this.store.saveDraft({
      project_key:    input.project_key,
      epic_key:       input.epic_key,
      document_type:  input.document_type,
      title,
      content,
      status:         "draft",
      confluence_url: null,
    });
  }
}
