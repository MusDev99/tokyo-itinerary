import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatUntil, localNow, pickToday, todayIndex, type TodayTrip } from '../src/utils/today.ts';

const trip: TodayTrip = {
  name: 'Tokyo, Japan',
  flag: '🇯🇵',
  href: '/japan/tokyo',
  region: 'Tokyo',
  days: [
    { day: 1, title: 'Arrival', date: 'October 17, 2026', items: [{ time: '9:00 PM', title: 'Hotel' }] },
    {
      day: 2,
      title: 'Asakusa',
      date: '2026-10-18',
      items: [
        // Deliberately out of order, with one unreadable time
        { time: '13:00', title: 'Lunch' },
        { time: '9:00 AM', title: 'Senso-ji', place: 'Senso-ji Temple' },
        { time: 'whenever', title: 'Souvenirs' },
        { time: '11.00 AM', title: 'Skytree' },
        { time: '6:00 PM', title: 'Dinner' },
        { time: '8:00 PM', title: 'Night walk' },
        { time: '9:30 PM', title: 'Back to hotel' },
      ],
    },
    { day: 3, title: 'Shibuya', date: '2026-10-19', items: [{ time: '10:00', title: 'Crossing' }] },
  ],
};

test('localNow uses the device calendar and clock', () => {
  assert.deepEqual(localNow(new Date(2026, 9, 18, 13, 5)), { iso: '2026-10-18', minutes: 785 });
});

test('todayIndex matches ISO and sheet-style dates', () => {
  assert.equal(todayIndex(trip.days, '2026-10-17'), 0);
  assert.equal(todayIndex(trip.days, '2026-10-19'), 2);
  assert.equal(todayIndex(trip.days, '2026-10-20'), -1);
});

test('before the first activity: nothing current, next is the earliest, up to 3 later', () => {
  const v = pickToday([trip], '2026-10-18', 7 * 60)!;
  assert.equal(v.day.day, 2);
  assert.equal(v.current, null);
  assert.equal(v.next?.title, 'Senso-ji');
  assert.equal(v.minutesUntilNext, 120);
  assert.deepEqual(v.later.map((i) => i.title), ['Skytree', 'Lunch', 'Dinner']);
  assert.equal(v.all.length, 6, 'unreadable times are left out');
  assert.equal(v.tomorrow, null);
});

test('during an activity: it is current until the next one starts', () => {
  const v = pickToday([trip], '2026-10-18', 10 * 60 + 30)!;
  assert.equal(v.current?.title, 'Senso-ji');
  assert.equal(v.next?.title, 'Skytree');
  assert.equal(v.minutesUntilNext, 30);
});

test('a long gap ends the current slot after 3 hours', () => {
  assert.equal(pickToday([trip], '2026-10-18', 15 * 60)!.current?.title, 'Lunch');
  assert.equal(pickToday([trip], '2026-10-18', 16 * 60 + 1)!.current, null);
});

test('after the last activity starts: no next, tomorrow is offered', () => {
  const v = pickToday([trip], '2026-10-18', 22 * 60)!;
  assert.equal(v.next, null);
  assert.equal(v.current?.title, 'Back to hotel');
  assert.equal(v.tomorrow?.title, 'Shibuya');
  assert.equal(pickToday([trip], '2026-10-19', 23 * 60)!.tomorrow, null, 'last trip day has no tomorrow');
});

test('no trip day today means no Today card', () => {
  assert.equal(pickToday([trip], '2026-10-25', 600), null);
  assert.equal(pickToday([], '2026-10-18', 600), null);
});

test('formatUntil', () => {
  assert.equal(formatUntil(0), 'now');
  assert.equal(formatUntil(25), 'in 25 min');
  assert.equal(formatUntil(60), 'in 1 h');
  assert.equal(formatUntil(65), 'in 1 h 5 min');
});
