import type { DayItinerary } from '../types/itinerary';

/** Sorted unique ISO dates (YYYY-MM-DD) of an itinerary; unparseable dates are skipped. */
export function tripIsoDates(itinerary: DayItinerary[]): string[] {
  const out = new Set<string>();
  for (const day of itinerary) {
    const d = new Date(day.date);
    if (isNaN(d.getTime())) continue;
    // Build from local parts so "October 17, 2026" doesn't shift a day via UTC conversion
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    out.add(iso);
  }
  return [...out].sort();
}
