export interface RetryOptions {
    maxAttempts?: number;
    baseDelayMs?: number;
}
export declare function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
