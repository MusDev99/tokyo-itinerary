// Dev-only sample spreadsheet so pages render locally without Google credentials (perf checks, browser tests).
// Enabled by SHEETS_FIXTURE=1 AND the Astro dev server; it can never run in a production build.
import type { DayItinerary, TimelineItem } from '../types/itinerary';

const PLACES = [
  ['Senso-ji Temple', 'sightseeing'], ['Ramen Ichiran', 'food'], ['Shinkansen to Kyoto', 'transport'], ['Hotel Gracery', 'lodging'],
  ['Don Quijote', 'shopping'], ['Sunset hike', 'nature'], ['Rooftop cocktail', 'nightlife'], ['Spa & massage', 'wellness'],
] as const;

const TIMES = ['08:30', '10:00', '12:30', '15:00', '18:30', '20:00'];

function trip(tab: string, startIso: string, days: number, seed: number): DayItinerary[] {
  const out: DayItinerary[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(`${startIso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + d);
    const iso = date.toISOString().slice(0, 10);
    const items: TimelineItem[] = Array.from({ length: 5 }, (_, i) => {
      const [title, category] = PLACES[(seed + d * 3 + i) % PLACES.length];
      return {
        id: `${tab}-${d}-${i}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tab,
        row: d * 5 + i + 2,
        date: iso,
        time: TIMES[i],
        title,
        description: 'Sample activity for local testing.',
        location: { name: title, mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}` },
        price: { amount: (seed + i) % 3 === 0 ? 0 : 1200 + i * 350, currency: 'JPY' },
        note: '',
        category,
      };
    });
    out.push({ day: d + 1, title: `Day ${d + 1}`, date: iso, items });
  }
  return out;
}

const BASE: Array<[string, string, number]> = [
  ['Japan - Tokyo', '2026-11-12', 4], ['Japan - Kyoto', '2026-11-16', 3], ['Indonesia - Bali', '2026-10-30', 2],
  ['Australia - Perth', '2026-11-30', 1], ['China - Beijing', '2026-12-10', 3], ['Korea', '2027-01-05', 3],
];

/** `SHEETS_FIXTURE=many` adds 150 more one-trip countries to exercise long lists. */
export function fixtureTabs(mode: string): Record<string, DayItinerary[]> {
  const tabs: Record<string, DayItinerary[]> = {};
  BASE.forEach(([tab, start, days], i) => { tabs[tab] = trip(tab, start, days, i); });
  if (mode === 'many') {
    for (let i = 0; i < 150; i++) {
      const tab = `Country ${String.fromCharCode(65 + (i % 26))}${i} - City ${i}`;
      tabs[tab] = trip(tab, '2027-03-01', 2, i);
    }
  }
  return tabs;
}
