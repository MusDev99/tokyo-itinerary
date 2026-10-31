/**
 * Pure date helpers for CalendarPicker. Dates are ISO strings (YYYY-MM-DD) and all
 * arithmetic runs in UTC so a day never shifts with the viewer's timezone.
 */

export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toIso(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Strict YYYY-MM-DD parse; returns a 0-based month, or null for invalid dates like 2026-02-30. */
export function parseIso(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = +m[1];
  const month = +m[2] - 1;
  const day = +m[3];
  return toIso(year, month, day) === m[0] ? { year, month, day } : null;
}

/** ISO for an ISO string or a legacy sheet date like "October 17, 2026" (local parts, no UTC shift); "" otherwise. */
export function toIsoDate(value: string): string {
  if (!value?.trim()) return '';
  if (parseIso(value)) return value.trim();
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : toIso(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(iso: string, n: number): string {
  const p = parseIso(iso);
  return p ? toIso(p.year, p.month, p.day + n) : iso;
}

/** Moves by whole months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: string, n: number): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const last = new Date(Date.UTC(p.year, p.month + n + 1, 0)).getUTCDate();
  return toIso(p.year, p.month + n, Math.min(p.day, last));
}

/** Weekday of a date, 0 = Sunday. */
export function weekday(iso: string): number {
  const p = parseIso(iso);
  return p ? new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay() : 0;
}

/** Six full weeks (42 cells) covering the month, so the popover height never jumps. */
export function monthGrid(year: number, month: number, weekStartsOn = 0): CalendarCell[] {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const lead = (first - weekStartsOn + 7) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(year, month, 1 - lead + i));
    return {
      iso: toIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === ((month % 12) + 12) % 12,
    };
  });
}

/** ISO strings compare correctly as text. Empty bounds mean unbounded. */
export function isOutOfRange(iso: string, min = '', max = ''): boolean {
  return (!!min && iso < min) || (!!max && iso > max);
}

export function clampIso(iso: string, min = '', max = ''): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

/** Today in the viewer's local calendar. `now` is injectable for tests. */
export function todayIso(now = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatLongDate(iso: string, locale = 'en-GB'): string {
  const p = parseIso(iso);
  if (!p) return '';
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(p.year, p.month, p.day)));
}

export function formatMonthYear(year: number, month: number, locale = 'en-GB'): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month, 1)));
}

/** Short weekday headers starting at `weekStartsOn` (2024-09-01 was a Sunday). */
export function weekdayLabels(weekStartsOn = 0, locale = 'en-GB'): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 8, 1 + ((weekStartsOn + i) % 7)))));
}

/**
 * Where a grid navigation key moves the highlighted day (WAI-ARIA date grid pattern):
 * arrows = day/week, Home/End = week edges, PageUp/PageDown = month (Shift = year). null for other keys.
 */
export function dateForKey(key: string, iso: string, shiftKey = false, weekStartsOn = 0): string | null {
  const col = (weekday(iso) - weekStartsOn + 7) % 7;
  switch (key) {
    case 'ArrowLeft': return addDays(iso, -1);
    case 'ArrowRight': return addDays(iso, 1);
    case 'ArrowUp': return addDays(iso, -7);
    case 'ArrowDown': return addDays(iso, 7);
    case 'Home': return addDays(iso, -col);
    case 'End': return addDays(iso, 6 - col);
    case 'PageUp': return addMonths(iso, shiftKey ? -12 : -1);
    case 'PageDown': return addMonths(iso, shiftKey ? 12 : 1);
    default: return null;
  }
}

/** Accepts "HH:MM", "H:MM AM/PM" or "11.00 AM" (sheet times); returns 24h parts or null. */
export function parseClockTime(v: string): { h: number; m: number } | null {
  const m = v.trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3]) {
    const pm = m[3].toLowerCase() === 'pm';
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** "14:50" / "2:50 pm" / "11.00 AM" -> "02:50 PM"; "" when unreadable. */
export function formatTime12(v: string): string {
  const p = parseClockTime(v);
  if (!p) return '';
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(p.h % 12 || 12)}:${pad2(p.m)} ${p.h >= 12 ? 'PM' : 'AM'}`;
}

/**
 * Activities of one day in time order: by their own date (ISO or sheet style), then clock time.
 * Unreadable times keep their sheet order after the timed ones (stable sort).
 */
export function sortByTime<T extends { time?: string; date?: string }>(items: T[], dayDate = ''): T[] {
  const rank = (it: T) => {
    const t = parseClockTime(it.time || '');
    return { iso: toIsoDate(it.date || dayDate) || toIsoDate(dayDate), min: t ? t.h * 60 + t.m : Infinity };
  };
  return items
    .map((it, i) => ({ it, i, r: rank(it) }))
    .sort((a, b) => a.r.iso.localeCompare(b.r.iso) || a.r.min - b.r.min || a.i - b.i)
    .map((x) => x.it);
}
