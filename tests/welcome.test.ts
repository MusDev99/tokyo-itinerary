import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWelcome, worldTotals, WELCOME_STEPS, type WelcomeCheck } from '../src/utils/welcome.ts';

const guest: WelcomeCheck = {
  method: 'GET',
  signedIn: false,
  seen: undefined,
  accept: 'text/html,application/xhtml+xml',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
  purpose: null,
};

test('a first-time guest opening a page is sent to the welcome', () => {
  assert.equal(shouldShowWelcome(guest), true);
});

test('only the cookie value "1" counts as seen', () => {
  assert.equal(shouldShowWelcome({ ...guest, seen: '1' }), false);
  assert.equal(shouldShowWelcome({ ...guest, seen: '0' }), true);
  assert.equal(shouldShowWelcome({ ...guest, seen: '' }), true);
});

test('signed-in people never see it', () => {
  assert.equal(shouldShowWelcome({ ...guest, signedIn: true }), false);
});

test('non-page requests are left alone', () => {
  assert.equal(shouldShowWelcome({ ...guest, method: 'POST' }), false);
  assert.equal(shouldShowWelcome({ ...guest, accept: 'application/json' }), false);
  assert.equal(shouldShowWelcome({ ...guest, accept: null }), false);
  assert.equal(shouldShowWelcome({ ...guest, purpose: 'prefetch' }), false);
});

test('crawlers and link previews keep the real home page', () => {
  for (const ua of ['Googlebot/2.1', 'facebookexternalhit/1.1', 'Mozilla/5.0 Chrome-Lighthouse', 'HeadlessChrome/120']) {
    assert.equal(shouldShowWelcome({ ...guest, userAgent: ua }), false, ua);
  }
});

test('worldTotals counts only trips with an itinerary and ignores bad numbers', () => {
  const t = worldTotals([
    { stats: { hasItinerary: true, totalDays: 5, totalActivities: 21 } },
    { stats: { hasItinerary: true, totalDays: Number.NaN, totalActivities: -3 } },
    { stats: { hasItinerary: false, totalDays: 9, totalActivities: 9 } },
  ]);
  assert.deepEqual(t, { countries: 3, trips: 2, days: 5, activities: 21 });
  assert.deepEqual(worldTotals([]), { countries: 0, trips: 0, days: 0, activities: 0 });
});

test('there are exactly three steps with unique ids (Miller: few chunks)', () => {
  assert.equal(WELCOME_STEPS.length, 3);
  assert.equal(new Set(WELCOME_STEPS.map((s) => s.id)).size, 3);
});
