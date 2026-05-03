/**
 * PRDWriter — generates a structured PRD draft using RAG + LLM (task 2.3)
 */
import type { DraftStore } from "../stores/draft-store.js";
import type { KBStore } from "../knowledge/store.js";
import type { LLMAdapter } from "../llm/types.js";
import type { PRDDraft, DocumentType } from "../types/prd.js";
interface GenerateInput {
    project_key: string;
    epic_key: string | null;
    document_type: DocumentType;
    context: string;
}
export declare class PRDWriter {
    private readonly store;
    private readonly kb;
    private readonly llm;
    constructor(store: DraftStore, kb: KBStore, llm: LLMAdapter);
    generate(input: GenerateInput): Promise<PRDDraft>;
}
export {};
