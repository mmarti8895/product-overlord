import { secretLoad, secretSave } from "./SecretStore.js";
const SECRET_FIELDS = {
    jira: ["token"],
    openai: ["apiKey"],
    github: ["pat", "privateKey"],
};
function maskConfig(provider, config) {
    const masked = { ...config };
    for (const field of SECRET_FIELDS[provider]) {
        if (masked[field])
            masked[field] = "***";
    }
    return masked;
}
function configKey(provider) {
    return `overlord.connection.${provider}`;
}
export class ConnectionManager {
    static _instance;
    static get instance() {
        if (!this._instance)
            this._instance = new ConnectionManager();
        return this._instance;
    }
    // ── Static delegates (proxy to singleton) ─────────────────────────────────
    static async save(provider, config) {
        return ConnectionManager.instance.save(provider, config);
    }
    static async load(provider) {
        return ConnectionManager.instance.load(provider);
    }
    static async loadRaw(provider) {
        return ConnectionManager.instance.loadRaw(provider);
    }
    static async test(provider) {
        return ConnectionManager.instance.test(provider);
    }
    // ── Instance methods ───────────────────────────────────────────────────────
    async save(provider, config) {
        await secretSave(configKey(provider), JSON.stringify(config));
    }
    async load(provider) {
        const raw = await secretLoad(configKey(provider));
        if (!raw)
            return null;
        const config = JSON.parse(raw);
        return maskConfig(provider, config);
    }
    async loadRaw(provider) {
        const raw = await secretLoad(configKey(provider));
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    async test(provider) {
        const config = await this.loadRaw(provider);
        if (!config)
            return { ok: false, latency_ms: 0, error: "No configuration saved" };
        const start = Date.now();
        try {
            switch (provider) {
                case "jira": {
                    const { testJira } = await import("./providers/JiraProvider.js");
                    await testJira(config);
                    break;
                }
                case "openai": {
                    const { testOpenAI } = await import("./providers/OpenAIProvider.js");
                    await testOpenAI(config);
                    break;
                }
                case "github": {
                    const { testGitHub } = await import("./providers/GitHubProvider.js");
                    await testGitHub(config);
                    break;
                }
            }
            return { ok: true, latency_ms: Date.now() - start };
        }
        catch (err) {
            return { ok: false, latency_ms: Date.now() - start, error: String(err) };
        }
    }
}
