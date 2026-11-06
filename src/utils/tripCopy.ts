// Pure planning for "copy a trip": which activities to write, shifted to a new start date (no imports beyond types).
import { addDays, diffDays } from './tripDraft.ts';
import { toIsoDate } from './calendar.ts';
import type { DayItinerary, TimelineItem } from '../types/itinerary';

export interface CopiedActivity {
  date: string;
  day_title?: string;
  time: string;
  title: string;
  description: string;
  category: string;
  location_name: string;
  price_amount: number | null;
  price_currency: string;
  price_notes: string;
  city: string;
}

/** A day to copy (ISO date in the SOURCE trip) and, optionally, only some of its activities. */
export interface DaySelection {
  date: string;
  /** `copyKey()` of the activities to keep; omitted = the whole day */
  ids?: string[];
}

export interface CopyPlan {
  activities: CopiedActivity[];
  start: string;
  end: string;
  days: number;
  /** Cities in order with their (new) date ranges, for the new trip's stops */
  cityRuns: Array<{ city: string; start: string; end: string }>;
}

/** Stable key of an activity inside its trip: the row id, else its sheet row. */
export const copyKey = (item: Pick<TimelineItem, 'id' | 'row'>): string => item.id || `row-${item.row ?? ''}`;

const isDefaultTitle = (t: string) => /^day \d+$/i.test(t.trim());

/**
 * Plans a copy. The earliest selected day lands on `newStart` and every other selected day keeps its distance
 * from it (a skipped day stays a gap), so "days 1, 2 and 5" becomes the same shape starting where you choose.
 * Prices are copied unless `includePrices` is false. Notes, images and videos are never copied.
 */
export function planCopy(
  days: DayItinerary[],
  newStart: string,
  opts: { selection?: DaySelection[]; includePrices?: boolean } = {}
): CopyPlan | { error: string } {
  const { selection, includePrices = true } = opts;
  const picked = new Map(selection?.map((s) => [toIsoDate(s.date), s.ids ? new Set(s.ids) : null]));

  const chosen: Array<{ iso: string; day: DayItinerary; items: TimelineItem[] }> = [];
  for (const day of days) {
    const iso = toIsoDate(day.date);
    if (!iso) continue;
    let items = day.items;
    if (selection) {
      if (!picked.has(iso)) continue;
      const only = picked.get(iso);
      if (only) items = items.filter((i) => only.has(copyKey(i)));
    }
    if (items.length) chosen.push({ iso, day, items });
  }
  if (chosen.length === 0) return { error: 'Nothing to copy: pick at least one activity' };

  const first = chosen.reduce((m, c) => (c.iso < m ? c.iso : m), chosen[0].iso);
  const last = chosen.reduce((m, c) => (c.iso > m ? c.iso : m), chosen[0].iso);
  const offset = diffDays(first, newStart);

  const activities: CopiedActivity[] = [];
  for (const { iso, day, items } of chosen) {
    const date = addDays(iso, offset);
    for (const it of items) {
      activities.push({
        date,
        ...(day.title && !isDefaultTitle(day.title) ? { day_title: day.title } : {}),
        time: it.time || '',
        title: it.title,
        description: it.description || '',
        category: it.category || '',
        location_name: it.location?.name && it.location.name !== it.title ? it.location.name : '',
        price_amount: includePrices && it.price?.amount > 0 ? it.price.amount : null,
        price_currency: includePrices && it.price?.amount > 0 ? it.price.currency || '' : '',
        price_notes: includePrices && it.price?.amount > 0 ? it.price.notes || '' : '',
        city: it.city || day.city || '',
      });
    }
  }

  // Cities in order: merge neighbouring days of the same city into one run
  const cityRuns: CopyPlan['cityRuns'] = [];
  for (const { iso, day, items } of [...chosen].sort((a, b) => a.iso.localeCompare(b.iso))) {
    const city = items.find((i) => i.city)?.city || day.city || '';
    if (!city) continue;
    const date = addDays(iso, offset);
    const prev = cityRuns[cityRuns.length - 1];
    if (prev && prev.city.toLowerCase() === city.toLowerCase()) prev.end = date;
    else cityRuns.push({ city, start: date, end: date });
  }

  const end = addDays(last, offset);
  return { activities, start: newStart, end, days: diffDays(newStart, end) + 1, cityRuns };
}
