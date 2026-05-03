/**
 * Portfolio API Routes (portfolio-management task 3.1)
 *
 * GET  /api/portfolio                                  — list portfolios
 * POST /api/portfolio                                  — create portfolio
 * GET  /api/portfolio/:id                              — get portfolio
 * POST /api/portfolio/:id/projects                     — add project
 * GET  /api/portfolio/:id/snapshot                     — latest snapshot
 * POST /api/portfolio/:id/snapshot/refresh             — rebuild snapshot
 * GET  /api/portfolio/:id/dependencies                 — cross-project edges
 * GET  /api/portfolio/:id/capacity                     — capacity heatmap rows
 * GET  /api/portfolio/:id/digest                       — latest digest markdown
 * POST /api/portfolio/:id/digest/generate              — generate new digest
 * POST /api/portfolio/:id/digest/deliver/slack         — deliver to Slack
 * POST /api/portfolio/:id/digest/deliver/confluence    — deliver to Confluence
 */
import { Hono } from "hono";
import type { PortfolioStore } from "../../stores/portfolio-store.js";
import type { PortfolioAggregator } from "../../services/portfolio-aggregator.js";
import type { PortfolioDigestWriter } from "../../services/portfolio-digest.js";
export declare function createPortfolioRouter(store: PortfolioStore, aggregator: PortfolioAggregator, digestWriter: PortfolioDigestWriter): Hono;
