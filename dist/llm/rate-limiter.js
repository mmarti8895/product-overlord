/**
 * Per-process LLM call-rate limiter.
 * Queues excess calls with exponential back-off; never drops calls.
 */
export class RateLimiter {
    callsPerMinute;
    callCount = 0;
    windowStart = Date.now();
    constructor(callsPerMinute) {
        this.callsPerMinute = callsPerMinute;
    }
    /** Run fn respecting the rate limit. Waits with back-off if over budget. */
    async run(fn) {
        await this._waitIfNeeded();
        this._tick();
        return fn();
    }
    _tick() {
        const now = Date.now();
        if (now - this.windowStart >= 60_000) {
            this.callCount = 0;
            this.windowStart = now;
        }
        this.callCount++;
    }
    async _waitIfNeeded() {
        const now = Date.now();
        const elapsed = now - this.windowStart;
        if (elapsed >= 60_000) {
            // Window has reset
            return;
        }
        if (this.callCount < this.callsPerMinute) {
            return;
        }
        // Over budget — wait until window resets, with exponential back-off
        let delay = 60_000 - elapsed;
        let attempt = 0;
        while (this.callCount >= this.callsPerMinute && Date.now() - this.windowStart < 60_000) {
            await sleep(Math.min(delay * Math.pow(1.5, attempt), 30_000));
            attempt++;
            // Re-check after window possibly reset
            if (Date.now() - this.windowStart >= 60_000) {
                this.callCount = 0;
                this.windowStart = Date.now();
                break;
            }
            delay = Math.max(delay / 2, 100);
        }
    }
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
