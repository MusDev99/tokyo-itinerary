import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addMonths, clampIso, dateForKey, formatLongDate, formatMonthYear, isOutOfRange,
  monthGrid, parseIso, todayIso, toIso, toIsoDate, weekday, weekdayLabels,
} from '../src/utils/calendar.ts';

test('parseIso accepts real dates only', () => {
  assert.deepEqual(parseIso('2026-10-25'), { year: 2026, month: 9, day: 25 });
  assert.deepEqual(parseIso(' 2024-02-29 '), { year: 2024, month: 1, day: 29 });
  assert.equal(parseIso('2026-02-30'), null);
  assert.equal(parseIso('2025-02-29'), null);
  assert.equal(parseIso('2026-13-01'), null);
  assert.equal(parseIso('October 25, 2026'), null);
  assert.equal(parseIso(''), null);
});

test('toIso normalises overflow', () => {
  assert.equal(toIso(2026, 11, 32), '2027-01-01');
  assert.equal(toIso(2026, 0, 0), '2025-12-31');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-25', 7), '2026-11-01');
  assert.equal(addDays('bad', 1), 'bad');
});

test('addMonths clamps to the last day of the target month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
});

test('weekday is 0 for Sunday', () => {
  assert.equal(weekday('2026-10-25'), 0);
  assert.equal(weekday('2026-10-26'), 1);
});

test('monthGrid always has 42 cells starting on the requested weekday', () => {
  // October 2026 starts on a Thursday
  const sun = monthGrid(2026, 9, 0);
  assert.equal(sun.length, 42);
  assert.equal(sun[0].iso, '2026-09-27');
  assert.equal(sun[0].inMonth, false);
  assert.equal(sun[4].iso, '2026-10-01');
  assert.equal(sun[4].inMonth, true);
  assert.equal(sun.filter((c) => c.inMonth).length, 31);

  const mon = monthGrid(2026, 9, 1);
  assert.equal(mon[0].iso, '2026-09-28');
  assert.equal(weekday(mon[0].iso), 1);

  // A month that starts on the week's first day has no leading cells
  assert.equal(monthGrid(2026, 1, 0)[0].iso, '2026-02-01');
});

test('range helpers treat empty bounds as open', () => {
  assert.equal(isOutOfRange('2026-10-25'), false);
  assert.equal(isOutOfRange('2026-10-25', '2026-10-26'), true);
  assert.equal(isOutOfRange('2026-10-25', '', '2026-10-24'), true);
  assert.equal(isOutOfRange('2026-10-25', '2026-10-25', '2026-10-25'), false);
  assert.equal(clampIso('2026-10-01', '2026-10-10', '2026-10-20'), '2026-10-10');
  assert.equal(clampIso('2026-10-30', '2026-10-10', '2026-10-20'), '2026-10-20');
  assert.equal(clampIso('2026-10-15', '2026-10-10', '2026-10-20'), '2026-10-15');
});

test('todayIso uses the local calendar of the injected clock', () => {
  assert.equal(todayIso(new Date(2026, 9, 25, 23, 59)), '2026-10-25');
  assert.equal(todayIso(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

test('formatting does not shift the day by timezone', () => {
  assert.equal(formatLongDate('2026-10-25'), 'Sun, 25 Oct 2026');
  assert.equal(formatLongDate('nope'), '');
  assert.equal(formatMonthYear(2026, 9), 'October 2026');
  assert.deepEqual(weekdayLabels(0), ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  assert.equal(weekdayLabels(1)[0], 'Mon');
});

test('toIsoDate reads ISO and legacy sheet dates without shifting the day', () => {
  assert.equal(toIsoDate('2026-10-17'), '2026-10-17');
  assert.equal(toIsoDate('October 17, 2026'), '2026-10-17');
  assert.equal(toIsoDate(''), '');
  assert.equal(toIsoDate('not a date'), '');
});

test('dateForKey follows the date-grid keyboard pattern', () => {
  const d = '2026-10-28'; // Wednesday
  assert.equal(dateForKey('ArrowLeft', d), '2026-10-27');
  assert.equal(dateForKey('ArrowRight', d), '2026-10-29');
  assert.equal(dateForKey('ArrowUp', d), '2026-10-21');
  assert.equal(dateForKey('ArrowDown', d), '2026-11-04');
  assert.equal(dateForKey('Home', d), '2026-10-25');
  assert.equal(dateForKey('End', d), '2026-10-31');
  assert.equal(dateForKey('Home', d, false, 1), '2026-10-26', 'Monday-first week');
  assert.equal(dateForKey('PageUp', '2026-03-31'), '2026-02-28');
  assert.equal(dateForKey('PageDown', d, true), '2027-10-28');
  assert.equal(dateForKey('Tab', d), null);
});
