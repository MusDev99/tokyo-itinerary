import type { Place } from '../types/place';

/** Open-Meteo geocoding search (free, no key). Returns [] on any failure. */
export async function searchPlaces(name: string, count = 6): Promise<Place[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=${count}&language=en&format=json`
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

export async function topPlace(name: string): Promise<Place | null> {
  try {
    return (await searchPlaces(name, 1))[0] ?? null;
  } catch {
    return null;
  }
}
