/**
 * PortfolioStore — LanceDB persistence for portfolios and snapshots (task 2.2)
 */

import { randomUUID } from "crypto";
import type { Portfolio, PortfolioSnapshot } from "../types/portfolio.js";
import { logger } from "../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLanceDB(): Promise<any> {
  return (await import("@lancedb/lancedb")) as any;
}

export class PortfolioStore {
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
    } catch (e) {
      logger.error(`PortfolioStore.remove failed on ${table}`, { err: String(e) });
    }
  }

  // ── Portfolios ────────────────────────────────────────────────────────────

  async listPortfolios(): Promise<Portfolio[]> {
    return this.all<Portfolio>("portfolios");
  }

  async getPortfolio(id: string): Promise<Portfolio | null> {
    const all = await this.all<Portfolio>("portfolios");
    return all.find((p) => p.id === id) ?? null;
  }

  async createPortfolio(input: Omit<Portfolio, "id" | "created_at">): Promise<Portfolio> {
    const portfolio: Portfolio = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
    await this.insert("portfolios", [portfolio]);
    return portfolio;
  }

  async addProjectToPortfolio(portfolioId: string, projectKey: string): Promise<Portfolio> {
    const p = await this.getPortfolio(portfolioId);
    if (!p) throw new Error(`Portfolio ${portfolioId} not found`);
    if (p.project_keys.includes(projectKey)) return p;
    const updated: Portfolio = { ...p, project_keys: [...p.project_keys, projectKey] };
    await this.remove("portfolios", `id = '${portfolioId}'`);
    await this.insert("portfolios", [updated]);
    return updated;
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

  async latestSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null> {
    const all = await this.all<PortfolioSnapshot>("portfolio_snapshots");
    const filtered = all.filter((s) => s.portfolio_id === portfolioId);
    if (!filtered.length) return null;
    return filtered.reduce((a, b) => (a.generated_at > b.generated_at ? a : b));
  }

  async saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
    await this.insert("portfolio_snapshots", [snapshot]);
  }
}
