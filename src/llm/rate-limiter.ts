/**
 * Per-process LLM call-rate limiter.
 * Queues excess calls with exponential back-off; never drops calls.
 */

export class RateLimiter {
  private readonly callsPerMinute: number;
  private callCount = 0;
  private windowStart = Date.now();

  constructor(callsPerMinute: number) {
    this.callsPerMinute = callsPerMinute;
  }

  /** Run fn respecting the rate limit. Waits with back-off if over budget. */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this._waitIfNeeded();
    this._tick();
    return fn();
  }

  private _tick(): void {
    const now = Date.now();
    if (now - this.windowStart >= 60_000) {
      this.callCount = 0;
      this.windowStart = now;
    }
    this.callCount++;
  }

  private async _waitIfNeeded(): Promise<void> {
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
