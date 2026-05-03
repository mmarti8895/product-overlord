/**
 * Evidence Store
 *
 * Persists an evidence bundle for every analysis run.
 * Each bundle is keyed by a UUID run_id and retained for ≥ 90 days.
 *
 * Storage in this implementation is an in-process Map (sufficient for the
 * current stage). The interface is designed so a persistent backend
 * (SQLite, Redis, file-system) can be swapped in without changing callers.
 */
import { randomUUID } from "crypto";
// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds
export class EvidenceStore {
    store = new Map();
    /** Persist a new evidence bundle; returns the assigned run_id. */
    persist(bundle) {
        const run_id = randomUUID();
        const timestamp = new Date().toISOString();
        const full = {
            ...bundle,
            run_id,
            timestamp,
            _storedAt: Date.now(),
        };
        this.store.set(run_id, full);
        return full;
    }
    /** Retrieve a bundle by run_id. Returns undefined if not found or expired. */
    get(run_id) {
        const entry = this.store.get(run_id);
        if (!entry)
            return undefined;
        if (Date.now() - entry._storedAt > RETENTION_MS) {
            this.store.delete(run_id);
            return undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _storedAt, ...bundle } = entry;
        return bundle;
    }
    /**
     * Lightweight save() for stage-2 usage — accepts a minimal payload object,
     * assigns a UUID run_id, and returns it.
     * For callers that don't have a full EvidenceBundle shape (e.g. stage-2 orchestrator).
     */
    save(payload) {
        const run_id = randomUUID();
        const timestamp = new Date().toISOString();
        const entry = { ...payload, run_id, timestamp, _storedAt: Date.now() };
        this.store.set(run_id, entry);
        return run_id;
    }
    /** Number of live (non-expired) bundles in store. */
    get size() {
        this._evict();
        return this.store.size;
    }
    /** Remove all expired entries. */
    _evict() {
        const now = Date.now();
        for (const [id, entry] of this.store) {
            if (now - entry._storedAt > RETENTION_MS) {
                this.store.delete(id);
            }
        }
    }
}
/** Singleton default store shared across the process. */
export const evidenceStore = new EvidenceStore();
