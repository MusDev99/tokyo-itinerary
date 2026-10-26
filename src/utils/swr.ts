// Stale-while-revalidate timing for server-side Sheets reads (dependency-free, unit-tested).
// Fresh: serve from memory. Stale: serve from memory now and refresh in the background, so a click never
// waits on Google (Doherty Threshold). Miss: wait for Google. Writes clear the cache, so editors see their
// own change on the very next render.

export const SHEETS_FRESH_MS = 30_000;
export const SHEETS_STALE_MS = 10 * 60_000;

export interface Timed {
  freshUntil: number;
  staleUntil: number;
}

export type CacheState = 'fresh' | 'stale' | 'miss';

export function cacheState(entry: Timed | null | undefined, now: number): CacheState {
  if (!entry) return 'miss';
  if (now < entry.freshUntil) return 'fresh';
  if (now < entry.staleUntil) return 'stale';
  return 'miss';
}

export function timed(now: number, freshMs = SHEETS_FRESH_MS, staleMs = SHEETS_STALE_MS): Timed {
  return { freshUntil: now + freshMs, staleUntil: now + staleMs };
}
