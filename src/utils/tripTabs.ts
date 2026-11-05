/**
 * The tabs of a destination page, defined once for the header tabs (desktop) and the bottom tab bar (phones).
 * A TRIP (`/trips/<slug>`) has four tabs: Overview, Analysis, Itinerary and Pocket (bookings, docs, checklist, travel
 * tools). A country page (`/<country>`) lists that country's trips: it has Overview + the merged Itinerary only.
 */

export type TabKey = 'overview' | 'analysis' | 'itinerary' | 'pocket';

export interface TripTab {
  key: TabKey;
  label: string;
  icon: string;
  href: string;
  badge?: string;
}

export interface TabSource {
  slug: string;
  stats: { totalDays: number; hasItinerary: boolean };
}

/** Address of a trip's pages: `/trips/<slug>` (itinerary) and `/trips/<slug>/<tab>`. */
export const tripBase = (slug: string) => `/trips/${slug}`;

/** `trip` given: that trip's tabs (always a trip). Otherwise the country page's tabs. */
export function tripTabs(country: TabSource, trip?: { slug: string }): { isTrip: boolean; tabs: TripTab[] } {
  const planned = country.stats.hasItinerary;
  const days = country.stats.totalDays > 0 ? `${country.stats.totalDays}d` : undefined;

  if (!trip) {
    const base = `/${country.slug}`;
    return {
      isTrip: false,
      tabs: [
        { key: 'overview', label: 'Overview', icon: '🧭', href: base },
        ...(planned ? [{ key: 'itinerary' as const, label: 'Itinerary', icon: '🗓️', href: `${base}/itinerary`, badge: days }] : []),
      ],
    };
  }

  // A trip's itinerary is the short URL (/trips/<slug>) so ?day=N and calendar links stay simple
  const base = tripBase(trip.slug);
  const all: Array<TripTab & { show: boolean }> = [
    { key: 'overview', label: 'Overview', icon: '🧭', href: `${base}/overview`, show: true },
    { key: 'analysis', label: 'Analysis', icon: '📊', href: `${base}/analysis`, show: planned },
    { key: 'itinerary', label: 'Itinerary', icon: '🗓️', href: base, badge: days, show: planned },
    { key: 'pocket', label: 'Pocket', icon: '🎒', href: `${base}/pocket`, show: true },
  ];
  return { isTrip: true, tabs: all.filter((t) => t.show).map(({ show, ...t }) => t) };
}
