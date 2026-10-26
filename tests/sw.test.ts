import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// public/sw.js is a classic worker script: load it in a sandbox and use the pure helpers it exposes on self.__pwa
const listeners: Record<string, unknown> = {};
const self: Record<string, any> = { addEventListener: (type: string, fn: unknown) => (listeners[type] = fn), location: { origin: 'https://trip.example' } };
vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL, Response, setTimeout });
const { strategyFor, sitemapPaths, isCacheablePage, pageKey } = self.__pwa;
const O = 'https://trip.example';

test('service worker registers install, activate, fetch and message handlers', () => {
  for (const t of ['install', 'activate', 'fetch', 'message']) assert.equal(typeof listeners[t], 'function', t);
});

test('pages are network-first, hashed assets cache-first', () => {
  assert.equal(strategyFor('GET', `${O}/japan/tokyo`, O, 'navigate'), 'page');
  assert.equal(strategyFor('GET', `${O}/`, O, 'navigate'), 'page');
  assert.equal(strategyFor('GET', `${O}/_astro/index.abc123.js`, O, 'no-cors'), 'asset');
  assert.equal(strategyFor('GET', 'https://fonts.gstatic.com/s/inter.woff2', O, 'cors'), 'font');
  assert.equal(strategyFor('GET', `${O}/logo.svg`, O, 'no-cors'), 'static', 'header logo must load offline');
  assert.equal(strategyFor('GET', `${O}/icons/icon-192.png`, O, 'no-cors'), 'static');
  assert.equal(strategyFor('GET', `${O}/japan/tokyo`, O, 'cors'), 'bypass', 'non-navigation fetches of pages pass through');
  assert.equal(strategyFor('GET', `${O}/api/currency-exchange?base=MYR`, O, 'cors'), 'api');
  assert.equal(strategyFor('GET', `${O}/api/prayer-times?lat=1&lng=2`, O, 'cors'), 'api');
});

test('writes, auth and admin screens are never cached (A01: no stale editor screens)', () => {
  for (const m of ['POST', 'PATCH', 'DELETE']) assert.equal(strategyFor(m, `${O}/api/itinerary`, O, 'cors'), 'bypass', m);
  assert.equal(strategyFor('GET', `${O}/api/itinerary`, O, 'cors'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/api/sheets-sync`, O, 'cors'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/api/auth/google/callback?code=x`, O, 'navigate'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/login`, O, 'navigate'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/add`, O, 'navigate'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/add/extra`, O, 'navigate'), 'bypass');
  assert.equal(strategyFor('GET', `${O}/addresses`, O, 'navigate'), 'page', 'prefix match is per path segment');
  assert.equal(strategyFor('GET', 'https://evil.test/x', O, 'navigate'), 'bypass', 'other origins pass through');
  assert.equal(strategyFor('GET', 'https://open.er-api.com/v6/latest/MYR', O, 'cors'), 'bypass');
});

test('sitemap paths stay on our origin and skip admin pages', () => {
  const xml = `<urlset>
    <url><loc>${O}/</loc></url>
    <url><loc> ${O}/japan/itinerary </loc></url>
    <url><loc>${O}/japan/tokyo</loc></url>
    <url><loc>${O}/japan/tokyo</loc></url>
    <url><loc>${O}/login</loc></url>
    <url><loc>https://evil.test/phish</loc></url>
    <url><loc>not a url</loc></url>
  </urlset>`;
  assert.deepEqual([...sitemapPaths(xml, O)], ['/', '/japan/itinerary', '/japan/tokyo']);
});

test('only same-origin HTML 200s are saved as pages', () => {
  const html = (init: ResponseInit = {}) => new Response('<p>hi</p>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
  // Response.type is 'default' in Node; a browser same-origin fetch is 'basic'
  const basic = (r: Response) => Object.defineProperty(r, 'type', { value: 'basic' });
  assert.equal(isCacheablePage(basic(html())), true);
  assert.equal(isCacheablePage(html()), false, 'opaque/other response types are not saved');
  assert.equal(isCacheablePage(basic(html({ status: 500 }))), false);
  assert.equal(isCacheablePage(basic(new Response('{}', { headers: { 'content-type': 'application/json' } }))), false);
  assert.equal(isCacheablePage(null), false);
});

test('one saved copy per page: query strings and trailing slashes collapse', () => {
  assert.equal(pageKey(`${O}/japan/tokyo/?day=2`), `${O}/japan/tokyo`);
  assert.equal(pageKey(`${O}/`), `${O}/`);
});
