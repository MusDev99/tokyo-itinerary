import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch, NETWORK_ERROR, TIMEOUT_ERROR, GENERIC_ERROR } from '../src/utils/apiFetch.ts';
import { toast, getToasts, dismissToast, resetToasts, subscribeToasts } from '../src/utils/toast.ts';

const reply = (status: number, body: unknown) => (async () => new Response(body === undefined ? '' : JSON.stringify(body), { status })) as unknown as typeof fetch;

test('ok responses return parsed data; a body is sent as JSON', async () => {
  let seen: any;
  const f = (async (_u: string, init: any) => { seen = init; return new Response('{"a":1}', { status: 200 }); }) as unknown as typeof fetch;
  const r = await apiFetch('/x', { body: { n: 1 } }, f);
  assert.deepEqual(r, { ok: true, status: 200, data: { a: 1 } });
  assert.equal(seen.method, 'POST');
  assert.equal(seen.body, '{"n":1}');
  assert.equal(seen.headers['Content-Type'], 'application/json');
});

test('no body means GET without a content type', async () => {
  let seen: any;
  const f = (async (_u: string, init: any) => { seen = init; return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
  await apiFetch('/x', {}, f);
  assert.equal(seen.method, 'GET');
  assert.equal(seen.headers, undefined);
});

test('server error text is passed through; unknown shapes fall back to a generic message', async () => {
  const a = await apiFetch('/x', { body: {} }, reply(400, { error: 'Title is required' }));
  assert.equal(a.ok, false);
  if (!a.ok) { assert.equal(a.kind, 'http'); assert.equal(a.error, 'Title is required'); }
  const b = await apiFetch('/x', { body: {} }, reply(500, undefined));
  if (!b.ok) assert.equal(b.error, GENERIC_ERROR);
});

test('401 and 503 call onSignedOut once and report signed-out', async () => {
  let calls = 0;
  const r = await apiFetch('/x', { body: {}, onSignedOut: () => { calls++; } }, reply(401, { error: 'nope' }));
  assert.equal(calls, 1);
  if (!r.ok) assert.equal(r.kind, 'signed-out');
  await apiFetch('/x', { onSignedOut: () => { calls++; } }, reply(503, {}));
  assert.equal(calls, 2);
});

test('network failure and timeout get the standard messages', async () => {
  const down = (async () => { throw new TypeError('failed'); }) as unknown as typeof fetch;
  const n = await apiFetch('/x', {}, down);
  if (!n.ok) { assert.equal(n.kind, 'network'); assert.equal(n.error, NETWORK_ERROR); }
  const slow = ((_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
  const t = await apiFetch('/x', { timeoutMs: 20 }, slow);
  if (!t.ok) { assert.equal(t.kind, 'timeout'); assert.equal(t.error, TIMEOUT_ERROR); }
});

test('a caller abort is silent (empty error)', async () => {
  const ctrl = new AbortController();
  const slow = ((_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))))) as unknown as typeof fetch;
  const p = apiFetch('/x', { signal: ctrl.signal }, slow);
  ctrl.abort();
  const r = await p;
  if (!r.ok) assert.equal(r.error, '');
});

test('toasts: tones, undo lasts longer, newest 3 kept, dismiss, subscribe', () => {
  resetToasts();
  let pings = 0;
  const off = subscribeToasts(() => pings++);
  const a = toast.success('Saved');
  toast.error('Nope');
  toast.info('FYI', { action: { label: 'Undo', run() {} } });
  toast.info('Fourth');
  const list = getToasts();
  assert.equal(list.length, 3);
  assert.equal(list[0].text, 'Nope');
  assert.equal(list[0].ms, 5000);
  assert.equal(list[1].ms, 6000);
  assert.equal(list[2].ms, 2500);
  dismissToast(list[0].id);
  assert.equal(getToasts().length, 2);
  dismissToast(a); // already gone: no emit
  const before = pings;
  dismissToast(9999);
  assert.equal(pings, before);
  off();
  resetToasts();
});
