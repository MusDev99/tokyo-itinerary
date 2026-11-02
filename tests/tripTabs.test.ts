import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripTabs } from '../src/utils/tripTabs.ts';

const planned = { totalDays: 7, hasItinerary: true };

test('a state trip has the five tabs in order, itinerary on the short URL', () => {
  const { isTrip, tabs } = tripTabs({ slug: 'japan', stats: planned, states: [{}, {}] }, { slug: 'tokyo' });
  assert.equal(isTrip, true);
  assert.deepEqual(tabs.map((t) => t.key), ['overview', 'analysis', 'itinerary', 'tools', 'prepare']);
  assert.deepEqual(tabs.map((t) => t.href), [
    '/japan/tokyo/overview', '/japan/tokyo/analysis', '/japan/tokyo', '/japan/tokyo/tools', '/japan/tokyo/prepare',
  ]);
  assert.equal(tabs.find((t) => t.key === 'itinerary')?.badge, '7d');
});

test('a country without states is a trip too; its overview is the country page', () => {
  const { isTrip, tabs } = tripTabs({ slug: 'korea', stats: planned, states: [] });
  assert.equal(isTrip, true);
  assert.deepEqual(tabs.map((t) => t.href), ['/korea', '/korea/analysis', '/korea/itinerary', '/korea/tools', '/korea/prepare']);
});

test('a country split into states is a hub, not a trip: overview + merged itinerary only', () => {
  const { isTrip, tabs } = tripTabs({ slug: 'japan', stats: planned, states: [{}, {}] });
  assert.equal(isTrip, false);
  assert.deepEqual(tabs.map((t) => t.href), ['/japan', '/japan/itinerary']);
});

test('a trip with nothing planned yet only offers Overview and Tools', () => {
  const { tabs } = tripTabs({ slug: 'korea', stats: { totalDays: 0, hasItinerary: false }, states: [] });
  assert.deepEqual(tabs.map((t) => t.key), ['overview', 'tools']);
});
