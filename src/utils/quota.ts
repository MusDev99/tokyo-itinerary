/**
 * Google Sheets quota handling (pure, dependency-free, unit-tested).
 * Sheets allows about 60 reads per minute per user. Past that it answers 429. Three rules keep a busy agency from
 * turning that into hung pages:
 *  1. Retry waits honour `Retry-After`, grow exponentially with jitter and stop at a time budget (a page never
 *     sleeps for a minute).
 *  2. After a 429 a shared gate stays closed for a moment: readers that already have data serve it at once instead
 *     of all retrying together (a retry storm makes the quota window longer).
 *  3. Counters say how often that happens, for the health check.
 */

export const DEFAULT_RETRY_BUDGET_MS = 10_000;
const MAX_SINGLE_WAIT_MS = 15_000;

/** Wait before retry number `attempt` (1-based): Retry-After if given, else 1s, 2s, 4s, 8s... with up to 25% jitter. */
export function retryDelayMs(attempt: number, retryAfter?: string | null, now = Date.now(), rand: () => number = Math.random): number {
  let base = 1000 * 2 ** (Math.max(1, attempt) - 1);
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) base = secs * 1000;
    else {
      const at = Date.parse(retryAfter);
      if (!Number.isNaN(at)) base = Math.max(0, at - now);
    }
  }
  return Math.min(MAX_SINGLE_WAIT_MS, Math.round(base * (1 + rand() * 0.25)));
}

/** Should we wait `delayMs` and retry, given what was already waited and the time budget? */
export function canRetry(waitedMs: number, delayMs: number, budgetMs = DEFAULT_RETRY_BUDGET_MS): boolean {
  return waitedMs + delayMs <= budgetMs;
}

/** Remembers "Google told us to slow down" for a short time. */
export class QuotaGate {
  private until = 0;
  noteLimited(now: number, delayMs: number): void {
    this.until = Math.max(this.until, now + Math.max(1000, delayMs));
  }
  /** Milliseconds the gate is still closed (0 = open). */
  closedFor(now: number): number {
    return Math.max(0, this.until - now);
  }
  reset(): void { this.until = 0; }
}

export const quotaGate = new QuotaGate();

/** Counters since the server instance started (health check). */
export const sheetsStats = {
  calls: 0,
  rateLimited: 0,
  retries: 0,
  lastLimitedAt: 0,
  lastReadMs: 0,
  lastReadAt: 0,
  lastError: '',
  lastErrorAt: 0,
  servedFromGate: 0,
  targetedRefreshes: 0,
  fullReads: 0,
};
