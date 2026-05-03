/**
 * PortfolioStore — LanceDB persistence for portfolios and snapshots (task 2.2)
 */
import type { Portfolio, PortfolioSnapshot } from "../types/portfolio.js";
export declare class PortfolioStore {
    private readonly storePath;
    private db;
    constructor(storePath: string);
    private getDb;
    private all;
    private insert;
    private remove;
    listPortfolios(): Promise<Portfolio[]>;
    getPortfolio(id: string): Promise<Portfolio | null>;
    createPortfolio(input: Omit<Portfolio, "id" | "created_at">): Promise<Portfolio>;
    addProjectToPortfolio(portfolioId: string, projectKey: string): Promise<Portfolio>;
    latestSnapshot(portfolioId: string): Promise<PortfolioSnapshot | null>;
    saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>;
}
