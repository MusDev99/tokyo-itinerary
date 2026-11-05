import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripTabs, tripBase } from '../src/utils/tripTabs.ts';

const planned = { totalDays: 7, hasItinerary: true };

test('a trip has four tabs in order, itinerary on the short /trips/<slug> URL', () => {
  const { isTrip, tabs } = tripTabs({ slug: 'japan', stats: planned }, { slug: 'airtravel-japan-2025' });
  assert.equal(isTrip, true);
  assert.deepEqual(tabs.map((t) => t.key), ['overview', 'analysis', 'itinerary', 'pocket']);
  assert.deepEqual(tabs.map((t) => t.href), [
    '/trips/airtravel-japan-2025/overview', '/trips/airtravel-japan-2025/analysis', '/trips/airtravel-japan-2025', '/trips/airtravel-japan-2025/pocket',
  ]);
  assert.equal(tabs.find((t) => t.key === 'itinerary')?.badge, '7d');
  assert.equal(tripBase('japan-tokyo'), '/trips/japan-tokyo');
});

test('a country page is not a trip: overview + merged itinerary only', () => {
  const { isTrip, tabs } = tripTabs({ slug: 'japan', stats: planned });
  assert.equal(isTrip, false);
  assert.deepEqual(tabs.map((t) => t.href), ['/japan', '/japan/itinerary']);
});

test('a trip with nothing planned yet only offers Overview and Pocket', () => {
  const { tabs } = tripTabs({ slug: 'korea', stats: { totalDays: 0, hasItinerary: false } }, { slug: 'korea' });
  assert.deepEqual(tabs.map((t) => t.key), ['overview', 'pocket']);
  assert.deepEqual(tabs.map((t) => t.href), ['/trips/korea/overview', '/trips/korea/pocket']);
});

test('a country with nothing planned has only its overview', () => {
  const { tabs } = tripTabs({ slug: 'korea', stats: { totalDays: 0, hasItinerary: false } });
  assert.deepEqual(tabs.map((t) => t.key), ['overview']);
});
