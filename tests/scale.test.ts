import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs, canRetry, QuotaGate } from '../src/utils/quota.ts';
import { applyTabUpdate, lastUsedRow, rowLimitError, tabSlug, MAX_TAB_ROWS } from '../src/utils/cacheTabs.ts';
import type { DayItinerary } from '../src/types/itinerary.ts';

const noJitter = () => 0;
const fullJitter = () => 1;

test('retry delay: exponential 1s 2s 4s 8s without Retry-After; jitter adds at most 25%', () => {
  assert.deepEqual([1, 2, 3, 4].map((a) => retryDelayMs(a, null, 0, noJitter)), [1000, 2000, 4000, 8000]);
  assert.equal(retryDelayMs(1, null, 0, fullJitter), 1250);
});

test('retry delay honours Retry-After seconds and HTTP dates, and never waits more than 15s at once', () => {
  assert.equal(retryDelayMs(1, '5', 0, noJitter), 5000);
  assert.equal(retryDelayMs(1, new Date(7000).toUTCString(), 2000, noJitter), 5000);
  assert.equal(retryDelayMs(1, '120', 0, noJitter), 15000);
  assert.equal(retryDelayMs(9, null, 0, noJitter), 15000);
  assert.equal(retryDelayMs(1, 'garbage', 0, noJitter), 1000);
});

test('a retry is allowed only while it fits the time budget', () => {
  assert.equal(canRetry(0, 4000, 10000), true);
  assert.equal(canRetry(6000, 4000, 10000), true);
  assert.equal(canRetry(7000, 4000, 10000), false);
});

test('the quota gate closes after a 429, stays closed at least 1s, only ever extends', () => {
  const g = new QuotaGate();
  assert.equal(g.closedFor(0), 0);
  g.noteLimited(1000, 200);
  assert.equal(g.closedFor(1000), 1000);
  g.noteLimited(1000, 5000);
  assert.equal(g.closedFor(1000), 5000);
  g.noteLimited(1000, 100); // a shorter wait never shortens the closure
  assert.equal(g.closedFor(1000), 5000);
  assert.equal(g.closedFor(6001), 0);
  g.reset();
  assert.equal(g.closedFor(1000), 0);
});

const day = (rows: number[]): DayItinerary => ({ day: 1, title: '', date: '2025-03-01', items: rows.map((row) => ({ row, time: '', title: 't', description: '', location: { name: '', mapsUrl: '' }, price: { amount: 0, currency: 'JPY' }, note: '' })) } as any);

test('patching one tab replaces only that tab and reports unknown tabs', () => {
  const raw = { itineraries: { 'japan---tokyo': [day([2])], 'japan---osaka': [day([2, 3])] }, tabTitles: { 'japan---tokyo': 'Japan - Tokyo', 'japan---osaka': 'Japan - Osaka' } };
  let parsedTitle = '';
  const next = applyTabUpdate(raw, 'Japan - Tokyo', (t) => { parsedTitle = t; return [day([2, 3, 4])]; })!;
  assert.equal(parsedTitle, 'Japan - Tokyo');
  assert.equal(next.itineraries['japan---tokyo'][0].items.length, 3);
  assert.equal(next.itineraries['japan---osaka'], raw.itineraries['japan---osaka']);
  assert.equal(raw.itineraries['japan---tokyo'][0].items.length, 1, 'the original is not mutated');
  assert.equal(applyTabUpdate(raw, 'Japan - Kyoto', () => []), null);
  assert.equal(tabSlug('  Japan - Tokyo '), 'japan---tokyo'); // the same key the reader files the tab under
});

test('row limit: the sheet is read to row 2000, so a full trip is refused with a clear message', () => {
  assert.equal(lastUsedRow([day([2, 9]), day([5])]), 9);
  assert.equal(lastUsedRow([]), 1);
  assert.equal(rowLimitError(10, 5), null);
  assert.equal(rowLimitError(MAX_TAB_ROWS - 5, 5), null);
  assert.match(rowLimitError(MAX_TAB_ROWS - 3, 5)!, /room for only 3 more places/);
  assert.match(rowLimitError(MAX_TAB_ROWS, 1)!, /trip is full/);
  assert.match(rowLimitError(MAX_TAB_ROWS - 1, 2)!, /only 1 more place /);
});
