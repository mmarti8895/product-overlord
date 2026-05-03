/**
 * Server environment configuration.
 *
 * Validates process.env via Zod on startup.
 * Hard-fails only when BASE_URL is absent (cannot build confirm_post_url).
 * All adapter tokens are optional — absence enables degraded mode.
 */
export interface SprintConfig {
    pollIntervalMs: number;
    doneStatuses: string[];
    boardIds: string[];
    sprintLengthDays: number;
}
export interface ServerConfig {
    port: number;
    baseUrl: string;
    nodeEnv: string;
    jiraBaseUrl: string | undefined;
    jiraAccessToken: string | undefined;
    rovoMcpCloudId: string | undefined;
    rovoMcpAccessToken: string | undefined;
    githubAccessToken: string | undefined;
    bitbucketAccessToken: string | undefined;
    featureFlags: {
        repoGroundingEnabled: boolean;
        jiraIngestionEnabled: boolean;
        rovoMcpEnabled: boolean;
        shadowModeOnly: boolean;
        a2aEnabled: boolean;
        llmEnabled: boolean;
    };
    llm: {
        apiKey: string | undefined;
        baseUrl: string;
        model: string;
        embeddingModel: string;
        callsPerMinute: number;
        degraded: boolean;
    };
    kb: {
        storePath: string;
        maxSizeGb: number;
    };
    uiDevEndpoints: boolean;
    confluenceBaseUrl: string | undefined;
    confluenceToken: string | undefined;
    sprint: {
        pollIntervalMs: number;
        doneStatuses: string[];
        boardIds: string[];
        sprintLengthDays: number;
    };
}
export declare function loadConfig(env?: NodeJS.ProcessEnv): ServerConfig;
