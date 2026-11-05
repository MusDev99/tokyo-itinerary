// Pure "suggestions mined from the sheet": places other trips already used, ranked by how many trips used them
// (no imports beyond types and pure helpers: unit-tested with `node --test`).
import { detectCategory } from './analytics.ts';
import { parseClockTime } from './calendar.ts';
import { suggestNextTime } from './tripDraft.ts';
import type { DayItinerary } from '../types/itinerary';

export interface Suggestion {
  key: string;
  title: string;
  city: string;
  category: string;
  /** In how many different trips this place appears */
  count: number;
  /** Median price of the trips that paid for it (0 = usually free) and its currency */
  price: number;
  currency: string;
  /** Typical start time ("" when unknown) */
  time: string;
  description: string;
  location_name: string;
}

export interface SuggestionSource {
  slug: string;
  /** Used when an activity has no city of its own */
  cities: string[];
  itinerary: DayItinerary[];
}

const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** "Senso-ji Temple!" and "senso ji temple" are the same place. */
export const normTitle = (t: string) => fold(t).replace(/[^a-z0-9]+/g, ' ').trim();

const mostCommon = (values: string[]): string => {
  const n = new Map<string, number>();
  for (const v of values) if (v) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
};
const median = (nums: number[]): number => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Every place used in any trip, deduplicated by normalised title + city, most used first. */
export function buildSuggestions(trips: SuggestionSource[]): Suggestion[] {
  interface Acc { titles: string[]; city: string; trips: Set<string>; cats: string[]; prices: number[]; currencies: string[]; minutes: number[]; descs: string[]; locs: string[] }
  const map = new Map<string, Acc>();
  for (const trip of trips) {
    for (const day of trip.itinerary) {
      for (const it of day.items) {
        const title = it.title.trim();
        if (!title) continue;
        const city = (it.city || day.city || trip.cities[0] || '').trim();
        const key = `${normTitle(title)}|${fold(city)}`;
        const acc = map.get(key) ?? { titles: [], city, trips: new Set(), cats: [], prices: [], currencies: [], minutes: [], descs: [], locs: [] };
        acc.titles.push(title);
        acc.trips.add(trip.slug);
        acc.cats.push(detectCategory(it).key);
        if (it.price?.amount > 0) { acc.prices.push(it.price.amount); acc.currencies.push(it.price.currency || ''); }
        const t = parseClockTime(it.time || '');
        if (t) acc.minutes.push(t.h * 60 + t.m);
        acc.descs.push((it.description || '').trim());
        if (it.location?.name && it.location.name !== title) acc.locs.push(it.location.name);
        map.set(key, acc);
      }
    }
  }
  const out: Suggestion[] = [];
  for (const [key, a] of map) {
    const m = a.minutes.length ? Math.round(median(a.minutes)) : -1;
    out.push({
      key,
      title: mostCommon(a.titles),
      city: a.city,
      category: mostCommon(a.cats) || 'general',
      count: a.trips.size,
      price: Math.round(median(a.prices)),
      currency: mostCommon(a.currencies),
      time: m >= 0 ? `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` : '',
      description: mostCommon(a.descs),
      location_name: mostCommon(a.locs),
    });
  }
  return out.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

export function filterSuggestions(list: Suggestion[], f: { q?: string; city?: string; category?: string; limit?: number }): Suggestion[] {
  const q = normTitle(f.q || '');
  const city = fold((f.city || '').trim());
  const out = list.filter((s) => (!q || normTitle(`${s.title} ${s.city}`).includes(q)) && (!city || fold(s.city).includes(city)) && (!f.category || s.category === f.category));
  return out.slice(0, f.limit ?? 200);
}

export interface PlacedSuggestion {
  date: string;
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

/**
 * Spreads picked places across the trip's days, round-robin in the order picked (so a short list still touches
 * every day), then orders each day by its typical start time. A place without a time follows the previous one.
 */
export function distributeSuggestions(picks: Suggestion[], dates: string[]): PlacedSuggestion[] {
  if (!picks.length || !dates.length) return [];
  const perDay: Suggestion[][] = dates.map(() => []);
  picks.forEach((p, i) => perDay[i % dates.length].push(p));
  const out: PlacedSuggestion[] = [];
  perDay.forEach((list, d) => {
    const sorted = [...list].sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    let prev = '';
    for (const p of sorted) {
      const time = p.time || (prev ? suggestNextTime(prev) : '');
      prev = time || prev;
      out.push({
        date: dates[d], time, title: p.title, description: p.description, category: p.category, location_name: p.location_name,
        price_amount: p.price > 0 ? p.price : null, price_currency: p.price > 0 ? p.currency : '', price_notes: '', city: '',
      });
    }
  });
  return out;
}
