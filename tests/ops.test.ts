import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatLog, redact, scrubText, errorInfo, newRequestId, runWithRequest, currentRequestId } from '../src/utils/log.ts';
import { evaluateHealth, SLOW_READ_MS, type HealthInput } from '../src/utils/health.ts';

test('log lines are one JSON object with time, level and event', () => {
  const line = formatLog('warn', 'sheets_rate_limited', { attempt: 2 }, Date.UTC(2026, 10, 7, 1, 2, 3));
  assert.deepEqual(JSON.parse(line), { ts: '2026-11-07T01:02:03.000Z', level: 'warn', event: 'sheets_rate_limited', attempt: 2 });
  assert.ok(!line.includes('\n'));
});

test('secrets never reach the log: by key name and inside free text', () => {
  const out = redact({ user: 'a', token: 'abc', nested: { Authorization: 'Bearer x', cookie: 'tk_session=1', api_key: 'k' }, list: [{ password: 'p' }] }) as any;
  assert.equal(out.user, 'a');
  assert.equal(out.token, '[redacted]');
  assert.equal(out.nested.Authorization, '[redacted]');
  assert.equal(out.nested.cookie, '[redacted]');
  assert.equal(out.nested.api_key, '[redacted]');
  assert.equal(out.list[0].password, '[redacted]');

  assert.equal(scrubText('call failed with Bearer ya29.A0AbCdEfGhIjKlMnOp rest'), 'call failed with Bearer [redacted] rest');
  assert.match(scrubText('id eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl end'), /\[redacted-jwt\]/);
  assert.match(scrubText('-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkq\n-----END PRIVATE KEY-----'), /\[redacted-key\]/);
  assert.match(scrubText('a'.repeat(60)), /\[redacted-long\]/);
  assert.equal(scrubText('https://x/cb?code=4/0AbCd&state=1'), 'https://x/cb?code=[redacted]&state=1');
  assert.equal(scrubText('Failed to fetch spreadsheet metadata (429)'), 'Failed to fetch spreadsheet metadata (429)');
});

test('a JSON parse error that quotes part of a key is scrubbed', () => {
  const key = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKj';
  const info = errorInfo(new SyntaxError(`Unexpected token in JSON: "private_key": "${key}`));
  assert.ok(!info.errorMessage.includes(key));
});

test('redaction is bounded: long text cut, deep objects cut, cycles safe, errors reduced to name and message', () => {
  assert.ok(String(redact('x '.repeat(500))).length <= 401);
  const deep: any = { a: { b: { c: { d: { e: 1 } } } } };
  assert.equal(JSON.stringify(redact(deep)).includes('"e"'), false);
  const loop: any = { name: 'loop' }; loop.self = loop;
  assert.equal((redact(loop) as any).self, '[circular]');
  const e = redact(new TypeError('bad')) as any;
  assert.deepEqual(e, { name: 'TypeError', message: 'bad' });
  assert.equal(((redact(Array.from({ length: 50 }, (_, i) => i))) as number[]).length, 20);
});

test('request ids: the host id if sane, else a short random one; carried through async work', async () => {
  assert.equal(newRequestId('fra1::iad1::abc123def456'), 'abc123def456');
  assert.match(newRequestId('bad id with spaces!'), /^[a-f0-9]{12}$/);
  assert.match(newRequestId(null), /^[a-f0-9]{12}$/);
  assert.equal(currentRequestId(), undefined);
  const seen = await runWithRequest('req-1', async () => { await new Promise((r) => setTimeout(r, 5)); return currentRequestId(); });
  assert.equal(seen, 'req-1');
});

const base = (over: Partial<HealthInput> = {}): HealthInput => ({
  now: 1_000_000_000,
  editingConfigured: true,
  sheet: { configured: true, source: 'google-sheets', tripCount: 12 },
  stats: { lastReadAt: 999_000_000, lastReadMs: 800, lastErrorAt: 0, lastLimitedAt: 0, rateLimited: 0 },
  ...over,
});

test('health: ok when readable, fast, not limited and editing is set up', () => {
  const h = evaluateHealth(base());
  assert.equal(h.status, 'ok');
  assert.ok(h.checks.every((c) => c.ok));
});

test('health: down only when the sheet cannot be read', () => {
  assert.equal(evaluateHealth(base({ sheet: { configured: true, source: 'error', tripCount: 0 } })).status, 'down');
  assert.equal(evaluateHealth(base({ sheet: { configured: false, source: 'unconfigured', tripCount: 0 } })).status, 'down');
});

test('health: degraded for rate limiting, slow reads, a recent failed read behind cached data, or editing off', () => {
  assert.equal(evaluateHealth(base({ stats: { ...base().stats, lastLimitedAt: base().now - 60_000 } })).status, 'degraded');
  assert.equal(evaluateHealth(base({ stats: { ...base().stats, lastReadMs: SLOW_READ_MS + 1 } })).status, 'degraded');
  assert.equal(evaluateHealth(base({ stats: { ...base().stats, lastErrorAt: base().now - 1000 } })).status, 'degraded');
  assert.equal(evaluateHealth(base({ editingConfigured: false })).status, 'degraded');
  // old problems are forgotten after 5 minutes
  assert.equal(evaluateHealth(base({ stats: { ...base().stats, lastLimitedAt: base().now - 10 * 60_000 } })).status, 'ok');
});
