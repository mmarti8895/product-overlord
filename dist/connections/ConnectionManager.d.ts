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
export declare class ConnectionManager {
    private static _instance;
    static get instance(): ConnectionManager;
    static save<P extends Provider>(provider: P, config: ProviderConfig[P]): Promise<void>;
    static load<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null>;
    static loadRaw<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null>;
    static test(provider: Provider): Promise<{
        ok: boolean;
        latency_ms: number;
        error?: string;
    }>;
    save<P extends Provider>(provider: P, config: ProviderConfig[P]): Promise<void>;
    load<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null>;
    loadRaw<P extends Provider>(provider: P): Promise<ProviderConfig[P] | null>;
    test(provider: Provider): Promise<{
        ok: boolean;
        latency_ms: number;
        error?: string;
    }>;
}
