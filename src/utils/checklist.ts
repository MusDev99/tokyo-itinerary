import type { DayItinerary } from '../types/itinerary';
import { detectCategory } from './analytics.ts';

/**
 * Rule-based "Prepare" checklist for a trip: built from the trip's own data (dates, currency, season,
 * activities), so it is instant, free and works offline. Dependency-free and unit-tested.
 */

export type GroupId = 'documents' | 'money' | 'connect' | 'packing' | 'faith' | 'bookings';

export interface CheckItem {
  /** Stable id: ticks are saved per device under this key, so it must not change between renders */
  id: string;
  group: GroupId;
  label: string;
  hint?: string;
  /** Do this at least N days before the first trip day (drives the "due" badge) */
  leadDays?: number;
}

export interface CheckGroup {
  id: GroupId;
  label: string;
  icon: string;
  items: CheckItem[];
}

// Miller's Law: six short, labelled chunks instead of one long list
export const GROUPS: Array<Omit<CheckGroup, 'items'>> = [
  { id: 'documents', label: 'Documents', icon: '🛂' },
  { id: 'money', label: 'Money', icon: '💴' },
  { id: 'connect', label: 'Phone & apps', icon: '📱' },
  { id: 'packing', label: 'Packing', icon: '🧳' },
  { id: 'faith', label: 'Prayer & food', icon: '🕌' },
  { id: 'bookings', label: 'Bookings & tickets', icon: '🎟️' },
];

export interface TripInput {
  country: string;
  currency: string;
  /** e.g. "Autumn Season" from the country defaults */
  season?: string;
  itinerary: DayItinerary[];
  firstDate?: string | null;
  lastDate?: string | null;
  totalLocalCost?: number;
}

/** Country-specific extras, kept small: generic items cover every other destination. */
const COUNTRY_EXTRAS: Record<string, CheckItem[]> = {
  japan: [
    { id: 'jp-ic', group: 'money', label: 'Get an IC card (Suica / PASMO / ICOCA) for trains and konbini', hint: 'Add it to your phone wallet or buy one at the airport' },
    { id: 'jp-plug', group: 'packing', label: 'Power adapter: Japan uses type A plugs (100V)' },
    { id: 'jp-coins', group: 'packing', label: 'Small coin pouch: many shops and lockers take cash coins' },
    { id: 'jp-vjw', group: 'documents', label: 'Fill in Visit Japan Web (immigration + customs QR)', leadDays: 3 },
  ],
};

/** Keyword → item, matched against activity titles/descriptions (lower-case). */
const ACTIVITY_RULES: Array<{ match: RegExp; item: CheckItem }> = [
  { match: /onsen|hot spring|sento/, item: { id: 'act-onsen', group: 'packing', label: 'Small towel for the onsen', hint: 'Check tattoo rules before you go' } },
  { match: /temple|shrine|mosque|masjid|church|cathedral/, item: { id: 'act-modest', group: 'packing', label: 'Modest clothing for temples / mosques (covered shoulders and knees)' } },
  { match: /hike|hiking|trail|mount|mt\.|summit|fuji/, item: { id: 'act-hike', group: 'packing', label: 'Hiking shoes, water bottle and a light rain jacket' } },
  { match: /beach|island|snorkel|dive|swim/, item: { id: 'act-beach', group: 'packing', label: 'Swimwear, reef-safe sunscreen and a dry bag' } },
  { match: /ski|snowboard|snow/, item: { id: 'act-snow', group: 'packing', label: 'Waterproof gloves, beanie and thermal socks' } },
  { match: /disney|universal|usj|theme park/, item: { id: 'act-park', group: 'bookings', label: 'Theme park tickets and the official app (timed entry / express passes)', leadDays: 14 } },
  { match: /shinkansen|bullet train|jr pass/, item: { id: 'act-rail', group: 'bookings', label: 'Shinkansen seats or rail pass', hint: 'Reserve seats for busy weekends', leadDays: 7 } },
];

