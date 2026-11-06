import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSuggestions, filterSuggestions, distributeSuggestions, normTitle } from '../src/utils/suggestions.ts';
import type { DayItinerary, TimelineItem } from '../src/types/itinerary';

const it = (title: string, o: Partial<TimelineItem> = {}): TimelineItem => ({
  time: '09:00', title, description: '', location: { name: title, mapsUrl: '' }, price: { amount: 0, currency: 'JPY' }, note: '', ...o,
});
const d = (items: TimelineItem[], city = ''): DayItinerary => ({ day: 1, title: 'Day 1', date: '2025-03-01', items, ...(city ? { city } : {}) });

const trips = [
  { slug: 't1', cities: ['Tokyo'], itinerary: [d([it('Senso-ji Temple', { time: '09:00', price: { amount: 500, currency: 'JPY' } }), it('Ramen Ichiran', { time: '12:30' })])] },
  { slug: 't2', cities: ['Tokyo'], itinerary: [d([it('senso ji temple!', { time: '10:00', price: { amount: 700, currency: 'JPY' } })]), d([it('Senso-ji Temple')])] },
  { slug: 't3', cities: ['Osaka'], itinerary: [d([it('Dotonbori', { city: 'Osaka' }), it('Senso-ji Temple')], 'Tokyo')] },
];

test('titles normalise across case, accents and punctuation', () => {
  assert.equal(normTitle('Senso-ji Temple!'), normTitle('senso ji temple'));
  assert.equal(normTitle('Café Étoile'), 'cafe etoile');
});

test('a place counts once per trip, however often it appears, and the most used comes first', () => {
  const list = buildSuggestions(trips);
  const senso = list.find((s) => normTitle(s.title) === 'senso ji temple' && s.city === 'Tokyo')!;
  assert.equal(senso.count, 3, 't1, t2 (twice, one trip) and t3 whose day city is Tokyo');
  assert.equal(list[0].key, senso.key);
  assert.equal(senso.price, 600, 'median of 500 and 700');
  assert.equal(senso.currency, 'JPY');
  assert.match(senso.time, /^\d\d:\d\d$/, 'a typical time is derived');
  assert.equal(senso.category, 'sightseeing');
});

test('the city comes from the activity, then its day, then the trip', () => {
  const list = buildSuggestions(trips);
  assert.equal(list.find((s) => s.title === 'Dotonbori')!.city, 'Osaka');
  assert.equal(list.find((s) => s.title === 'Ramen Ichiran')!.city, 'Tokyo');
});

test('filter by text, city and category', () => {
  const list = buildSuggestions(trips);
  assert.deepEqual(filterSuggestions(list, { q: 'ramen' }).map((s) => s.title), ['Ramen Ichiran']);
  assert.ok(filterSuggestions(list, { city: 'osaka' }).every((s) => s.city === 'Osaka'));
  assert.ok(filterSuggestions(list, { category: 'food' }).every((s) => s.category === 'food'));
  assert.equal(filterSuggestions(list, { limit: 1 }).length, 1);
});

test('picks are spread round-robin over the days and ordered by time inside a day', () => {
  const list = buildSuggestions(trips);
  const picks = list.slice(0, 3);
  const placed = distributeSuggestions(picks, ['2026-01-01', '2026-01-02']);
  assert.equal(placed.length, 3);
  assert.equal(placed.filter((p) => p.date === '2026-01-01').length, 2);
  assert.equal(placed.filter((p) => p.date === '2026-01-02').length, 1);
  for (const date of ['2026-01-01', '2026-01-02']) {
    const times = placed.filter((p) => p.date === date).map((p) => p.time).filter(Boolean);
    assert.deepEqual(times, [...times].sort());
  }
  assert.deepEqual(distributeSuggestions([], ['2026-01-01']), []);
  assert.deepEqual(distributeSuggestions(picks, []), []);
});
