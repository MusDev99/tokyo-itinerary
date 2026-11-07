/**
 * Health decision for `/api/health` (pure, unit-tested). It reports what a visitor would experience, using data the
 * server already has (no extra Sheets call when the cache is warm), so an uptime monitor can poll it every minute
 * without spending quota.
 */
export interface HealthInput {
  now: number;
  editingConfigured: boolean;
  sheet: { configured: boolean; source: 'google-sheets' | 'unconfigured' | 'error'; tripCount: number };
  stats: { lastReadAt: number; lastReadMs: number; lastErrorAt: number; lastLimitedAt: number; rateLimited: number };
}
export type HealthStatus = 'ok' | 'degraded' | 'down';
export interface HealthCheck { name: string; ok: boolean; detail: string }

const FIVE_MIN = 5 * 60_000;
export const SLOW_READ_MS = 5000;

export function evaluateHealth(i: HealthInput): { status: HealthStatus; checks: HealthCheck[] } {
  const checks: HealthCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  const readable = i.sheet.configured && i.sheet.source === 'google-sheets';
  add('sheet readable', readable, readable ? `${i.sheet.tripCount} trips` : i.sheet.configured ? 'cannot read the sheet' : 'sheet not configured');

  // The cache can keep serving the last good data while Google fails: say so instead of reporting a clean bill
  const failingNow = readable && i.stats.lastErrorAt > i.stats.lastReadAt && i.stats.lastErrorAt > 0 && i.stats.lastReadAt > 0 && i.now - i.stats.lastErrorAt < FIVE_MIN;
  add('recent reads succeed', !failingNow, failingNow ? 'serving cached data, last read failed' : 'ok');

  const limited = i.stats.lastLimitedAt > 0 && i.now - i.stats.lastLimitedAt < FIVE_MIN;
  add('no recent rate limiting', !limited, limited ? 'Google rate limit hit in the last 5 minutes' : 'ok');

  const slow = i.stats.lastReadMs > SLOW_READ_MS;
  add('full read is fast', !slow, `${i.stats.lastReadMs} ms`);

  add('editing configured', i.editingConfigured, i.editingConfigured ? 'sign-in is set up' : 'Google sign-in is not configured: editing is off');

  const status: HealthStatus = !readable ? 'down' : checks.every((c) => c.ok) ? 'ok' : 'degraded';
  return { status, checks };
}
