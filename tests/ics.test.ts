import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, escapeText, foldLine, zonedToUtc } from '../src/utils/ics.ts';
import { dayRouteUrl, MAX_ROUTE_STOPS } from '../src/utils/mapsRoute.ts';
import { parseClockTime } from '../src/utils/calendar.ts';

const item = (over: Record<string, unknown> = {}) => ({
  time: '09:00',
  title: 'Activity',
  description: '',
  location: { name: 'Activity', mapsUrl: '' },
  price: { amount: 0, currency: 'JPY' },
  note: '',
  ...over,
});

const day = (items: ReturnType<typeof item>[], date = 'October 17, 2026', extra: Record<string, unknown> = {}) => ({ day: 1, title: 'Day', date, items, ...extra });
const now = new Date(Date.UTC(2026, 9, 1, 12, 0));
// Unfold continuation lines first, as a calendar app does
const events = (ics: string) => ics.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1);
const field = (ev: string, name: string) => ev.split('\r\n').find((l) => l.startsWith(`${name}:`))?.slice(name.length + 1);

test('parseClockTime reads 24h and 12h sheet times', () => {
  assert.deepEqual(parseClockTime('14:50'), { h: 14, m: 50 });
  assert.deepEqual(parseClockTime('2:50 PM'), { h: 14, m: 50 });
  assert.deepEqual(parseClockTime('12:05 am'), { h: 0, m: 5 });
  assert.deepEqual(parseClockTime('12:30 PM'), { h: 12, m: 30 });
  assert.deepEqual(parseClockTime('11.00 AM'), { h: 11, m: 0 }, 'dot separator seen in real sheets');
  assert.equal(parseClockTime('13:00 PM'), null);
  assert.equal(parseClockTime('25:00'), null);
  assert.equal(parseClockTime('noon'), null);
});

test('zonedToUtc converts wall time in a zone to the right instant', () => {
  assert.equal(zonedToUtc(2026, 9, 17, 14, 50, 'Asia/Tokyo').toISOString(), '2026-10-17T05:50:00.000Z');
  assert.equal(zonedToUtc(2026, 9, 17, 8, 0, 'Asia/Makassar').toISOString(), '2026-10-17T00:00:00.000Z');
  // New York switches to EST on 2026-11-01: same wall time, different offset either side
  assert.equal(zonedToUtc(2026, 9, 31, 12, 0, 'America/New_York').toISOString(), '2026-10-31T16:00:00.000Z');
  assert.equal(zonedToUtc(2026, 10, 2, 12, 0, 'America/New_York').toISOString(), '2026-11-02T17:00:00.000Z');
});

test('text is escaped and long lines are folded at 75 octets without breaking UTF-8', () => {
  assert.equal(escapeText('a,b;c\\d\nnext'), 'a\\,b\\;c\\\\d\\nnext');
  const folded = foldLine('SUMMARY:' + '浅草寺'.repeat(20));
  for (const l of folded.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(folded.replace(/\r\n /g, ''), 'SUMMARY:' + '浅草寺'.repeat(20));
});

test('a trip becomes one event per timed activity, in the trip timezone', () => {
  const ics = buildCalendar({
    name: 'Japan – Tokyo trip',
    now,
    url: 'https://example.test/japan/tokyo',
    timezoneFor: () => 'Asia/Tokyo',
    days: [day([
      item({ id: 'abc', time: '2:50 PM', title: 'Depart, KUL', location: { name: 'KUL Airport', mapsUrl: 'https://maps.example/kul' }, price: { amount: 1200, currency: 'MYR' } }),
      item({ time: '9:00 PM', title: 'Hotel check-in', location: { name: 'Hotel check-in', mapsUrl: '' } }),
      item({ time: 'later', title: 'No time' }),
    ])],
  });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('X-WR-CALNAME:Japan – Tokyo trip'));
  const [first, second, ...rest] = events(ics);
  assert.equal(rest.length, 0, 'activities without a readable time are skipped');
  assert.equal(field(first, 'UID'), 'abc@plantravel');
  assert.equal(field(first, 'DTSTART'), '20261017T055000Z');
  assert.equal(field(first, 'DTEND'), '20261017T085000Z', 'runs until the next activity, capped at 3h');
  assert.equal(field(first, 'SUMMARY'), 'Depart\\, KUL');
  assert.equal(field(first, 'LOCATION'), 'KUL Airport');
  assert.match(field(first, 'DESCRIPTION') || '', /Price: 1\\,200 MYR\\nMap: https:\/\/maps\.example\/kul\\nTrip: https:\/\/example\.test\/japan\/tokyo/);
  assert.equal(field(first, 'DTSTAMP'), '20261001T120000Z');
  assert.equal(field(second, 'DTSTART'), '20261017T120000Z');
  assert.equal(field(second, 'DTEND'), '20261017T130000Z', 'last activity of the day lasts 1h');
  assert.equal(field(second, 'LOCATION'), undefined, 'no LOCATION when it only repeats the title');
});

test('without a timezone, times are floating so they show at the same clock time anywhere', () => {
  const ics = buildCalendar({ name: 'Trip', now, days: [day([item({ time: '23:30' })], '2026-10-17')] });
  const [ev] = events(ics);
  assert.equal(field(ev, 'DTSTART'), '20261017T233000');
  assert.equal(field(ev, 'DTEND'), '20261018T003000', 'crosses midnight correctly');
});

test('UIDs are stable for rows without an id, and an unknown timezone falls back to floating', () => {
  const build = () => buildCalendar({ name: 'T', now, timezoneFor: () => 'Not/AZone', days: [day([item({ tab: 'Japan - Tokyo', row: 7 })])] });
  assert.equal(field(events(build())[0], 'UID'), field(events(build())[0], 'UID'));
  assert.equal(field(events(build())[0], 'DTSTART'), '20261017T090000');
});

test('day route goes through the stops in order and searches near the trip region', () => {
  const r = dayRouteUrl([
    item({ location: { name: 'Narita Airport', mapsUrl: '' } }),
    item({ location: { name: 'Senso-ji', mapsUrl: '' } }),
    item({ location: { name: 'Senso-ji', mapsUrl: '' } }),
    item({ location: { name: 'Tokyo Skytree', mapsUrl: '' } }),
    item({ location: { name: 'Kuala Lumpur International Airport Terminal 2', mapsUrl: '' } }),
  ], 'Tokyo')!;
  assert.equal(r.stops, 4, 'back-to-back duplicates are one stop');
  const u = new URL(r.url);
  assert.equal(u.origin + u.pathname, 'https://www.google.com/maps/dir/');
  assert.equal(u.searchParams.get('origin'), 'Narita Airport, Tokyo');
  assert.equal(u.searchParams.get('waypoints'), 'Senso-ji, Tokyo|Tokyo Skytree', 'region not repeated when already in the name');
  assert.equal(u.searchParams.get('destination'), 'Kuala Lumpur International Airport Terminal 2', 'specific names are left alone');
});

test('day route: one stop is a search, none is null, long days are capped', () => {
  assert.equal(dayRouteUrl([]), null);
  assert.match(dayRouteUrl([item({ location: { name: 'Senso-ji', mapsUrl: '' } })])!.url, /maps\/search\/\?api=1&query=Senso-ji/);
  const many = Array.from({ length: 14 }, (_, i) => item({ location: { name: `Stop ${i}`, mapsUrl: '' } }));
  const r = dayRouteUrl(many)!;
  assert.equal(r.stops, MAX_ROUTE_STOPS);
  assert.equal(r.skipped, 3);
  assert.equal(new URL(r.url).searchParams.get('waypoints')!.split('|').length, 9);
});
