import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backTarget, hasSiteHistory } from '../src/utils/backTarget.ts';

const parents = { 'china-guangzhou': '/china', 'japan-tokyo': '/japan', korea: '/' };

test('a trip goes up to its country page, never to /trips (which is not a page)', () => {
  assert.equal(backTarget('/trips/china-guangzhou', parents), '/china');
  assert.equal(backTarget('/trips/japan-tokyo/', parents), '/japan');
  assert.equal(backTarget('/trips', parents), '/');
  assert.equal(backTarget('/trips/', parents), '/');
});

test('a plain-country trip goes home (its country page would redirect straight back); unknown trips go home', () => {
  assert.equal(backTarget('/trips/korea', parents), '/');
  assert.equal(backTarget('/trips/no-such-trip', parents), '/');
  assert.equal(backTarget('/trips/korea/pocket', parents), '/');
});

test('trip tabs go up to the country like the itinerary; the client page goes to the trip', () => {
  for (const tab of ['overview', 'analysis', 'pocket']) assert.equal(backTarget(`/trips/china-guangzhou/${tab}`, parents), '/china', tab);
  assert.equal(backTarget('/trips/china-guangzhou/share', parents), '/trips/china-guangzhou');
  assert.equal(backTarget('/trips/china-guangzhou/calendar.ics', parents), '/trips/china-guangzhou');
});

test('other pages go up one segment, home stays home, query and hash are ignored', () => {
  assert.equal(backTarget('/china/itinerary', parents), '/china');
  assert.equal(backTarget('/china', parents), '/');
  assert.equal(backTarget('/add', parents), '/');
  assert.equal(backTarget('/privacy', parents), '/');
  assert.equal(backTarget('/', parents), '/');
  assert.equal(backTarget('', parents), '/');
  assert.equal(backTarget('/trips/japan-tokyo?x=1#top', parents), '/japan');
});

test('site history: the router index wins; without it the same-site referrer counts', () => {
  const origin = 'https://plan.example';
  assert.equal(hasSiteHistory({ index: 2 }, '', origin, 3), true);   // soft navigated here, referrer is stale/empty
  assert.equal(hasSiteHistory({ index: 0 }, 'https://plan.example/', origin, 3), false); // first page of the visit
  assert.equal(hasSiteHistory(null, 'https://plan.example/china', origin, 3), true);     // full page loads
  assert.equal(hasSiteHistory(null, 'https://google.com/', origin, 3), false);
  assert.equal(hasSiteHistory(null, '', origin, 3), false);
  assert.equal(hasSiteHistory(null, 'https://plan.example/', origin, 1), false);
  assert.equal(hasSiteHistory(undefined, 'not a url', origin, 3), false);
});
