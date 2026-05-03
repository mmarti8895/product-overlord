/**
 * PRDWriter — generates a structured PRD draft using RAG + LLM (task 2.3)
 */
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
                    body: { type: "string" },
                },
                required: ["heading", "body"],
            },
        },
    },
    required: ["title", "sections"],
};
export class PRDWriter {
    store;
    kb;
    llm;
    constructor(store, kb, llm) {
        this.store = store;
        this.kb = kb;
        this.llm = llm;
    }
    async generate(input) {
        // ── RAG retrieval ────────────────────────────────────────────────────
        const chunks = await retrieveChunks(input.context, input.project_key, this.kb, this.llm, 6);
        const ragSources = chunks.map((c) => ({
            chunk_id: c.source_id,
            source_url: c.url ?? c.file_path ?? "",
            excerpt: c.text.slice(0, 200),
            score: c.score,
        }));
        const contextBlock = chunks.map((c, i) => `[${i + 1}] ${c.text.slice(0, 400)}`).join("\n\n");
        // ── LLM generation ───────────────────────────────────────────────────
        const typeLabel = { prd: "Product Requirements Document", rfc: "RFC", brief: "Product Brief" }[input.document_type];
        const prompt = `You are a senior product manager. Generate a well-structured ${typeLabel} in Markdown.\n\n` +
            `Project: ${input.project_key}\n` +
            (input.epic_key ? `Epic: ${input.epic_key}\n` : "") +
            `Context provided by user:\n${input.context}\n\n` +
            (contextBlock ? `Knowledge base context:\n${contextBlock}\n\n` : "") +
            `Return a JSON with: title (string) and sections (array of {heading, body}).`;
        let title = `${typeLabel} — ${input.project_key}`;
        let sections = [
            { heading: "Overview", body: input.context },
            { heading: "Goals", body: "_To be defined_" },
            { heading: "Requirements", body: "_To be defined_" },
        ];
        try {
            const { result } = await this.llm.complete(prompt, PRD_SCHEMA);
            title = result.title;
            sections = result.sections;
        }
        catch { /* use fallback skeleton */ }
        const content = {
            sections: sections.map((s, i) => ({ id: randomUUID(), heading: s.heading, body: s.body, order: i })),
            rag_sources: ragSources,
        };
        return this.store.saveDraft({
            project_key: input.project_key,
            epic_key: input.epic_key,
            document_type: input.document_type,
            title,
            content,
            status: "draft",
            confluence_url: null,
        });
    }
}