const SEASON_PACKING: Record<string, CheckItem[]> = {
  winter: [
    { id: 'season-winter', group: 'packing', label: 'Thermal inner wear, warm jacket, gloves and lip balm' },
    { id: 'season-winter-hand', group: 'packing', label: 'Heat packs (kairo) for cold mornings' },
  ],
  summer: [
    { id: 'season-summer', group: 'packing', label: 'Sunscreen, hat, sunglasses and a refillable bottle' },
    { id: 'season-summer-fan', group: 'packing', label: 'Handheld fan or cooling towel for hot, humid days' },
  ],
  spring: [{ id: 'season-spring', group: 'packing', label: 'Light layers and a thin jacket (cool mornings, warm afternoons)' }],
  autumn: [{ id: 'season-autumn', group: 'packing', label: 'Light sweater or windbreaker for crisp evenings' }],
};

const BASE: CheckItem[] = [
  { id: 'passport', group: 'documents', label: 'Passport valid for 6+ months after you return', leadDays: 30 },
  { id: 'visa', group: 'documents', label: 'Check visa / entry rules for {country}', hint: 'Rules change: confirm on the official immigration site', leadDays: 30 },
  { id: 'insurance', group: 'documents', label: 'Travel insurance (medical + flight delay)', leadDays: 14 },
  { id: 'boarding', group: 'documents', label: 'Flight booking and check-in / boarding pass', leadDays: 1 },
  { id: 'copies', group: 'documents', label: 'Photos of passport, insurance and bookings saved offline' },
  { id: 'cash', group: 'money', label: 'Some {currency} cash for small shops and transport', leadDays: 3 },
  { id: 'card', group: 'money', label: 'Enable overseas use on your debit / credit card', leadDays: 3 },
  { id: 'esim', group: 'connect', label: 'eSIM, local SIM or roaming plan', leadDays: 3 },
  { id: 'maps', group: 'connect', label: 'Download offline maps for {country}' },
  { id: 'app', group: 'connect', label: 'Open this trip once online: PlanTravel keeps it readable offline' },
  { id: 'translate', group: 'connect', label: 'Offline translation pack (camera translate for menus and signs)' },
  { id: 'powerbank', group: 'packing', label: 'Power bank and charging cables' },
  { id: 'shoes', group: 'packing', label: 'Comfortable walking shoes' },
  { id: 'meds', group: 'packing', label: 'Personal medicine and a small first-aid kit' },
  { id: 'umbrella', group: 'packing', label: 'Foldable umbrella' },
  { id: 'prayer-times', group: 'faith', label: 'Check prayer times and Qibla for each day (Tools tab)' },
  { id: 'prayer-mat', group: 'faith', label: 'Travel prayer mat and compass' },
  { id: 'halal', group: 'faith', label: 'Save halal / Muslim-friendly restaurants near your stops' },
];

const fill = (text: string, t: TripInput) => text.replace(/\{country\}/g, t.country).replace(/\{currency\}/g, t.currency);

const MAX_BOOKINGS = 8;

