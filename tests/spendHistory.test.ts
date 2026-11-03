import test from 'node:test';
import assert from 'node:assert/strict';
import { donutArcs, groupSpendByDay, shortDate, type SpendLine } from '../src/utils/spendHistory.ts';

test('donutArcs: slices plus gaps fill the circle exactly', () => {
  const { circumference, arcs } = donutArcs([50, 30, 20], 48, 14);
  assert.equal(arcs.length, 3);
  const used = arcs.reduce((a, x) => a + x.len, 0) + 3 * 14;
  assert.ok(Math.abs(used - circumference) < 1e-6);
  assert.ok(Math.abs(arcs.reduce((a, x) => a + x.share, 0) - 1) < 1e-9);
});

test('donutArcs: one slice is a full ring with no gap', () => {
  const { circumference, arcs } = donutArcs([120], 48, 14);
  assert.ok(Math.abs(arcs[0].len - circumference) < 1e-6);
});

test('donutArcs: zero, negative and NaN values get no slice; all-empty is safe', () => {
  const { arcs } = donutArcs([10, 0, -5, Number.NaN, 10], 40, 10);
  assert.deepEqual(arcs.map((a) => a.len > 0), [true, false, false, false, true]);
  assert.deepEqual(donutArcs([], 40, 10).arcs, []);
  assert.deepEqual(donutArcs([0, 0], 40, 10).arcs.map((a) => a.len), [0, 0]);
});

test('donutArcs: a tiny slice stays visible', () => {
  const { arcs } = donutArcs([1000, 1], 48, 14);
  assert.ok(arcs[1].len >= 0.5);
});

const line = (o: Partial<SpendLine>): SpendLine => ({
  id: 'x', dayKey: 'japan|1', day: 1, country: 'japan', date: 'October 17, 2026', time: '09:00', title: 't', description: '',
  converted: 10, currency: 'JPY', amount: 1000, categoryKey: 'food', ...o,
});

test('groupSpendByDay: groups by day in order, totals them, drops free lines and empty days', () => {
  const g = groupSpendByDay([
    line({ id: 'a', converted: 10 }),
    line({ id: 'b', converted: 5.5 }),
    line({ id: 'c', converted: 0 }),
    line({ id: 'd', dayKey: 'japan|2', day: 2, converted: 0 }),
    line({ id: 'e', dayKey: 'japan|3', day: 3, converted: 7 }),
  ]);
  assert.deepEqual(g.map((x) => [x.day, x.total, x.lines.map((l) => l.id)]), [[1, 15.5, ['a', 'b']], [3, 7, ['e']]]);
});

test('shortDate: readable dates get a weekday, others stay as typed', () => {
  assert.match(shortDate('October 17, 2026'), /^Sat, Oct 17$/);
  assert.equal(shortDate('Day one'), 'Day one');
  assert.equal(shortDate(''), '');
});
