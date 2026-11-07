import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import pkg from '../../../package.json';
import { getAllCountriesWithSheets } from '../../utils/countries';
import { authConfig } from '../../utils/authEnv';
import { sheetsStats, quotaGate } from '../../utils/quota';
import { evaluateHealth } from '../../utils/health';

/**
 * Uptime-monitor endpoint. Public and tiny by default: `{status, version}`; 503 only when the trip sheet cannot be read.
 * With the header `x-health-token: $HEALTH_TOKEN` (optional env var) it adds the individual checks and counters.
 * It answers from the same cache visitors use, so polling it every minute costs no Sheets quota when the cache is warm.
 */
const body = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function tokenOk(request: Request): boolean {
  const expected = process.env.HEALTH_TOKEN || '';
  const sent = request.headers.get('x-health-token') || '';
  if (!expected || !sent) return false;
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const GET: APIRoute = async ({ request }) => {
  let sheet: { configured: boolean; source: 'google-sheets' | 'unconfigured' | 'error'; tripCount: number } = { configured: false, source: 'error', tripCount: 0 };
  try {
    const { countries, syncResult } = await getAllCountriesWithSheets();
    sheet = { configured: syncResult.configured, source: syncResult.source, tripCount: countries.reduce((n, c) => n + c.states.length, 0) };
  } catch {
    // a thrown read counts as "cannot read"
  }
  const { status, checks } = evaluateHealth({ now: Date.now(), editingConfigured: authConfig().configured, sheet, stats: sheetsStats });
  const base = { status, version: pkg.version, commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || undefined, time: new Date().toISOString() };
  const code = status === 'down' ? 503 : 200;
  if (!tokenOk(request)) return body(base, code);
  return body({ ...base, checks, stats: { ...sheetsStats, quotaClosedMs: quotaGate.closedFor(Date.now()) } }, code);
};
