/**
 * HTTP application factory.
 *
 * Creates a Hono app wiring the four Forge endpoint handlers + /health.
 * The ForgeRequest/ForgeResponse adapter translates between Hono's Context
 * and the existing handler interfaces — no changes to endpoints.ts required.
 */
import { Hono } from "hono";
import type { ServerConfig } from "./config.js";
export declare function createApp(config: ServerConfig): Hono;
