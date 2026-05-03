/**
 * OutcomeSnapshotBuilder — computes OKR deltas and flag adoptions, then triggers
 * the ReflectionAgent to produce Markdown commentary. (task 2.6)
 */
import type { OKRStore } from "../stores/okr-store.js";
import type { MetricsIngestionAdapter } from "../adapters/metrics/index.js";
import type { OutcomeSnapshot } from "../types/outcomes.js";
import type { ReflectionAgent } from "./reflection-agent.js";
export declare class OutcomeSnapshotBuilder {
    private readonly store;
    private readonly metricsAdapters;
    private readonly reflectionAgent;
    constructor(store: OKRStore, metricsAdapters: MetricsIngestionAdapter[], reflectionAgent: ReflectionAgent);
    build(projectKey: string): Promise<OutcomeSnapshot>;
}
