import type { DayItinerary } from '../types/itinerary';

/**
 * Patching one tab of the cached trip data after a write (pure, unit-tested), so an edit costs one small read
 * instead of re-reading every trip tab for everybody.
 */

export type RawTrips = { itineraries: Record<string, DayItinerary[]>; tabTitles: Record<string, string> };

/** The key a tab is stored under (same rule as the reader). */
export const tabSlug = (tab: string): string => tab.trim().toLowerCase().replace(/[\s_]+/g, '-');

/**
 * New raw data with `tab`'s days replaced, or null when that tab is not in the cache (a new tab: do a full read).
 * `parse` turns the tab's sheet rows into days.
 */
export function applyTabUpdate(raw: RawTrips, tab: string, parse: (tabTitle: string) => DayItinerary[]): RawTrips | null {
  const slug = tabSlug(tab);
  if (!(slug in raw.itineraries)) return null;
  return {
    itineraries: { ...raw.itineraries, [slug]: parse(raw.tabTitles[slug] ?? tab) },
    tabTitles: raw.tabTitles,
  };
}

/** The highest sheet row used by a tab's activities (1 = header only). */
export function lastUsedRow(days: DayItinerary[]): number {
  let last = 1;
  for (const d of days) for (const i of d.items) if ((i.row ?? 0) > last) last = i.row!;
  return last;
}

/** The sheet is read up to this row (A1:Z2000): anything past it would be saved but never shown. */
export const MAX_TAB_ROWS = 2000;

/** Error text when adding `count` rows to a tab whose last row is `lastRow` would pass the readable limit, else null. */
export function rowLimitError(lastRow: number, count: number): string | null {
  if (lastRow + count <= MAX_TAB_ROWS) return null;
  const room = Math.max(0, MAX_TAB_ROWS - lastRow);
  return room === 0
    ? `This trip is full (${MAX_TAB_ROWS - 1} places). Start a new trip for the rest.`
    : `This trip has room for only ${room} more ${room === 1 ? 'place' : 'places'} (limit ${MAX_TAB_ROWS - 1}). Start a new trip for the rest.`;
}
