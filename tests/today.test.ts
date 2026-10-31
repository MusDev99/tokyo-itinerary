import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMinutes, formatUntil, itemKey, liveKey, localNow, MAX_DELAY, parseLive, pickToday, todayIndex, type TodayTrip } from '../src/utils/today.ts';

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

// ---- Live day ----
const key = (time: string, title: string) => itemKey({ time, title });

test('done and skipped activities leave now / next / later and count towards progress', () => {
  const live = { delay: 0, status: { [key('9:00 AM', 'Senso-ji')]: 'done' as const, [key('11.00 AM', 'Skytree')]: 'skipped' as const } };
  const v = pickToday([trip], '2026-10-18', 10 * 60 + 30, live)!;
  assert.equal(v.current, null, 'a done activity is no longer "now"');
  assert.equal(v.next?.title, 'Lunch', 'skipped Skytree is jumped over');
  assert.equal(v.done, 1);
  assert.equal(v.remaining.length, 4);
  assert.equal(v.all.find((i) => i.title === 'Skytree')?.status, 'skipped');
});

test('running late shifts only what is left, and keeps the planned time', () => {
  const live = { delay: 30, status: { [key('9:00 AM', 'Senso-ji')]: 'done' as const } };
  const v = pickToday([trip], '2026-10-18', 10 * 60 + 40, live)!;
  assert.equal(v.next?.title, 'Skytree');
  assert.equal(v.next?.planned, 11 * 60);
  assert.equal(v.next?.start, 11 * 60 + 30);
  assert.equal(v.minutesUntilNext, 50);
  assert.equal(v.all.find((i) => i.title === 'Senso-ji')?.start, 9 * 60, 'done activity keeps its planned time');
  assert.equal(v.delay, 30);
});

test('running late can keep the current activity going', () => {
  // 11:10 with Skytree pushed to 11:30: Senso-ji (now 9:30) is still the current one
  const v = pickToday([trip], '2026-10-18', 11 * 60 + 10, { delay: 30, status: {} })!;
  assert.equal(v.current?.title, 'Senso-ji');
  assert.equal(v.next?.title, 'Skytree');
});

test('when everything is checked in, the day is done and tomorrow is offered', () => {
  const status = Object.fromEntries(trip.days[1].items.map((i) => [itemKey(i), 'done' as const]));
  const v = pickToday([trip], '2026-10-18', 8 * 60, { delay: 0, status })!;
  assert.equal(v.next, null);
  assert.equal(v.current, null);
  assert.equal(v.tomorrow?.title, 'Shibuya');
  assert.equal(v.done, 6, 'only timed activities count');
});

test('saved live state is parsed defensively', () => {
  assert.deepEqual(parseLive(null), { delay: 0, status: {} });
  assert.deepEqual(parseLive('not json'), { delay: 0, status: {} });
  assert.deepEqual(parseLive(JSON.stringify({ delay: 99999, status: { a: 'done', b: 'nope', c: 'skipped' } })), { delay: MAX_DELAY, status: { a: 'done', c: 'skipped' } });
  assert.equal(parseLive(JSON.stringify({ delay: -5 })).delay, 0);
  assert.equal(liveKey('/Japan/Tokyo', '2026-10-18'), 'live:/japan/tokyo:2026-10-18');
});

test('formatMinutes', () => {
  assert.equal(formatMinutes(11 * 60 + 30), '11:30 AM');
  assert.equal(formatMinutes(0), '12:00 AM');
  assert.equal(formatMinutes(23 * 60 + 50 + 30), '12:20 AM', 'wraps past midnight');
});
