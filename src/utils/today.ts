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
  /** Minutes after midnight */
  start: number;
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
  /** All of today's activities, in time order (for the day route) */
  all: TimedItem[];
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
export function pickToday(trips: TodayTrip[], iso: string, minutes: number): TodayView | null {
  for (const trip of trips) {
    const i = todayIndex(trip.days, iso);
    if (i < 0) continue;
    const day = trip.days[i];
    const all = day.items
      .map((it) => {
        const t = parseClockTime(it.time);
        return t ? { ...it, start: t.h * 60 + t.m } : null;
      })
      .filter((x): x is TimedItem => x !== null)
      .sort((a, b) => a.start - b.start);

    const nextIdx = all.findIndex((it) => it.start > minutes);
    const next = nextIdx >= 0 ? all[nextIdx] : null;
    const prev = (nextIdx >= 0 ? all.slice(0, nextIdx) : all).at(-1) ?? null;
    const slotEnd = prev ? Math.min(next ? next.start : Infinity, prev.start + CURRENT_MAX) : 0;
    const current = prev && minutes < slotEnd ? prev : null;
    const later = nextIdx >= 0 ? all.slice(nextIdx + 1, nextIdx + 1 + LATER_MAX) : [];
    const tomorrow = next ? null : trip.days[i + 1] ?? null;
    return { trip, day, current, next, minutesUntilNext: next ? next.start - minutes : null, later, all, tomorrow };
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
