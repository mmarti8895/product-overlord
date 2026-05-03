/**
 * KBStore — LanceDB-backed vector store for knowledge base chunks.
 * Partitioned by project_key. Zero external infrastructure required.
 */
import { randomUUID } from "crypto";
const TABLE_NAME = "kb_chunks";
const SOURCES_TABLE = "kb_sources";
// We lazy-import lancedb to avoid import errors when not installed
// and to keep the module loadable in test environments.
async function getLanceDB() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await import("@lancedb/lancedb"));
}
export class KBStore {
    storePath;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = null;
    constructor(storePath) {
        this.storePath = storePath;
    }
    async getDb() {
        if (!this.db) {
            const lancedb = await getLanceDB();
            this.db = await lancedb.connect(this.storePath);
        }
        return this.db;
    }
    /** Ingest pre-embedded chunks into the store. */
    async ingest(source, chunks) {
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
        const tableNames = await db.tableNames();
        if (tableNames.includes(TABLE_NAME)) {
            const table = await db.openTable(TABLE_NAME);
            await table.add(rows);
        }
        else {
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
        }
        else {
            await db.createTable(SOURCES_TABLE, [sourceRow]);
        }
    }
    /** ANN search for top-K chunks matching the query vector, filtered by project_key. */
    async search(queryVector, projectKey, topK = 5) {
        const db = await this.getDb();
        const tableNames = await db.tableNames();
        if (!tableNames.includes(TABLE_NAME))
            return [];
        const table = await db.openTable(TABLE_NAME);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = await table
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
    async listSources(projectKey) {
        const db = await this.getDb();
        const tableNames = await db.tableNames();
        if (!tableNames.includes(SOURCES_TABLE))
            return [];
        const table = await db.openTable(SOURCES_TABLE);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await table.filter(`project_key = '${projectKey}'`).execute();
        return rows;
    }
    /** Delete all chunks and source record for a given source_id. */
    async deleteSource(sourceId) {
        const db = await this.getDb();
        const tableNames = await db.tableNames();
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
    async sizeBytes() {
        const db = await this.getDb();
        const tableNames = await db.tableNames();
        if (!tableNames.includes(SOURCES_TABLE))
            return 0;
        const table = await db.openTable(SOURCES_TABLE);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await table.query().execute();
        return rows.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0);
    }
}
export function makeSourceId() {
    return randomUUID();
}
