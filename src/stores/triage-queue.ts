/**
 * TriageQueue — persists FeedbackDocuments, FeedbackThemes, and OpportunityCandidates
 * to LanceDB and handles promote → Jira / dismiss flows. (task 2.8)
 */

import { randomUUID } from "crypto";
import type { FeedbackDocument, FeedbackTheme, OpportunityCandidate } from "../types/discovery.js";
import type { JiraAgileRestAdapter } from "../adapters/jira-agile-rest.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB(): Promise<any> {
  return (await import("@lancedb/lancedb")) as any;
}

export class TriageQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any | null = null;

  constructor(
    private readonly storePath: string,
    private readonly jira: JiraAgileRestAdapter,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDb(): Promise<any> {
    if (!this.db) {
      const lancedb = await getLanceDB();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }

  // ── Documents ────────────────────────────────────────────────────────────

  async upsertDocuments(docs: FeedbackDocument[]): Promise<void> {
    if (!docs.length) return;
    const db = await this.getDb();
    const names: string[] = await db.tableNames();
    if (!names.includes("feedback_documents")) {
      await db.createTable("feedback_documents", docs);
    } else {
      const t = await db.openTable("feedback_documents");
      await t.add(docs);
    }
  }

  async getDocuments(): Promise<FeedbackDocument[]> {
    try {
      const db = await this.getDb();
      const names: string[] = await db.tableNames();
      if (!names.includes("feedback_documents")) return [];
      const t = await db.openTable("feedback_documents");
      return (await t.query().toArray()) as FeedbackDocument[];
    } catch { return []; }
  }

  // ── Themes ───────────────────────────────────────────────────────────────

  async upsertThemes(themes: FeedbackTheme[]): Promise<void> {
    if (!themes.length) return;
    const db = await this.getDb();
    const names: string[] = await db.tableNames();
    if (!names.includes("feedback_themes")) {
      await db.createTable("feedback_themes", themes);
    } else {
      const t = await db.openTable("feedback_themes");
      await t.add(themes);
    }
  }

  async getThemes(): Promise<FeedbackTheme[]> {
    try {
      const db = await this.getDb();
      const names: string[] = await db.tableNames();
      if (!names.includes("feedback_themes")) return [];
      const t = await db.openTable("feedback_themes");
      return (await t.query().toArray()) as FeedbackTheme[];
    } catch { return []; }
  }

  async getTheme(id: string): Promise<FeedbackTheme | null> {
    const all = await this.getThemes();
    return all.find((t) => t.id === id) ?? null;
  }

  // ── Candidates ───────────────────────────────────────────────────────────

  async upsertCandidates(candidates: OpportunityCandidate[]): Promise<void> {
    if (!candidates.length) return;
    const db = await this.getDb();
    const names: string[] = await db.tableNames();
    if (!names.includes("opportunity_candidates")) {
      await db.createTable("opportunity_candidates", candidates);
    } else {
      const t = await db.openTable("opportunity_candidates");
      await t.add(candidates);
    }
  }

  async getCandidates(): Promise<OpportunityCandidate[]> {
    try {
      const db = await this.getDb();
      const names: string[] = await db.tableNames();
      if (!names.includes("opportunity_candidates")) return [];
      const t = await db.openTable("opportunity_candidates");
      return (await t.query().toArray()) as OpportunityCandidate[];
    } catch { return []; }
  }

  async getCandidate(id: string): Promise<OpportunityCandidate | null> {
    const all = await this.getCandidates();
    return all.find((c) => c.id === id) ?? null;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async promote(
    id: string,
    opts: { project_key: string; title: string; description: string },
  ): Promise<OpportunityCandidate> {
    const candidate = await this.getCandidate(id);
    if (!candidate) throw new Error(`Candidate ${id} not found`);
    if (candidate.status !== "pending") throw new Error(`Candidate ${id} is not pending`);

    // Create Jira ticket
    const ticketKey = await this.jira.createStory(opts.project_key, {
      summary: opts.title,
      description: opts.description,
      labels: ["product-discovery"],
    });

    const updated: OpportunityCandidate = {
      ...candidate,
      status: "promoted",
      promoted_ticket_key: ticketKey,
      updated_at: new Date().toISOString(),
    };
    await this.updateCandidate(updated);
    logger.info("discovery: candidate promoted", { id, ticketKey });
    return updated;
  }

  async dismiss(id: string, reason: string): Promise<OpportunityCandidate> {
    const candidate = await this.getCandidate(id);
    if (!candidate) throw new Error(`Candidate ${id} not found`);
    const updated: OpportunityCandidate = { ...candidate, status: "dismissed", dismiss_reason: reason, updated_at: new Date().toISOString() };
    await this.updateCandidate(updated);
    return updated;
  }

  private async updateCandidate(updated: OpportunityCandidate): Promise<void> {
    try {
      const db = await this.getDb();
      const t = await db.openTable("opportunity_candidates");
      await t.delete(`id = '${updated.id}'`);
      await t.add([updated]);
    } catch (err) {
      logger.error("TriageQueue: failed to update candidate", { err: String(err) });
    }
  }

  // ── Latest ingest cursor ─────────────────────────────────────────────────

  async getLatestDocumentDate(): Promise<string | null> {
    const docs = await this.getDocuments();
    if (!docs.length) return null;
    return docs.reduce((latest, d) => (d.created_at > latest ? d.created_at : latest), docs[0].created_at);
  }

  // ── Ingest from raw items ────────────────────────────────────────────────

  async ingestRaw(items: { source: FeedbackDocument["source"]; source_id: string; text: string; created_at: number; customer_segment: string | null; tags: string[] }[]): Promise<FeedbackDocument[]> {
    const existing = new Set((await this.getDocuments()).map((d) => `${d.source}:${d.source_id}`));
    const docs: FeedbackDocument[] = items
      .filter((i) => !existing.has(`${i.source}:${i.source_id}`))
      .map((i) => ({
        id: randomUUID(),
        source: i.source,
        source_id: i.source_id,
        text: i.text,
        sentiment_score: 0, // scored by ThemeClusterer pipeline
        created_at: new Date(i.created_at).toISOString(),
        customer_segment: i.customer_segment,
        tags: i.tags,
        theme_id: null,
      }));
    await this.upsertDocuments(docs);
    return docs;
  }
}
