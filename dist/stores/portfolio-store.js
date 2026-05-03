/**
 * PortfolioStore — LanceDB persistence for portfolios and snapshots (task 2.2)
 */
import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB() {
    return (await import("@lancedb/lancedb"));
}
export class PortfolioStore {
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
        catch (e) {
            logger.error(`PortfolioStore.remove failed on ${table}`, { err: String(e) });
        }
    }
    // ── Portfolios ────────────────────────────────────────────────────────────
    async listPortfolios() {
        return this.all("portfolios");
    }
    async getPortfolio(id) {
        const all = await this.all("portfolios");
        return all.find((p) => p.id === id) ?? null;
    }
    async createPortfolio(input) {
        const portfolio = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
        await this.insert("portfolios", [portfolio]);
        return portfolio;
    }
    async addProjectToPortfolio(portfolioId, projectKey) {
        const p = await this.getPortfolio(portfolioId);
        if (!p)
            throw new Error(`Portfolio ${portfolioId} not found`);
        if (p.project_keys.includes(projectKey))
            return p;
        const updated = { ...p, project_keys: [...p.project_keys, projectKey] };
        await this.remove("portfolios", `id = '${portfolioId}'`);
        await this.insert("portfolios", [updated]);
        return updated;
    }
    // ── Snapshots ─────────────────────────────────────────────────────────────
    async latestSnapshot(portfolioId) {
        const all = await this.all("portfolio_snapshots");
        const filtered = all.filter((s) => s.portfolio_id === portfolioId);
        if (!filtered.length)
            return null;
        return filtered.reduce((a, b) => (a.generated_at > b.generated_at ? a : b));
    }
    async saveSnapshot(snapshot) {
        await this.insert("portfolio_snapshots", [snapshot]);
    }
}
