/**
 * OKRStore — LanceDB-backed persistence for OKRs and outcome snapshots (task 2.2)
 */
import type { OKR, KeyResult, MetricEvent, OutcomeSnapshot } from "../types/outcomes.js";
export declare class OKRStore {
    private readonly storePath;
    private db;
    constructor(storePath: string);
    private getDb;
    private all;
    private insert;
    private remove;
    listOKRs(projectKey: string): Promise<OKR[]>;
    getOKR(id: string): Promise<OKR | null>;
    createOKR(input: Omit<OKR, "id" | "created_at">): Promise<OKR>;
    linkEpicToOKR(okrId: string, epicKey: string): Promise<OKR>;
    updateKeyResult(okrId: string, krId: string, current: number): Promise<OKR>;
    appendMetricEvent(event: Omit<MetricEvent, "id">): Promise<MetricEvent>;
    getMetricEvents(okrId: string): Promise<MetricEvent[]>;
    latestSnapshot(projectKey: string): Promise<OutcomeSnapshot | null>;
    saveSnapshot(snapshot: OutcomeSnapshot): Promise<void>;
    patchSnapshotNotes(id: string, notes: string): Promise<OutcomeSnapshot | null>;
    newKeyResult(input: Omit<KeyResult, "id" | "updated_at">): KeyResult;
}
