import { secretLoad, secretSave } from "./SecretStore.js";

export type Provider = "jira" | "openai" | "github";

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  token: string;
}

export interface OpenAIConfig {
  apiKey: string;
  orgId?: string;
  baseUrl?: string;
  plannerModel: string;
  executorModel: string;
  reviewerModel: string;
  tpmBudget: number;
  rpmBudget: number;
}

export interface GitHubConfig {
  pat?: string;
  appId?: string;
  privateKey?: string;
  repos: string[];
  branchFilter: string;
}

export type ProviderConfig = {
  jira: JiraConfig;
  openai: OpenAIConfig;
  github: GitHubConfig;
};

export type MaskedConfig<T extends Record<string, unknown>> = {
  [K in keyof T]: K extends "token" | "apiKey" | "pat" | "privateKey" ? string : T[K];
};

const SECRET_FIELDS: Record<Provider, string[]> = {
  jira: ["token"],
  openai: ["apiKey"],
  github: ["pat", "privateKey"],
};

function maskConfig<T extends Record<string, unknown>>(provider: Provider, config: T): T {
  const masked = { ...config } as Record<string, unknown>;
  for (const field of SECRET_FIELDS[provider]) {
    if (masked[field]) masked[field] = "***";
  }
  return masked as unknown as T;
}

function configKey(provider: Provider): string {
  return `overlord.connection.${provider}`;
}

export class ConnectionManager {
  private static _instance: ConnectionManager;

  static get instance(): ConnectionManager {
    if (!this._instance) this._instance = new ConnectionManager();
    return this._instance;
  }

  // ── Static delegates (proxy to singleton) ─────────────────────────────────

  static async save<P extends Provider>(provider: P, config: ProviderConfig[P]): Promise<void> {
    return ConnectionManager.instance.save(provider, config);
  }

  static async load<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null> {
    return ConnectionManager.instance.load(provider);
  }

  static async loadRaw<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null> {
    return ConnectionManager.instance.loadRaw(provider);
  }

  static async test(provider: Provider): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
    return ConnectionManager.instance.test(provider);
  }

  // ── Instance methods ───────────────────────────────────────────────────────

  async save<P extends Provider>(provider: P, config: ProviderConfig[P]): Promise<void> {
    await secretSave(configKey(provider), JSON.stringify(config));
  }

  async load<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null> {
    const raw = await secretLoad(configKey(provider));
    if (!raw) return null;
    const config = JSON.parse(raw) as ProviderConfig[P];
    return maskConfig(provider, config as unknown as Record<string, unknown>) as unknown as ProviderConfig[P];
  }

  async loadRaw<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null> {
    const raw = await secretLoad(configKey(provider));
    if (!raw) return null;
    return JSON.parse(raw) as ProviderConfig[P];
  }

  async test(provider: Provider): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
    const config = await this.loadRaw(provider);
    if (!config) return { ok: false, latency_ms: 0, error: "No configuration saved" };
    const start = Date.now();
    try {
      switch (provider) {
        case "jira": {
          const { testJira } = await import("./providers/JiraProvider.js");
          await testJira(config as JiraConfig);
          break;
        }
        case "openai": {
          const { testOpenAI } = await import("./providers/OpenAIProvider.js");
          await testOpenAI(config as OpenAIConfig);
          break;
        }
        case "github": {
          const { testGitHub } = await import("./providers/GitHubProvider.js");
          await testGitHub(config as GitHubConfig);
          break;
        }
      }
      return { ok: true, latency_ms: Date.now() - start };
    } catch (err) {
      return { ok: false, latency_ms: Date.now() - start, error: String(err) };
    }
  }
}
