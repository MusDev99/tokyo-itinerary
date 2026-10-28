import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChecklist, dueStatus, parseSaved, progress, storageKey, type CheckItem } from '../src/utils/checklist.ts';
import type { DayItinerary } from '../src/types/itinerary.ts';

const item = (title: string, extra: Record<string, unknown> = {}) => ({
  time: '09:00', title, description: '', location: { name: title, mapsUrl: '' }, price: { amount: 0, currency: 'JPY' }, note: '', ...extra,
});
const itinerary: DayItinerary[] = [
  { day: 1, title: 'Arrive', date: '2026-11-01', items: [item('Check in Hotel Gracery', { id: 'a1', category: 'lodging' }), item('Senso-ji Temple')] },
  { day: 2, title: 'Onsen', date: '2026-11-02', items: [item('Hakone onsen day trip'), item('Shinkansen to Kyoto', { id: 'b2', category: 'transport', price: { amount: 14000, currency: 'JPY' } })] },
];
const trip = { country: 'Japan', currency: 'JPY', season: 'Autumn Season', itinerary, firstDate: '2026-11-01', lastDate: '2026-11-02', totalLocalCost: 14000 };
const ids = (groups: ReturnType<typeof buildChecklist>) => groups.flatMap((g) => g.items.map((i) => i.id));

test('checklist is grouped and personalised from the trip data', () => {
  const groups = buildChecklist(trip);
  const all = ids(groups);
  assert.deepEqual(groups.map((g) => g.id), ['documents', 'money', 'connect', 'packing', 'faith', 'bookings']);
  for (const id of ['passport', 'cash', 'budget', 'jp-ic', 'jp-plug', 'season-autumn', 'act-onsen', 'act-modest', 'act-rail']) assert.ok(all.includes(id), id);
  assert.ok(!all.includes('season-winter'), 'only the trip season');
  assert.ok(!all.includes('act-beach'), 'no beach items without a beach');
  const labels = groups.flatMap((g) => g.items.map((i) => i.label)).join('\n');
  assert.match(labels, /Some JPY cash/);
  assert.match(labels, /Planned spend: 14,000 JPY/);
  assert.match(labels, /Confirm stay: Check in Hotel Gracery/);
  assert.match(labels, /Book \/ buy: Shinkansen to Kyoto/);
  assert.doesNotMatch(labels, /Senso-ji/, 'free sightseeing is not a booking');
});

test('ids are unique and stable between renders (ticks stay matched)', () => {
  const a = ids(buildChecklist(trip));
  assert.equal(new Set(a).size, a.length);
  assert.deepEqual(a, ids(buildChecklist(structuredClone(trip))));
});

test('other countries get the generic list without Japan extras', () => {
  const all = ids(buildChecklist({ ...trip, country: 'Turkey', currency: 'TRY', season: undefined, itinerary: [] }));
  assert.ok(all.includes('visa') && !all.includes('jp-ic') && !all.some((i) => i.startsWith('book-')));
});

test('due status counts down to each item lead time', () => {
  const visa: CheckItem = { id: 'v', group: 'documents', label: 'Visa', leadDays: 30 };
  const now = new Date('2026-10-20T10:00:00');
  assert.deepEqual(dueStatus(visa, '2026-11-01', now), { kind: 'overdue', days: -18 });
  assert.deepEqual(dueStatus({ ...visa, leadDays: 7 }, '2026-11-01', now), { kind: 'soon', days: 5 });
  assert.deepEqual(dueStatus({ ...visa, leadDays: 1 }, '2026-12-01', now), { kind: 'later', days: 41 });
  assert.equal(dueStatus({ ...visa, leadDays: undefined }, '2026-11-01', now), null);
  assert.equal(dueStatus(visa, '2026-10-01', now), null, 'no nagging once the trip started');
  assert.equal(dueStatus(visa, null, now), null);
});

test('saved state from device storage is parsed defensively', () => {
  assert.deepEqual(parseSaved(null), { done: [], custom: [] });
  assert.deepEqual(parseSaved('not json'), { done: [], custom: [] });
  assert.deepEqual(parseSaved('{"done":["a",1,null],"custom":[{"id":"c1","label":"  Omiyage  "},{"id":2},{"id":"c3","label":"   "}]}'), {
    done: ['a'],
    custom: [{ id: 'c1', label: 'Omiyage' }],
  });
  assert.equal(parseSaved(JSON.stringify({ custom: [{ id: 'x', label: 'y'.repeat(500) }] })).custom[0].label.length, 120);
  assert.equal(storageKey(' Japan - Tokyo '), 'checklist:japan - tokyo');
});

test('progress only counts items that still exist', () => {
  const groups = buildChecklist(trip);
  const total = ids(groups).length;
  assert.deepEqual(progress(groups, { done: ['passport', 'gone-item'], custom: [{ id: 'c1', label: 'x' }] }), { done: 1, total: total + 1 });
});
