/**
 * Teamwork Graph Enrichment Layer (beta)
 *
 * Fetches linked PRs, branches, and builds from the Atlassian Teamwork Graph
 * to enrich component dossiers with historical co-change data.
 *
 * IMPORTANT: This data is flagged `enrichmentOnly: true` — it SHALL NOT serve
 * as the sole grounding for any ranking decision. It augments structural +
 * semantic retrieval but never replaces it.
 */
import { withRetry } from "../utils/retry.js";
import { logger } from "../utils/logger.js";
// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export class TeamworkGraphClient {
    baseUrl;
    headers;
    retryDelayMs;
    constructor(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.retryDelayMs = config.retryDelayMs ?? 200;
        this.headers = {
            Authorization: `Bearer ${config.accessToken}`,
            Accept: "application/json",
            "Content-Type": "application/json",
        };
    }
    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    /**
     * Fetch Teamwork Graph enrichment for a specific Jira issue key.
     * Returns `null` with `enrichment_source: unavailable` if the graph is unreachable.
     */
    async enrich(issueKey) {
        try {
            const [prs, branches, builds] = await Promise.all([
                this._getLinkedPRs(issueKey),
                this._getLinkedBranches(issueKey),
                this._getLinkedBuilds(issueKey),
            ]);
            return { linkedPRs: prs, linkedBranches: branches, linkedBuilds: builds, enrichmentOnly: true };
        }
        catch (err) {
            logger.warn("teamwork_graph_unavailable", { issueKey, error: String(err) });
            return null;
        }
    }
    /**
     * Enrich component dossier fix-examples with PR history for a component's root paths.
     * Mutates the dossier in-place. Safe to call when graph is unavailable (no-op).
     */
    async enrichDossier(dossier, issueKey) {
        const enrichment = await this.enrich(issueKey);
        if (!enrichment)
            return { enriched: false, source: "unavailable" };
        const relevantPRs = enrichment.linkedPRs.filter((pr) => pr.files.some((f) => dossier.rootPaths.some((rp) => f.startsWith(rp))));
        const examples = relevantPRs.map((pr) => ({
            title: pr.title,
            paths: pr.files,
            summary: `PR ${pr.id} (${pr.status}) — ${pr.title}`,
        }));
        dossier.fixExamples.push(...examples);
        return { enriched: examples.length > 0, source: "teamwork_graph" };
    }
    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------
    async _getLinkedPRs(issueKey) {
        const start = Date.now();
        let retryCount = 0;
        const result = await withRetry(async () => {
            retryCount++;
            const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=pullrequest`;
            const res = await fetch(url, { headers: this.headers });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const body = (await res.json());
            const prs = [];
            for (const detail of body.detail ?? []) {
                for (const pr of detail.pullRequests ?? []) {
                    prs.push({
                        id: pr.id,
                        title: pr.name,
                        url: pr.url,
                        status: this._normalisePrStatus(pr.status),
                        files: [],
                    });
                }
            }
            return prs;
        }, { maxAttempts: 3, baseDelayMs: this.retryDelayMs });
        const trace = {
            adapter: "repo-adapter",
            operation: "getLinkedPRs",
            latencyMs: Date.now() - start,
            retryCount,
        };
        logger.info("adapter_call", trace);
        return result;
    }
    async _getLinkedBranches(issueKey) {
        const start = Date.now();
        let retryCount = 0;
        const result = await withRetry(async () => {
            retryCount++;
            const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=branch`;
            const res = await fetch(url, { headers: this.headers });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const body = (await res.json());
            const branches = [];
            for (const detail of body.detail ?? []) {
                for (const b of detail.branches ?? []) {
                    branches.push({ name: b.name, url: b.url });
                }
            }
            return branches;
        }, { maxAttempts: 3, baseDelayMs: this.retryDelayMs });
        const trace = {
            adapter: "repo-adapter",
            operation: "getLinkedBranches",
            latencyMs: Date.now() - start,
            retryCount,
        };
        logger.info("adapter_call", trace);
        return result;
    }
    async _getLinkedBuilds(issueKey) {
        const start = Date.now();
        let retryCount = 0;
        const result = await withRetry(async () => {
            retryCount++;
            const url = `${this.baseUrl}/rest/dev-status/latest/issue/detail?issueId=${issueKey}&applicationType=github&dataType=build`;
            const res = await fetch(url, { headers: this.headers });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const body = (await res.json());
            const builds = [];
            for (const detail of body.detail ?? []) {
                for (const b of detail.builds ?? []) {
                    builds.push({
                        id: String(b.id),
                        status: this._normaliseBuildStatus(b.state),
                        url: b.url,
                    });
                }
            }
            return builds;
        }, { maxAttempts: 3, baseDelayMs: this.retryDelayMs });
        const trace = {
            adapter: "repo-adapter",
            operation: "getLinkedBuilds",
            latencyMs: Date.now() - start,
            retryCount,
        };
        logger.info("adapter_call", trace);
        return result;
    }
    _normalisePrStatus(raw) {
        const s = raw.toLowerCase();
        if (s === "merged")
            return "merged";
        if (s === "closed" || s === "declined")
            return "closed";
        return "open";
    }
    _normaliseBuildStatus(raw) {
        const s = raw.toLowerCase();
        if (s === "successful" || s === "passing" || s === "success")
            return "passing";
        if (s === "failed" || s === "failing" || s === "failure")
            return "failing";
        return "pending";
    }
}