/** Builds the grouped checklist for a trip. Same input → same items and ids (ticks stay matched). */
export function buildChecklist(t: TripInput): CheckGroup[] {
  const items: CheckItem[] = BASE.map((i) => ({ ...i, label: fill(i.label, t), hint: i.hint && fill(i.hint, t) }));

  if (t.totalLocalCost && t.totalLocalCost > 0) {
    items.splice(items.findIndex((i) => i.id === 'cash') + 1, 0, {
      id: 'budget',
      group: 'money',
      label: `Planned spend: ${Math.round(t.totalLocalCost).toLocaleString('en-US')} ${t.currency}`,
      hint: 'From the prices in your itinerary',
    });
  }

  items.push(...(COUNTRY_EXTRAS[t.country.trim().toLowerCase()] ?? []));

  const season = (t.season || '').toLowerCase().split(/\s+/)[0];
  items.push(...(SEASON_PACKING[season] ?? []));

  const activities = t.itinerary.flatMap((d) => d.items.map((it) => ({ ...it, day: d.day })));
  const text = activities.map((a) => `${a.title} ${a.description || ''} ${a.note || ''}`).join(' \n ').toLowerCase();
  for (const rule of ACTIVITY_RULES) if (rule.match.test(text)) items.push(rule.item);

  // Paid stays, tickets and transport in the plan become booking reminders (Day N so they're easy to find)
  const bookings: CheckItem[] = [];
  for (const a of activities) {
    const cat = detectCategory(a).key;
    const paid = (a.price?.amount ?? 0) > 0;
    if (cat === 'lodging' || ((cat === 'sightseeing' || cat === 'transport') && paid)) {
      const verb = cat === 'lodging' ? 'Confirm stay' : cat === 'transport' ? 'Book / buy' : 'Buy ticket';
      bookings.push({
        id: `book-${a.id || slug(`${a.day}-${a.title}`)}`,
        group: 'bookings',
        label: `${verb}: ${a.title}`,
        hint: `Day ${a.day}${a.time ? ` · ${a.time}` : ''}`,
        leadDays: cat === 'lodging' ? 7 : 3,
      });
    }
  }
  items.push(...dedupe(bookings).slice(0, MAX_BOOKINGS));

  const unique = dedupe(items);
  return GROUPS.map((g) => ({ ...g, items: unique.filter((i) => i.group === g.id) })).filter((g) => g.items.length > 0);
}

function dedupe(list: CheckItem[]) {
  const seen = new Set<string>();
  return list.filter((i) => !seen.has(i.id) && seen.add(i.id));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

export type Due = { kind: 'overdue' | 'soon' | 'later'; days: number } | null;

/**
 * How urgent an item is: days left until it should be done (first trip day minus its lead time).
 * `soon` = within 7 days. Null when the item has no lead time or the trip has no date.
 */
export function dueStatus(item: CheckItem, firstDate: string | null | undefined, now: Date): Due {
  if (!item.leadDays || !firstDate) return null;
  const start = new Date(`${firstDate.slice(0, 10)}T00:00:00`);
  if (isNaN(start.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000) - item.leadDays;
  if (start.getTime() < today.getTime()) return null; // trip already started: no nagging
  return { kind: days < 0 ? 'overdue' : days <= 7 ? 'soon' : 'later', days };
}

/** Per-device state: ticked ids and the person's own extra items. */
export interface SavedChecklist {
  done: string[];
  custom: Array<{ id: string; label: string }>;
}

export const storageKey = (tripTab: string) => `checklist:${tripTab.trim().toLowerCase()}`;

/** Parses saved state defensively: storage is per device and may hold anything. */
export function parseSaved(raw: string | null): SavedChecklist {
  try {
    const v = raw ? JSON.parse(raw) : null;
    const done = Array.isArray(v?.done) ? v.done.filter((x: unknown) => typeof x === 'string').slice(0, 500) : [];
    const custom = Array.isArray(v?.custom)
      ? v.custom
          .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
          .map((c: any) => ({ id: c.id.slice(0, 64), label: c.label.trim().slice(0, 120) }))
          .filter((c: { label: string }) => c.label)
          .slice(0, 50)
      : [];
    return { done, custom };
  } catch {
    return { done: [], custom: [] };
  }
}

/** Ready count over the items that exist now (ticks of items that disappeared don't count). */
export function progress(groups: CheckGroup[], saved: SavedChecklist) {
  const ids = new Set([...groups.flatMap((g) => g.items.map((i) => i.id)), ...saved.custom.map((c) => c.id)]);
  const done = saved.done.filter((id) => ids.has(id)).length;
  return { done, total: ids.size };
}
