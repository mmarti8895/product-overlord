/**
 * LaunchDarklyAdapter — polls the LaunchDarkly metrics API (task 2.4)
 */
import type { MetricsIngestionAdapter, RawMetricEvent } from "./index.js";
interface LaunchDarklyConfig {
    apiKey: string;
    projectKey: string;
    environmentKey?: string;
    baseUrl?: string;
}
export declare class LaunchDarklyAdapter implements MetricsIngestionAdapter {
    private readonly cfg;
    readonly source: "launch_darkly";
    private readonly baseUrl;
    private readonly env;
    constructor(cfg: LaunchDarklyConfig);
    fetchSince(since: string | null): Promise<RawMetricEvent[]>;
}
export {};
