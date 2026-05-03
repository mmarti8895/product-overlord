/**
 * KnowledgeBase facade.
 * Orchestrates: parse → chunk → embed → store.
 * Enforces 50 MB upload limit and KB_MAX_SIZE_GB store guard.
 */
import { randomUUID } from "crypto";
import { parseBuffer } from "./parser.js";
import { chunkText } from "./chunker.js";
import { embedTexts } from "./embedder.js";
import { KBStore, makeSourceId } from "./store.js";
import { crawlUrl } from "./crawler.js";
import { FileTooLargeError, StoreFullError } from "./types.js";
const UPLOAD_LIMIT_BYTES = 50 * 1024 * 1024; // 50 MB
export class KnowledgeBase {
    store;
    adapter;
    maxSizeBytes;
    constructor(opts) {
        this.store = new KBStore(opts.storePath);
        this.adapter = opts.adapter;
        this.maxSizeBytes = opts.maxSizeGb * 1024 * 1024 * 1024;
    }
    /** Ingest a file buffer. */
    async ingestFile(buffer, filename, projectKey) {
        if (buffer.byteLength > UPLOAD_LIMIT_BYTES) {
            throw new FileTooLargeError(filename, buffer.byteLength, UPLOAD_LIMIT_BYTES);
        }
        await this._guardStoreSize(buffer.byteLength);
        const parsed = await parseBuffer(buffer, filename);
        const rawChunks = chunkText(parsed.text);
        const sourceId = makeSourceId();
        const now = new Date().toISOString();
        const texts = rawChunks.map((c) => c.text);
        const { vectors } = await embedTexts(texts, this.adapter);
        const chunks = rawChunks.map((c, i) => ({
            chunk_id: randomUUID(),
            source_id: sourceId,
            source_type: "kt",
            project_key: projectKey,
            text: c.text,
            chunk_index: c.chunk_index,
            vector: vectors[i],
        }));
        const source = {
            source_id: sourceId,
            project_key: projectKey,
            source_type: "kt",
            format: parsed.format,
            name: filename,
            origin: filename,
            chunk_count: chunks.length,
            indexed_at: now,
            size_bytes: buffer.byteLength,
        };
        await this.store.ingest(source, chunks);
        return { source_id: sourceId, chunk_count: chunks.length, size_bytes: buffer.byteLength, indexed_at: now };
    }
    /** Crawl a URL and ingest all pages. */
    async crawlUrl(url, projectKey, depth = 1) {
        const { pages } = await crawlUrl(url, depth);
        const combinedText = pages.map((p) => p.text).join("\n\n");
        const sizeBytes = Buffer.byteLength(combinedText, "utf-8");
        await this._guardStoreSize(sizeBytes);
        const rawChunks = chunkText(combinedText);
        const sourceId = makeSourceId();
        const now = new Date().toISOString();
        const texts = rawChunks.map((c) => c.text);
        const { vectors } = await embedTexts(texts, this.adapter);
        const chunks = rawChunks.map((c, i) => ({
            chunk_id: randomUUID(),
            source_id: sourceId,
            source_type: "kt",
            project_key: projectKey,
            text: c.text,
            chunk_index: c.chunk_index,
            url,
            vector: vectors[i],
        }));
        const source = {
            source_id: sourceId,
            project_key: projectKey,
            source_type: "kt",
            format: "html",
            name: url,
            origin: url,
            chunk_count: chunks.length,
            indexed_at: now,
            size_bytes: sizeBytes,
        };
        await this.store.ingest(source, chunks);
        return { source_id: sourceId, chunk_count: chunks.length, size_bytes: sizeBytes, indexed_at: now };
    }
    async listSources(projectKey) {
        return this.store.listSources(projectKey);
    }
    async deleteSource(sourceId) {
        return this.store.deleteSource(sourceId);
    }
    async sizeBytes() {
        return this.store.sizeBytes();
    }
    // Expose store for RAG retrieval
    getStore() {
        return this.store;
    }
    async _guardStoreSize(incomingBytes) {
        const current = await this.store.sizeBytes();
        if (current + incomingBytes > this.maxSizeBytes) {
            throw new StoreFullError((current + incomingBytes) / 1e9, this.maxSizeBytes / 1e9);
        }
    }
}
