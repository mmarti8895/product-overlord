/**
 * OKRStore — LanceDB-backed persistence for OKRs and outcome snapshots (task 2.2)
 */

import { randomUUID } from "crypto";
import type { OKR, KeyResult, MetricEvent, OutcomeSnapshot } from "../types/outcomes.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB(): Promise<any> {
  return (await import("@lancedb/lancedb")) as any;
}

export class OKRStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any | null = null;

  constructor(private readonly storePath: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDb(): Promise<any> {
    if (!this.db) {
      const lancedb = await getLanceDB();
      this.db = await lancedb.connect(this.storePath);
    }
    return this.db;
  }

  // ── Generic helpers ───────────────────────────────────────────────────────

  private async all<T>(table: string): Promise<T[]> {
    try {
      const db = await this.getDb();
      const names: string[] = await db.tableNames();
      if (!names.includes(table)) return [];
      const t = await db.openTable(table);
      return (await t.query().toArray()) as T[];
    } catch { return []; }
  }

  private async insert<T>(table: string, rows: T[]): Promise<void> {
    if (!rows.length) return;
    const db = await this.getDb();
    const names: string[] = await db.tableNames();
    if (!names.includes(table)) {
      await db.createTable(table, rows);
    } else {
      const t = await db.openTable(table);
      await t.add(rows);
    }
  }

  private async remove(table: string, where: string): Promise<void> {
    try {
      const db = await this.getDb();
      const t = await db.openTable(table);
      await t.delete(where);
    } catch (err) {
      logger.error(`OKRStore: delete failed on ${table}`, { err: String(err) });
    }
  }

  // ── OKRs ─────────────────────────────────────────────────────────────────

  async listOKRs(projectKey: string): Promise<OKR[]> {
    const all = await this.all<OKR>("okrs");
    return all.filter((o) => o.project_key === projectKey);
  }

  async getOKR(id: string): Promise<OKR | null> {
    const all = await this.all<OKR>("okrs");
    return all.find((o) => o.id === id) ?? null;
  }

  async createOKR(input: Omit<OKR, "id" | "created_at">): Promise<OKR> {
    const now = new Date().toISOString();
    const okr: OKR = { id: randomUUID(), created_at: now, ...input };
    await this.insert("okrs", [okr]);
    return okr;
  }

  async linkEpicToOKR(okrId: string, epicKey: string): Promise<OKR> {
    const okr = await this.getOKR(okrId);
    if (!okr) throw new Error(`OKR ${okrId} not found`);
    if (okr.epic_keys.includes(epicKey)) return okr;
    const updated: OKR = { ...okr, epic_keys: [...okr.epic_keys, epicKey] };
    await this.remove("okrs", `id = '${okrId}'`);
    await this.insert("okrs", [updated]);
    return updated;
  }

  async updateKeyResult(okrId: string, krId: string, current: number): Promise<OKR> {
    const okr = await this.getOKR(okrId);
    if (!okr) throw new Error(`OKR ${okrId} not found`);
    const updated: OKR = {
      ...okr,
      key_results: okr.key_results.map((kr) =>
        kr.id === krId ? { ...kr, current, updated_at: new Date().toISOString() } : kr,
      ),
    };
    await this.remove("okrs", `id = '${okrId}'`);
    await this.insert("okrs", [updated]);
    return updated;
  }

  // ── Metric Events ─────────────────────────────────────────────────────────

  async appendMetricEvent(event: Omit<MetricEvent, "id">): Promise<MetricEvent> {
    const full: MetricEvent = { id: randomUUID(), ...event };
    await this.insert("metric_events", [full]);
    return full;
  }

  async getMetricEvents(okrId: string): Promise<MetricEvent[]> {
    const all = await this.all<MetricEvent>("metric_events");
    return all.filter((e) => e.okr_id === okrId);
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  async latestSnapshot(projectKey: string): Promise<OutcomeSnapshot | null> {
    const all = await this.all<OutcomeSnapshot>("outcome_snapshots");
    const filtered = all.filter((s) => s.project_key === projectKey);
    if (!filtered.length) return null;
    return filtered.reduce((latest, s) => (s.generated_at > latest.generated_at ? s : latest));
  }

  async saveSnapshot(snapshot: OutcomeSnapshot): Promise<void> {
    await this.insert("outcome_snapshots", [snapshot]);
  }

  async patchSnapshotNotes(id: string, notes: string): Promise<OutcomeSnapshot | null> {
    const all = await this.all<OutcomeSnapshot>("outcome_snapshots");
    const snap = all.find((s) => s.id === id);
    if (!snap) return null;
    const updated = { ...snap, notes };
    await this.remove("outcome_snapshots", `id = '${id}'`);
    await this.insert("outcome_snapshots", [updated]);
    return updated;
  }

  // ── Key result helper ─────────────────────────────────────────────────────

  newKeyResult(input: Omit<KeyResult, "id" | "updated_at">): KeyResult {
    return { id: randomUUID(), updated_at: new Date().toISOString(), ...input };
  }
}
