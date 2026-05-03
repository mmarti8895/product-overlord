/**
 * Per-process LLM call-rate limiter.
 * Queues excess calls with exponential back-off; never drops calls.
 */
export declare class RateLimiter {
    private readonly callsPerMinute;
    private callCount;
    private windowStart;
    constructor(callsPerMinute: number);
    /** Run fn respecting the rate limit. Waits with back-off if over budget. */
    run<T>(fn: () => Promise<T>): Promise<T>;
    private _tick;
    private _waitIfNeeded;
}
