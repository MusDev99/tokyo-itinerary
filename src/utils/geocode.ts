import type { Place } from '../types/place';
import { createTtlCache } from './ttlCache.ts';

/** Open-Meteo geocoding search (free, no key). Returns [] on any failure. */
export async function searchPlaces(name: string, count = 6, signal?: AbortSignal): Promise<Place[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`,
    { signal }
  );
  if (!res.ok) throw new Error(`Geocoding ${res.status}`);
  const data = (await res.json()) as { results?: any[] };
  return (data.results || []).map((r) => ({
    name: r.name,
    admin1: r.admin1,
    country: r.country || '',
    country_code: r.country_code || '',
    lat: r.latitude,
    lng: r.longitude,
    timezone: r.timezone || 'UTC',
  }));
}

// A page render must never wait long on a free third-party API: cap it, and remember answers (misses too)
// so the next visit to the same trip is instant.
const TOP_PLACE_TIMEOUT_MS = 1500;
const TOP_PLACE_TTL_MS = 6 * 60 * 60 * 1000;
const topPlaceCache = createTtlCache<Place | null>(TOP_PLACE_TTL_MS);

export async function topPlace(name: string): Promise<Place | null> {
  const key = name.trim().toLowerCase();
  const hit = topPlaceCache.get(key);
  if (hit !== undefined) return hit;
  try {
    const place = (await searchPlaces(name, 1, AbortSignal.timeout(TOP_PLACE_TIMEOUT_MS)))[0] ?? null;
    topPlaceCache.set(key, place);
    return place;
  } catch {
    return null; // timeout or failure: render without a suggestion, and try again next time
  }
}
