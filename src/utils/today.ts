import type { DayItinerary } from '../types/itinerary';
import { parseClockTime, toIsoDate } from './calendar.ts';

/**
 * "Today" mode: what is happening now / next on a trip day, from the traveller's own clock.
 * Pure and dependency-free (time is injected) so it is unit-tested.
 */

export interface TodayItem {
  time: string;
  title: string;
  /** Place name, when it differs from the title */
  place?: string;
  mapsUrl?: string;
}

export interface TodayDay {
  day: number;
  title: string;
  date: string;
  items: TodayItem[];
}

export interface TodayTrip {
  /** e.g. "Tokyo, Japan" */
  name: string;
  flag: string;
  /** Page whose day tabs show this trip, e.g. "/japan/tokyo" */
  href: string;
  /** City / country used to search the day route near the trip */
  region: string;
  days: TodayDay[];
}

export interface TimedItem extends TodayItem {
  /** Minutes after midnight, after any "running late" shift */
  start: number;
  /** Minutes after midnight as planned in the sheet */
  planned: number;
  /** Stable per-day key for check-ins */
  key: string;
  status?: LiveStatus;
}

// ---- Live day: check-ins and "running late", saved per device and trip day ----

export type LiveStatus = 'done' | 'skipped';

export interface LiveState {
  /** Minutes every activity still left today is pushed back */
  delay: number;
  status: Record<string, LiveStatus>;
}

export const EMPTY_LIVE: LiveState = { delay: 0, status: {} };
export const MAX_DELAY = 6 * 60;

export const liveKey = (tripHref: string, iso: string) => `live:${tripHref.toLowerCase()}:${iso}`;

/** Same activity -> same key on every render and reload (no row id needed). */
export const itemKey = (it: Pick<TodayItem, 'time' | 'title'>) => `${it.time.trim()}|${it.title.trim()}`.slice(0, 160);

/** Parses saved state defensively: storage is per device and may hold anything. */
export function parseLive(raw: string | null): LiveState {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const delay = Number.isFinite(v?.delay) ? Math.max(0, Math.min(MAX_DELAY, Math.round(v.delay))) : 0;
    const status: Record<string, LiveStatus> = {};
    if (v?.status && typeof v.status === 'object') {
      for (const [k, val] of Object.entries(v.status).slice(0, 200)) {
        if (val === 'done' || val === 'skipped') status[k.slice(0, 160)] = val;
      }
    }
    return { delay, status };
  } catch {
    return { delay: 0, status: {} };
  }
}

export interface TodayView {
  trip: TodayTrip;
  day: TodayDay;
  /** Started and still within its slot (until the next activity, at most 3h) */
  current: TimedItem | null;
  next: TimedItem | null;
  minutesUntilNext: number | null;
  /** Up to 3 activities after `next` (Miller's Law) */
  later: TimedItem[];
  /** All of today's activities, in planned time order, with their check-in status */
  all: TimedItem[];
  /** Activities not yet done or skipped (for the route of what's left) */
  remaining: TimedItem[];
  done: number;
  delay: number;
  /** Set once today's last activity has started: the trip's next day, if any */
  tomorrow: TodayDay | null;
}

const CURRENT_MAX = 180;
const LATER_MAX = 3;

/** Local calendar date + minutes after midnight of `now` (the traveller's device clock). */
export function localNow(now: Date): { iso: string; minutes: number } {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    iso: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minutes: now.getHours() * 60 + now.getMinutes(),
  };
}

/** Index of the itinerary day dated `iso`, or -1. Used to open a trip on today's tab. */
export function todayIndex(days: Array<Pick<DayItinerary, 'date'>>, iso: string): number {
  return days.findIndex((d) => toIsoDate(d.date) === iso);
}

/** Today's plan across all trips: the first trip with a day dated today wins. */
export function pickToday(trips: TodayTrip[], iso: string, minutes: number, live: LiveState = EMPTY_LIVE): TodayView | null {
  for (const trip of trips) {
    const i = todayIndex(trip.days, iso);
    if (i < 0) continue;
    const day = trip.days[i];
    const all = day.items
      .map((it) => {
        const t = parseClockTime(it.time);
        if (!t) return null;
        const planned = t.h * 60 + t.m;
        const key = itemKey(it);
        const status = live.status[key];
        // Done / skipped keep their planned time; only what's left moves when running late
        return { ...it, planned, key, status, start: status ? planned : planned + live.delay };
      })
      .filter((x): x is TimedItem => x !== null)
      .sort((a, b) => a.planned - b.planned);

    const remaining = all.filter((it) => !it.status);
    const nextIdx = remaining.findIndex((it) => it.start > minutes);
    const next = nextIdx >= 0 ? remaining[nextIdx] : null;
    const prev = (nextIdx >= 0 ? remaining.slice(0, nextIdx) : remaining).at(-1) ?? null;
    const slotEnd = prev ? Math.min(next ? next.start : Infinity, prev.start + CURRENT_MAX) : 0;
    const current = prev && minutes < slotEnd ? prev : null;
    const later = nextIdx >= 0 ? remaining.slice(nextIdx + 1, nextIdx + 1 + LATER_MAX) : [];
    const tomorrow = next ? null : trip.days[i + 1] ?? null;
    const done = all.filter((it) => it.status === 'done').length;
    return {
      trip, day, current, next, minutesUntilNext: next ? next.start - minutes : null, later, all, remaining, done, delay: live.delay, tomorrow,
    };
  }
  return null;
}

/** "in 25 min", "in 1 h 5 min", "now". */
export function formatUntil(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

/** Minutes after midnight -> "11:30 AM" (for shifted times). */
export function formatMinutes(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(h % 12 || 12)}:${pad2(m % 60)} ${h >= 12 ? 'PM' : 'AM'}`;
}
