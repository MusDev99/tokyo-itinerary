import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planCopy, copyKey } from '../src/utils/tripCopy.ts';
import type { DayItinerary, TimelineItem } from '../src/types/itinerary';

const item = (id: string, title: string, extra: Partial<TimelineItem> = {}): TimelineItem => ({
  id, time: '09:00', title, description: 'd', location: { name: title, mapsUrl: '' }, price: { amount: 0, currency: 'JPY' }, note: 'private note', ...extra,
});
const day = (n: number, date: string, items: TimelineItem[], extra: Partial<DayItinerary> = {}): DayItinerary => ({ day: n, title: `Day ${n}`, date, items, ...extra });

const source: DayItinerary[] = [
  day(1, '2025-03-01', [item('a', 'Senso-ji', { price: { amount: 500, currency: 'JPY', notes: 'ticket' }, city: 'Tokyo' })], { title: 'Arrival' , city: 'Tokyo' }),
  day(2, '2025-03-02', [item('b', 'Ramen'), item('c', 'Shibuya')], { city: 'Tokyo' }),
  day(5, '2025-03-05', [item('d', 'Dotonbori', { city: 'Osaka' })], { city: 'Osaka' }),
];

test('whole trip: the first day lands on the new start and spacing is kept', () => {
  const plan = planCopy(source, '2026-05-10');
  assert.ok(!('error' in plan));
  if ('error' in plan) return;
  assert.deepEqual(plan.activities.map((a) => a.date), ['2026-05-10', '2026-05-11', '2026-05-11', '2026-05-14']);
  assert.equal(plan.start, '2026-05-10');
  assert.equal(plan.end, '2026-05-14');
  assert.equal(plan.days, 5);
});

test('prices, day titles and cities are copied; notes never are; default day titles are dropped', () => {
  const plan = planCopy(source, '2026-05-10');
  if ('error' in plan) throw new Error(plan.error);
  const a = plan.activities[0];
  assert.equal(a.price_amount, 500);
  assert.equal(a.price_notes, 'ticket');
  assert.equal(a.day_title, 'Arrival');
  assert.equal(plan.activities[1].day_title, undefined);
  assert.equal(a.city, 'Tokyo');
  assert.ok(!('note' in a));
  const free = planCopy(source, '2026-05-10', { includePrices: false });
  if ('error' in free) throw new Error(free.error);
  assert.equal(free.activities[0].price_amount, null);
  assert.equal(free.activities[0].price_currency, '');
});

test('picked days: the earliest picked day is the anchor and a skipped day stays a gap', () => {
  const plan = planCopy(source, '2026-05-10', { selection: [{ date: '2025-03-02' }, { date: '2025-03-05' }] });
  if ('error' in plan) throw new Error(plan.error);
  assert.deepEqual([...new Set(plan.activities.map((a) => a.date))], ['2026-05-10', '2026-05-13']);
  assert.equal(plan.end, '2026-05-13');
});

test('picked activities inside a day', () => {
  const plan = planCopy(source, '2026-05-10', { selection: [{ date: '2025-03-02', ids: [copyKey(source[1].items[1])] }] });
  if ('error' in plan) throw new Error(plan.error);
  assert.deepEqual(plan.activities.map((a) => a.title), ['Shibuya']);
});

test('city runs merge neighbouring days and use the new dates', () => {
  const plan = planCopy(source, '2026-05-10');
  if ('error' in plan) throw new Error(plan.error);
  assert.deepEqual(plan.cityRuns, [
    { city: 'Tokyo', start: '2026-05-10', end: '2026-05-11' },
    { city: 'Osaka', start: '2026-05-14', end: '2026-05-14' },
  ]);
});

test('nothing selected is an error; rows without an id are keyed by their sheet row', () => {
  assert.ok('error' in planCopy(source, '2026-05-10', { selection: [{ date: '1999-01-01' }] }));
  assert.equal(copyKey({ row: 7 }), 'row-7');
  assert.equal(copyKey({ id: 'x', row: 7 }), 'x');
});
