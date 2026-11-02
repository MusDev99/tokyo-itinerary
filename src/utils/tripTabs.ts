/**
 * The tabs of a destination page, defined once for the header tabs (desktop) and the bottom tab bar (phones).
 * A "trip" is one `Country - State` tab or a country without states: it gets all five tabs. A country split into
 * states is a hub (its trips are the states), so it only has Overview + the merged Itinerary.
 */

export type TabKey = 'overview' | 'analysis' | 'itinerary' | 'tools' | 'prepare';

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
  states: unknown[];
}

export function tripTabs(country: TabSource, state?: { slug: string }): { isTrip: boolean; tabs: TripTab[] } {
  const isTrip = Boolean(state) || country.states.length === 0;
  const base = state ? `/${country.slug}/${state.slug}` : `/${country.slug}`;
  const planned = country.stats.hasItinerary;
  const days = country.stats.totalDays > 0 ? `${country.stats.totalDays}d` : undefined;

  if (!isTrip) {
    return {
      isTrip,
      tabs: [
        { key: 'overview', label: 'Overview', icon: '🧭', href: base },
        ...(planned ? [{ key: 'itinerary' as const, label: 'Itinerary', icon: '🗓️', href: `${base}/itinerary`, badge: days }] : []),
      ],
    };
  }

  // A state trip's itinerary keeps the short URL (/japan/tokyo) so existing links, ?day=N and calendar URLs still work
  const all: Array<TripTab & { show: boolean }> = [
    { key: 'overview', label: 'Overview', icon: '🧭', href: state ? `${base}/overview` : base, show: true },
    { key: 'analysis', label: 'Analysis', icon: '📊', href: `${base}/analysis`, show: planned },
    { key: 'itinerary', label: 'Itinerary', icon: '🗓️', href: state ? base : `${base}/itinerary`, badge: days, show: planned },
    { key: 'tools', label: 'Tools', icon: '🕌', href: `${base}/tools`, show: true },
    { key: 'prepare', label: 'Prepare', icon: '✅', href: `${base}/prepare`, show: planned },
  ];
  return { isTrip, tabs: all.filter((t) => t.show).map(({ show, ...t }) => t) };
}
