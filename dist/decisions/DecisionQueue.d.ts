/**
 * DecisionQueue — in-memory queue for agent decisions that require human review.
 * Agents await a Promise that resolves when the human approves/rejects/modifies.
 */
export type DecisionStatus = "pending" | "approved" | "rejected" | "modified";
export interface Decision {
    id: string;
    agent: string;
    run_id: string;
    type: string;
    payload: unknown;
    requires_review: true;
    created_at: string;
    status: DecisionStatus;
    resolution?: {
        reason?: string;
        patch?: unknown;
        resolved_at: string;
    };
}
type Subscriber = (decision: Decision) => void;
declare class DecisionQueueImpl {
    private queue;
    private resolvers;
    private subscribers;
    enqueue(agent: string, run_id: string, type: string, payload: unknown): Promise<Decision>;
    approve(id: string): Decision | null;
    reject(id: string, reason?: string): Decision | null;
    modify(id: string, patch: unknown): Decision | null;
    private resolve;
    subscribe(fn: Subscriber): () => void;
    private broadcast;
    list(statusFilter?: DecisionStatus): Decision[];
    get(id: string): Decision | undefined;
    /** Test helper — clears all state. */
    _resetForTests(): void;
}
export declare const DecisionQueue: DecisionQueueImpl;
export {};
