/**
 * TriageQueue — persists FeedbackDocuments, FeedbackThemes, and OpportunityCandidates
 * to LanceDB and handles promote → Jira / dismiss flows. (task 2.8)
 */
import type { FeedbackDocument, FeedbackTheme, OpportunityCandidate } from "../types/discovery.js";
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
export declare class TriageQueue {
    private readonly storePath;
    private readonly jira;
    private db;
    constructor(storePath: string, jira: JiraAgileRestAdapter);
    private getDb;
    upsertDocuments(docs: FeedbackDocument[]): Promise<void>;
    getDocuments(): Promise<FeedbackDocument[]>;
    upsertThemes(themes: FeedbackTheme[]): Promise<void>;
    getThemes(): Promise<FeedbackTheme[]>;
    getTheme(id: string): Promise<FeedbackTheme | null>;
    upsertCandidates(candidates: OpportunityCandidate[]): Promise<void>;
    getCandidates(): Promise<OpportunityCandidate[]>;
    getCandidate(id: string): Promise<OpportunityCandidate | null>;
    promote(id: string, opts: {
        project_key: string;
        title: string;
        description: string;
    }): Promise<OpportunityCandidate>;
    dismiss(id: string, reason: string): Promise<OpportunityCandidate>;
    private updateCandidate;
    getLatestDocumentDate(): Promise<string | null>;
    ingestRaw(items: {
        source: FeedbackDocument["source"];
        source_id: string;
        text: string;
        created_at: number;
        customer_segment: string | null;
        tags: string[];
    }[]): Promise<FeedbackDocument[]>;
}
