import type { TimelineItem } from '../types/itinerary';

/**
 * Google Maps directions link through a day's stops, in order (plain Maps URL: no API key, no new host).
 * Maps URLs take an origin, a destination and at most 9 waypoints, so long days route through the first 11 stops.
 */

export const MAX_ROUTE_STOPS = 11;

export interface DayRoute {
  url: string;
  /** Stops in the link */
  stops: number;
  /** Stops left out because of the Maps URL limit */
  skipped: number;
}

/**
 * "Senso-ji" + "Tokyo" -> "Senso-ji, Tokyo", so short, ambiguous names are searched near the trip.
 * Long or comma-qualified names ("Kuala Lumpur International Airport Terminal 2") are already specific and may be
 * outside the trip's city (the flight out), so they are left as they are.
 */
function query(name: string, region?: string): string {
  const clean = name.trim();
  const specific = clean.includes(',') || clean.split(/\s+/).length > 3;
  if (!region || specific || clean.toLowerCase().includes(region.toLowerCase())) return clean;
  return `${clean}, ${region}`;
}

export function dayRouteUrl(items: TimelineItem[], region?: string): DayRoute | null {
  const names: string[] = [];
  for (const item of items) {
    const name = (item.location?.name || item.title || '').trim();
    // Back-to-back activities at the same place are one stop
    if (name && names[names.length - 1]?.toLowerCase() !== name.toLowerCase()) names.push(name);
  }
  if (names.length === 0) return null;

  const stops = names.slice(0, MAX_ROUTE_STOPS).map((n) => query(n, region));
  const skipped = names.length - stops.length;
  if (stops.length === 1) {
    return { url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stops[0])}`, stops: 1, skipped };
  }
  const params = new URLSearchParams({ api: '1', origin: stops[0], destination: stops[stops.length - 1] });
  if (stops.length > 2) params.set('waypoints', stops.slice(1, -1).join('|'));
  return { url: `https://www.google.com/maps/dir/?${params.toString()}`, stops: stops.length, skipped };
}
