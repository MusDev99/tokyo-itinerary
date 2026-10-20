import type { APIRoute } from 'astro';
import type { Place } from '../../types/place';
import { searchPlaces } from '../../utils/geocode';

const cache = ((globalThis as any).__GEOCODE_CACHE__ ||= new Map<string, { at: number; results: Place[] }>());
const TTL = 10 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Search places by name (Open-Meteo Geocoding, free, no key).
export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
  if (q.length < 2) return json({ results: [] });

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json({ results: hit.results });

  try {
    const results = await searchPlaces(q);
    cache.set(key, { at: Date.now(), results });
    return json({ results });
  } catch {
    return json({ error: 'Location search is unavailable right now.' }, 502);
  }
};
