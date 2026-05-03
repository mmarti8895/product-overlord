/**
 * Repository Adapter
 *
 * Provides read-only access to GitHub Cloud and Bitbucket Cloud repositories
 * for component indexing. Enforces a ≤ 20 GB repository size guard.
 *
 * Auth: personal-access token or OAuth app token (read scope only).
 * Retry: ×3 with exponential back-off via withRetry().
 * Traces: every call emits a structured AdapterTrace.
 */
import type { AdapterTrace } from "../types/index.js";
export declare class FileTooLargeError extends Error {
    constructor(path: string, sizeBytes: number);
}
export type RepoProvider = "github" | "bitbucket";
export interface RepoAdapterConfig {
    provider: RepoProvider;
    /** Base API URL — defaults per provider if omitted */
    baseUrl?: string;
    /** OAuth / PAT token (read scope) */
    accessToken: string;
    /** Base delay for retry back-off in ms (default 200; set 0 in tests) */
    retryDelayMs?: number;
}
export interface RawRepoMeta {
    name: string;
    full_name: string;
    /** Size in KB (GitHub) or MB (Bitbucket — normalised internally) */
    size: number;
    default_branch: string;
    private: boolean;
}
export interface RawTreeEntry {
    path: string;
    type: "blob" | "tree";
    size?: number;
}
export interface RawFileContent {
    path: string;
    content: string;
    encoding: "base64";
}
export interface RepoMeta {
    name: string;
    fullName: string;
    sizeKb: number;
    defaultBranch: string;
    isPrivate: boolean;
}
export declare class RepoAdapter {
    private readonly baseUrl;
    private readonly headers;
    private readonly retryDelayMs;
    readonly provider: RepoProvider;
    constructor(config: RepoAdapterConfig);
    getRepoMeta(owner: string, repo: string): Promise<{
        meta: RepoMeta;
        trace: AdapterTrace;
    }>;
    getTree(owner: string, repo: string, branch: string): Promise<{
        entries: RawTreeEntry[];
        trace: AdapterTrace;
    }>;
    getFileContent(owner: string, repo: string, path: string, branch: string): Promise<{
        file: RawFileContent;
        trace: AdapterTrace;
    }>;
    getDecodedFileContent(owner: string, repo: string, path: string, ref?: string): Promise<{
        content: string;
        trace: AdapterTrace;
    }>;
    private _trace;
}
