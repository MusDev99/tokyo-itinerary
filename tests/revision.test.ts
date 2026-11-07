import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fnv1a, activityRevision, pocketRevision, tripRevision, ACTIVITY_REVISION_COLUMNS } from '../src/utils/revision.ts';

const row = (over: Record<string, string> = {}) => (c: string) => ({ date: '2025-03-01', time: '09:00', title: 'Senso-ji', price_amount: '0', ...over } as Record<string, string>)[c] ?? '';

test('same fields give the same revision; any edited field changes it', () => {
  const base = activityRevision(row());
  assert.equal(activityRevision(row()), base);
  for (const col of ACTIVITY_REVISION_COLUMNS) {
    assert.notEqual(activityRevision(row({ [col]: 'changed' })), base, col);
  }
});

test('surrounding spaces do not count as a change; moving text between fields does', () => {
  assert.equal(activityRevision(row({ title: ' Senso-ji  ' })), activityRevision(row()));
  assert.notEqual(activityRevision(row({ title: 'A', description: 'B' })), activityRevision(row({ title: 'AB', description: '' })));
  assert.notEqual(activityRevision(row({ title: 'A', description: 'B' })), activityRevision(row({ title: 'B', description: 'A' })));
});

test('fnv1a is stable and spreads small differences', () => {
  assert.equal(fnv1a('abc'), fnv1a('abc'));
  assert.notEqual(fnv1a('abc'), fnv1a('abd'));
  assert.equal(fnv1a(''), fnv1a(''));
});

test('pocket revision ignores key order in details and the ids/audit fields', () => {
  const a = { kind: 'flight', title: 'GA 874', details: { airline: 'Garuda', seat: '12A' }, id: '1', createdBy: 'x', createdAt: 'y' };
  const b = { kind: 'flight', title: 'GA 874', details: { seat: '12A', airline: 'Garuda' }, id: '2', createdBy: 'z', createdAt: 'w' };
  assert.equal(pocketRevision(a), pocketRevision(b));
  assert.notEqual(pocketRevision(a), pocketRevision({ ...a, details: { airline: 'Garuda', seat: '12B' } }));
  assert.notEqual(pocketRevision(a), pocketRevision({ ...a, done: true }));
});

test('trip revision covers title, dates and cities (in date order)', () => {
  const t = { title: 'Japan 2025', start: '2025-03-01', end: '2025-03-07', stops: [{ city: 'Osaka', start: '2025-03-05', end: '2025-03-07' }, { city: 'Tokyo', start: '2025-03-01', end: '2025-03-04' }] };
  const same = { ...t, stops: [...t.stops].reverse() };
  assert.equal(tripRevision(t), tripRevision(same));
  assert.notEqual(tripRevision(t), tripRevision({ ...t, title: 'Japan 2026' }));
  assert.notEqual(tripRevision(t), tripRevision({ ...t, end: '2025-03-08' }));
  assert.notEqual(tripRevision(t), tripRevision({ ...t, stops: [t.stops[1]] }));
});
