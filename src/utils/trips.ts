// Pure helpers for titled trips (no imports beyond types: unit-tested with `node --test`).
// A trip is one worksheet tab with a title, a stable slug and optional stops (cities with day ranges).
// Tabs without a registry row are "legacy" trips derived from the old `Country - State` naming.

import { addDays, diffDays } from './tripDraft.ts';

export interface Stop {
  city: string;
  country: string;
  /** ISO dates, inclusive */
  start: string;
  end: string;
}

/** Registry row for a trip in the hidden `_trips` worksheet (columns K:P; A:J hold place + dates). */
export interface TripMeta {
  tab: string;
  title: string;
  slug: string;
  /** Primary country (name) the trip is listed under */
  country: string;
  stops: Stop[];
  createdBy: string;
  createdAt: string;
  copiedFrom: string;
}

export const TRIP_META_HEADERS = ['title', 'slug', 'country', 'stops', 'created_by', 'created_at', 'copied_from'] as const;
/** Column index (0-based) of the first registry column in `_trips` (K) */
export const TRIP_META_FIRST_COL = 10;

export const slugOf = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Words a trip slug must never be (routes under /trips/ and the rest of the site). */
export const RESERVED_TRIP_SLUGS = new Set(['new', 'add', 'api', 'trips', '404', 'itinerary', 'tools', 'prepare', 'pocket', 'welcome', 'login']);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Stops from the JSON cell; anything malformed is dropped (a hand-edited sheet must not break a page). */
export function parseStops(raw: unknown): Stop[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  const out: Stop[] = [];
  for (const s of list.slice(0, 30)) {
    const city = typeof s?.city === 'string' ? s.city.trim().slice(0, 80) : '';
    const country = typeof s?.country === 'string' ? s.country.trim().slice(0, 80) : '';
    const start = typeof s?.start === 'string' ? s.start : '';
    const end = typeof s?.end === 'string' ? s.end : '';
    if (!city || !ISO.test(start) || !ISO.test(end) || end < start) continue;
    out.push({ city, country, start, end });
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export const serializeStops = (stops: Stop[]): string => (stops.length ? JSON.stringify(parseStops(stops)) : '');

/** Registry rows of `_trips` (row 1 = headers). Rows without a title or slug are place-only rows and are skipped. */
export function parseTripMetas(rows: string[][] | null | undefined): TripMeta[] {
  if (!rows || rows.length < 2) return [];
  const header = (rows[0] || []).map((h) => String(h || '').trim().toLowerCase());
  // The registry columns sit at K onward; `country` also names a place column (D), so search from K
  const col = (name: string, fallback: number) => {
    const i = header.indexOf(name, TRIP_META_FIRST_COL);
    return i >= 0 ? i : fallback;
  };
  const at = {
    title: col('title', 10), slug: col('slug', 11), country: col('country', 12), stops: col('stops', 13),
    createdBy: col('created_by', 14), createdAt: col('created_at', 15), copiedFrom: col('copied_from', 16),
  };
  const out: TripMeta[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r] || [];
    const cell = (i: number) => String(c[i] ?? '').trim();
    const tab = cell(0);
    const title = cell(at.title);
    const slug = slugOf(cell(at.slug));
    if (!tab || !title || !slug) continue;
    out.push({
      tab, title, slug, country: cell(at.country), stops: parseStops(cell(at.stops)),
      createdBy: cell(at.createdBy), createdAt: cell(at.createdAt), copiedFrom: cell(at.copiedFrom),
    });
  }
  return out;
}

/** Slug of a trip that only exists as an old `Country - State` tab: stable, so old links can be redirected. */
export function legacyTripSlug(country: string, state: string | null): string {
  return state ? `${slugOf(country)}-${slugOf(state)}` : slugOf(country);
}

/** A readable, unique slug from a title: `airtravel-japan-2025`, then `-2`, `-3`... when taken or reserved. */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugOf(title).slice(0, 60) || 'trip';
  let slug = base;
  for (let n = 2; used.has(slug) || RESERVED_TRIP_SLUGS.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** The city of a day: its own (from the sheet's `city` column) first, else the stop covering its date. */
export function cityForDay(day: { city?: string; date?: string }, stops: Stop[]): string {
  if (day.city?.trim()) return day.city.trim();
  const d = day.date || '';
  return stops.find((s) => d >= s.start && d <= s.end)?.city ?? '';
}

/** Cities of a trip in visiting order, without repeats. */
export function orderedCities(dayCities: string[], stops: Stop[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of [...dayCities, ...stops.map((s) => s.city)]) {
    const v = c.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/** "Tokyo → Osaka" (or just "Tokyo"); empty when there is no city information. */
export const citiesLabel = (cities: string[]) => cities.join(' → ');

/** A worksheet-tab name from a trip title: no characters Sheets forbids, no leading `_` (hidden tabs), max 90, unique. */
export function tabNameFromTitle(title: string, takenTabs: Iterable<string>): string {
  const taken = new Set([...takenTabs].map((t) => t.trim().toLowerCase()));
  const base = title.replace(/[\[\]*?:\/\\'!]/g, ' ').replace(/\s+/g, ' ').replace(/^[_\s]+/, '').trim().slice(0, 90).trim() || 'Trip';
  let tab = base;
  for (let n = 2; taken.has(tab.toLowerCase()); n++) tab = `${base.slice(0, 86)} ${n}`;
  return tab;
}

/**
 * Stops from "city + number of days" rows laid end to end from `start`: every row gets its days and the last one
 * takes whatever is left of the trip. Rows without a city are skipped.
 */
export function stopsFromParts(start: string, totalDays: number, parts: Array<{ city: string; country?: string; days: number }>): Stop[] {
  const rows = parts.filter((p) => p.city.trim());
  const out: Stop[] = [];
  let used = 0;
  rows.forEach((p, i) => {
    const isLast = i === rows.length - 1;
    const days = isLast ? totalDays - used : Math.max(1, Math.min(Math.floor(p.days) || 1, totalDays - used - (rows.length - 1 - i)));
    if (days < 1) return;
    out.push({ city: p.city.trim(), country: (p.country || '').trim(), start: addDays(start, used), end: addDays(start, used + days - 1) });
    used += days;
  });
  return out;
}

/** Error text when stops fall outside the trip or overlap, else null. */
export function validateStops(stops: Stop[], start: string, end: string): string | null {
  const sorted = [...stops].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start < start || s.end > end) return `${s.city} falls outside the trip dates`;
    if (i > 0 && s.start <= sorted[i - 1].end) return `${s.city} overlaps ${sorted[i - 1].city}`;
  }
  return null;
}

/** Days of the trip spent in each stop, for the editor (inverse of stopsFromParts). */
export const stopDays = (s: Stop) => diffDays(s.start, s.end) + 1;
