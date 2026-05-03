/**
 * ZendeskAdapter — pulls tickets from the Zendesk REST API (task 2.4)
 */
export class ZendeskAdapter {
    cfg;
    source = "zendesk";
    constructor(cfg) {
        this.cfg = cfg;
    }
    async fetchSince(since) {
        const base = `https://${this.cfg.subdomain}.zendesk.com/api/v2`;
        const params = new URLSearchParams({ sort_by: "created_at", sort_order: "asc", per_page: "100" });
        if (since)
            params.set("start_time", String(Math.floor(new Date(since).getTime() / 1000)));
        const resp = await fetch(`${base}/tickets.json?${params}`, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${this.cfg.email}/token:${this.cfg.token}`).toString("base64")}`,
                "Content-Type": "application/json",
            },
        });
        if (!resp.ok) {
            throw new Error(`Zendesk fetch failed: ${resp.status} ${resp.statusText}`);
        }
        const json = (await resp.json());
        return (json.tickets ?? []).map((t) => ({
            source_id: String(t.id),
            text: t.description ?? "",
            created_at: new Date(t.created_at).getTime(),
            customer_segment: null,
            tags: t.tags ?? [],
        }));
    }
}
