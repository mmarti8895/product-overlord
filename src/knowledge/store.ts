/**
 * KBStore — LanceDB-backed vector store for knowledge base chunks.
 * Partitioned by project_key. Zero external infrastructure required.
 */

import { randomUUID } from "crypto";
import type { KBChunk, KBSource, RetrievedChunk } from "./types.js";

const TABLE_NAME = "kb_chunks";
const SOURCES_TABLE = "kb_sources";

// We lazy-import lancedb to avoid import errors when not installed
// and to keep the module loadable in test environments.
async function getLanceDB() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await import("@lancedb/lancedb")) as any;
}

export class KBStore {
  private readonly storePath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any | null = null;

  constructor(storePath: string) {
    this.storePath = storePath;
  }

  private async getDb() {
    if (!this.db) {
      const lancedb = await getLanceDB();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }

  /** Ingest pre-embedded chunks into the store. */
  async ingest(source: KBSource, chunks: KBChunk[]): Promise<void> {
    const db = await this.getDb();
    const rows = chunks.map((c) => ({
      chunk_id: c.chunk_id,
      source_id: c.source_id,
      source_type: c.source_type,
      project_key: c.project_key,
      text: c.text,
      chunk_index: c.chunk_index,
      file_path: c.file_path ?? null,
      url: c.url ?? null,
      vector: c.vector ?? [],
    }));

    const tableNames: string[] = await db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      await table.add(rows);
    } else {
      await db.createTable(TABLE_NAME, rows);
    }

    // Persist source metadata
    const sourceRow = {
      source_id: source.source_id,
      project_key: source.project_key,
      source_type: source.source_type,
      format: source.format,
      name: source.name,
      origin: source.origin,
      chunk_count: source.chunk_count,
      indexed_at: source.indexed_at,
      size_bytes: source.size_bytes,
    };
    if (tableNames.includes(SOURCES_TABLE)) {
      const tbl = await db.openTable(SOURCES_TABLE);
      await tbl.add([sourceRow]);
    } else {
      await db.createTable(SOURCES_TABLE, [sourceRow]);
    }
  }

  /** ANN search for top-K chunks matching the query vector, filtered by project_key. */
  async search(
    queryVector: number[],
    projectKey: string,
    topK: number = 5
  ): Promise<RetrievedChunk[]> {
    const db = await this.getDb();
    const tableNames: string[] = await db.tableNames();
    if (!tableNames.includes(TABLE_NAME)) return [];

    const table = await db.openTable(TABLE_NAME);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = await table
      .search(queryVector)
      .where(`project_key = '${projectKey}'`)
      .limit(topK)
      .execute();

    return results.map((r) => ({
      source_id: r.source_id,
      source_type: r.source_type,
      file_path: r.file_path ?? undefined,
      url: r.url ?? undefined,
      text: r.text,
      score: r._distance !== undefined ? Math.max(0, 1 - r._distance) : 0,
    }));
  }

  /** List all sources for a project. */
  async listSources(projectKey: string): Promise<KBSource[]> {
    const db = await this.getDb();
    const tableNames: string[] = await db.tableNames();
    if (!tableNames.includes(SOURCES_TABLE)) return [];

    const table = await db.openTable(SOURCES_TABLE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await table.filter(`project_key = '${projectKey}'`).execute();
    return rows as KBSource[];
  }

  /** Delete all chunks and source record for a given source_id. */
  async deleteSource(sourceId: string): Promise<void> {
    const db = await this.getDb();
    const tableNames: string[] = await db.tableNames();
    if (tableNames.includes(TABLE_NAME)) {
      const table = await db.openTable(TABLE_NAME);
      await table.delete(`source_id = '${sourceId}'`);
    }
    if (tableNames.includes(SOURCES_TABLE)) {
      const table = await db.openTable(SOURCES_TABLE);
      await table.delete(`source_id = '${sourceId}'`);
    }
  }

  /** Approximate total size in bytes of all stored data. */
  async sizeBytes(): Promise<number> {
    const db = await this.getDb();
    const tableNames: string[] = await db.tableNames();
    if (!tableNames.includes(SOURCES_TABLE)) return 0;

    const table = await db.openTable(SOURCES_TABLE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await table.query().execute();
    return rows.reduce((sum: number, r: { size_bytes?: number }) => sum + (r.size_bytes ?? 0), 0);
  }
}

export function makeSourceId(): string {
  return randomUUID();
}
