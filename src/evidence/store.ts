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
import type { AdapterTrace, CanonicalTicket, ReadinessResult } from "../types/index.js";
import type { LLMTrace } from "../llm/types.js";
import type { RetrievedChunk } from "../knowledge/types.js";

// ---------------------------------------------------------------------------
// Evidence bundle schema
// ---------------------------------------------------------------------------

export interface EvidenceBundle {
  /** Unique UUID for this analysis run */
  run_id: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Human-readable trigger (e.g. "board_sweep", "direct_key:ABC-1") */
  trigger: string;
  /** All adapter traces emitted during this run */
  adapter_traces: AdapterTrace[];
  /** Normalised ticket as fed to the scorer */
  canonical_ticket: CanonicalTicket;
  /** Inputs passed to the scorer */
  scorer_input: {
    profile_id: string;
    profile_source: "project" | "default";
  };
  /** Full scorer output */
  scorer_output: ReadinessResult;
  /** Verdict shorthand (mirrors scorer_output.readiness_status) */
  verdict: ReadinessResult["readiness_status"];
  /** ID of the comment draft produced (if any) */
  comment_draft_id: string | null;
  /** LLM call traces emitted during this run (empty when degraded) */
  llm_traces: LLMTrace[];
  /** KB chunks retrieved for RAG context during this run */
  retrieved_chunks: RetrievedChunk[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

export class EvidenceStore {
  private readonly store = new Map<string, EvidenceBundle & { _storedAt: number }>();

  /** Persist a new evidence bundle; returns the assigned run_id. */
  persist(
    bundle: Omit<EvidenceBundle, "run_id" | "timestamp">
  ): EvidenceBundle {
    const run_id = randomUUID();
    const timestamp = new Date().toISOString();
    const full: EvidenceBundle & { _storedAt: number } = {
      ...bundle,
      run_id,
      timestamp,
      _storedAt: Date.now(),
    };
    this.store.set(run_id, full);
    return full;
  }

  /** Retrieve a bundle by run_id. Returns undefined if not found or expired. */
  get(run_id: string): EvidenceBundle | undefined {
    const entry = this.store.get(run_id);
    if (!entry) return undefined;
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
  save(payload: { ticket_key: string; [key: string]: unknown }): string {
    const run_id = randomUUID();
    const timestamp = new Date().toISOString();
    const entry = { ...payload, run_id, timestamp, _storedAt: Date.now() } as unknown as EvidenceBundle & { _storedAt: number };
    this.store.set(run_id, entry);
    return run_id;
  }

  /** Number of live (non-expired) bundles in store. */
  get size(): number {
    this._evict();
    return this.store.size;
  }

  /** Remove all expired entries. */
  private _evict(): void {
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
