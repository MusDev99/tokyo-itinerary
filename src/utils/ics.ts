import type { DayItinerary, TimelineItem } from '../types/itinerary';
import { parseClockTime, parseIso, toIsoDate } from './calendar.ts';

/**
 * iCalendar (RFC 5545) export of a trip. Pure and dependency-free so it is unit-tested and served by a
 * public read-only endpoint that calendar apps can subscribe to.
 */

export interface CalendarInput {
  /** Calendar name shown in the calendar app, e.g. "Japan – Tokyo trip" */
  name: string;
  days: DayItinerary[];
  /** IANA zone for a day (trip's saved place); undefined = floating local time */
  timezoneFor?: (day: DayItinerary) => string | undefined;
  /** Public page of the trip, linked from every event */
  url?: string;
  /** Injected clock for DTSTAMP (tests) */
  now?: Date;
}

const MAX_MINUTES = 180; // an event runs until the next activity, at most 3h
const DEFAULT_MINUTES = 60; // last activity of the day

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** RFC 5545 TEXT escaping: backslash, semicolon, comma and newlines. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to 75 octets (continuation lines start with a space), never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines lose one octet to the leading space
    if (bytes + n > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

/** Offset of `timeZone` from UTC at `utcMs`, in minutes (e.g. Asia/Tokyo = +540). */
function zoneOffsetMinutes(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** UTC instant of a wall-clock time in `timeZone` (two passes settle DST edges). */
export function zonedToUtc(year: number, month: number, day: number, h: number, m: number, timeZone: string): Date {
  const wall = Date.UTC(year, month, day, h, m);
  let utc = wall - zoneOffsetMinutes(wall, timeZone) * 60000;
  utc = wall - zoneOffsetMinutes(utc, timeZone) * 60000;
  return new Date(utc);
}

function isValidZone(tz: string | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/** Floating (no zone) local time, from minutes after midnight of an ISO date. */
function floatingStamp(iso: string, minutes: number): string {
  const p = parseIso(iso)!;
  const d = new Date(Date.UTC(p.year, p.month, p.day, 0, minutes));
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00`;
}

/** Stable across refreshes so subscribed calendars update events instead of duplicating them. */
function uidFor(item: TimelineItem, iso: string, index: number): string {
  if (item.id) return `${item.id}@plantravel`;
  const key = `${item.tab || ''}|${item.row ?? ''}|${iso}|${item.time}|${item.title}|${index}`;
  let hash = 5381;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
  return `${hash.toString(36)}-${iso}@plantravel`;
}

function describe(item: TimelineItem, url?: string): string {
  const lines = [item.description?.trim()];
  if (item.price?.amount) lines.push(`Price: ${item.price.amount.toLocaleString('en-US')} ${item.price.currency}${item.price.notes ? ` (${item.price.notes})` : ''}`);
  if (item.note?.trim()) lines.push(`Note: ${item.note.trim()}`);
  if (item.location?.mapsUrl) lines.push(`Map: ${item.location.mapsUrl}`);
  if (url) lines.push(`Trip: ${url}`);
  return lines.filter(Boolean).join('\n');
}

export function buildCalendar({ name, days, timezoneFor, url, now = new Date() }: CalendarInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlanTravel//Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`,
    // Subscribed calendars re-check every 6 hours (Apple / Outlook honour these)
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];
  const stamp = utcStamp(now);

  for (const day of days) {
    const tz = timezoneFor?.(day);
    const zone = isValidZone(tz) ? tz : undefined;
    const timed = day.items
      .map((item, index) => {
        const iso = toIsoDate(item.date || day.date);
        const t = parseClockTime(item.time || '');
        return iso && t ? { item, index, iso, start: t.h * 60 + t.m } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.iso.localeCompare(b.iso) || a.start - b.start);

    timed.forEach(({ item, index, iso, start }, i) => {
      const next = timed[i + 1];
      const gap = next && next.iso === iso ? next.start - start : 0;
      const length = gap > 0 ? Math.min(gap, MAX_MINUTES) : DEFAULT_MINUTES;
      const p = parseIso(iso)!;
      const startStamp = zone ? utcStamp(zonedToUtc(p.year, p.month, p.day, 0, start, zone)) : floatingStamp(iso, start);
      const endStamp = zone ? utcStamp(zonedToUtc(p.year, p.month, p.day, 0, start + length, zone)) : floatingStamp(iso, start + length);
      const location = item.location?.name && item.location.name !== item.title ? item.location.name : '';
      lines.push(
        'BEGIN:VEVENT',
        `UID:${uidFor(item, iso, index)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${startStamp}`,
        `DTEND:${endStamp}`,
        `SUMMARY:${escapeText(item.title)}`,
      );
      if (location) lines.push(`LOCATION:${escapeText(location)}`);
      const description = describe(item, url);
      if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
      if (url) lines.push(`URL:${url}`);
      lines.push('END:VEVENT');
    });
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
