/**
 * OKRStore — LanceDB-backed persistence for OKRs and outcome snapshots (task 2.2)
 */
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB() {
    return (await import("@lancedb/lancedb"));
}
export class OKRStore {
    storePath;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db = null;
    constructor(storePath) {
        this.storePath = storePath;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getDb() {
        if (!this.db) {
            const lancedb = await getLanceDB();
            this.db = await lancedb.connect(this.storePath);
        }
        return this.db;
    }
    // ── Generic helpers ───────────────────────────────────────────────────────
    async all(table) {
        try {
            const db = await this.getDb();
            const names = await db.tableNames();
            if (!names.includes(table))
                return [];
            const t = await db.openTable(table);
            return (await t.query().toArray());
        }
        catch {
            return [];
        }
    }
    async insert(table, rows) {
        if (!rows.length)
            return;
        const db = await this.getDb();
        const names = await db.tableNames();
        if (!names.includes(table)) {
            await db.createTable(table, rows);
        }
        else {
            const t = await db.openTable(table);
            await t.add(rows);
        }
    }
    async remove(table, where) {
        try {
            const db = await this.getDb();
            const t = await db.openTable(table);
            await t.delete(where);
        }
        catch (err) {
            logger.error(`OKRStore: delete failed on ${table}`, { err: String(err) });
        }
    }
    // ── OKRs ─────────────────────────────────────────────────────────────────
    async listOKRs(projectKey) {
        const all = await this.all("okrs");
        return all.filter((o) => o.project_key === projectKey);
    }
    async getOKR(id) {
        const all = await this.all("okrs");
        return all.find((o) => o.id === id) ?? null;
    }
    async createOKR(input) {
        const now = new Date().toISOString();
        const okr = { id: randomUUID(), created_at: now, ...input };
        await this.insert("okrs", [okr]);
        return okr;
    }
    async linkEpicToOKR(okrId, epicKey) {
        const okr = await this.getOKR(okrId);
        if (!okr)
            throw new Error(`OKR ${okrId} not found`);
        if (okr.epic_keys.includes(epicKey))
            return okr;
        const updated = { ...okr, epic_keys: [...okr.epic_keys, epicKey] };
        await this.remove("okrs", `id = '${okrId}'`);
        await this.insert("okrs", [updated]);
        return updated;
    }
    async updateKeyResult(okrId, krId, current) {
        const okr = await this.getOKR(okrId);
        if (!okr)
            throw new Error(`OKR ${okrId} not found`);
        const updated = {
            ...okr,
            key_results: okr.key_results.map((kr) => kr.id === krId ? { ...kr, current, updated_at: new Date().toISOString() } : kr),
        };
        await this.remove("okrs", `id = '${okrId}'`);
        await this.insert("okrs", [updated]);
        return updated;
    }
    // ── Metric Events ─────────────────────────────────────────────────────────
    async appendMetricEvent(event) {
        const full = { id: randomUUID(), ...event };
        await this.insert("metric_events", [full]);
        return full;
    }
    async getMetricEvents(okrId) {
        const all = await this.all("metric_events");
        return all.filter((e) => e.okr_id === okrId);
    }
    // ── Snapshots ─────────────────────────────────────────────────────────────
    async latestSnapshot(projectKey) {
        const all = await this.all("outcome_snapshots");
        const filtered = all.filter((s) => s.project_key === projectKey);
        if (!filtered.length)
            return null;
        return filtered.reduce((latest, s) => (s.generated_at > latest.generated_at ? s : latest));
    }
    async saveSnapshot(snapshot) {
        await this.insert("outcome_snapshots", [snapshot]);
    }
    async patchSnapshotNotes(id, notes) {
        const all = await this.all("outcome_snapshots");
        const snap = all.find((s) => s.id === id);
        if (!snap)
            return null;
        const updated = { ...snap, notes };
        await this.remove("outcome_snapshots", `id = '${id}'`);
        await this.insert("outcome_snapshots", [updated]);
        return updated;
    }
    // ── Key result helper ─────────────────────────────────────────────────────
    newKeyResult(input) {
        return { id: randomUUID(), updated_at: new Date().toISOString(), ...input };
    }
}
