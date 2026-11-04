import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateTripName, validateRange, buildDays, nextFreeDay, isIsoDate, addDays, dayLabel, suggestNextTime, MAX_TRIP_DAYS,
} from '../src/utils/tripDraft.ts';

test('trip name rules mirror the server tab rules', () => {
  assert.deepEqual(validateTripName('Japan', 'Tokyo'), {});
  assert.equal(validateTripName('', 'Tokyo').country, 'Country is required');
  assert.match(validateTripName('Japan', 'To:kyo').state!, /Can't contain/);
  assert.match(validateTripName('Japan - X', 'Tokyo').country!, /' - '/);
  assert.equal(validateTripName('Japan', 'API').state, 'That name is reserved');
  assert.equal(validateTripName('Japan', '!!!').state, "Can't contain [ ] * ? : / \\ ' !");
  assert.equal(validateTripName('Japan', '---').state, 'Use at least one letter or number');
});

test('isIsoDate rejects impossible dates', () => {
  assert.equal(isIsoDate('2026-11-12'), true);
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('12/11/2026'), false);
  assert.equal(isIsoDate(undefined), false);
});

test('range validation and day generation', () => {
  assert.equal(validateRange('2026-11-12', '2026-11-14'), null);
  assert.match(validateRange('2026-11-14', '2026-11-12')!, /before/);
  assert.match(validateRange('', '2026-11-12')!, /Pick/);
  assert.match(validateRange('2026-01-01', '2026-12-31')!, new RegExp(String(MAX_TRIP_DAYS)));
  assert.deepEqual(buildDays('2026-11-12', '2026-11-14'), ['2026-11-12', '2026-11-13', '2026-11-14']);
  assert.deepEqual(buildDays('2026-11-14', '2026-11-12'), []);
  assert.deepEqual(buildDays('2026-11-12', '2026-11-12'), ['2026-11-12']);
});

test('addDays crosses month and year ends', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('nextFreeDay picks the first empty day, else the day after the last', () => {
  const days = ['2026-11-12', '2026-11-13', '2026-11-14'];
  assert.equal(nextFreeDay(days, ['2026-11-12']), '2026-11-13');
  assert.equal(nextFreeDay(days, ['2026-11-12', '2026-11-14']), '2026-11-13');
  assert.equal(nextFreeDay(days, days), '2026-11-15');
  assert.equal(nextFreeDay([], []), '');
  assert.equal(nextFreeDay([], ['2026-05-01']), '2026-05-02');
});

test('dayLabel falls back to the day number', () => {
  assert.equal(dayLabel(0), 'Day 1');
  assert.equal(dayLabel(1, '  '), 'Day 2');
  assert.equal(dayLabel(1, 'Shibuya'), 'Shibuya');
});

test('suggestNextTime continues from the previous item', () => {
  assert.equal(suggestNextTime(), '09:00');
  assert.equal(suggestNextTime('09:00'), '10:00');
  assert.equal(suggestNextTime('23:45'), '23:30');
  assert.equal(suggestNextTime('bad'), '09:00');
});
