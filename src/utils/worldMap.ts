// World map geometry: where a country's pin sits on public/world-map.svg. Pure and dependency-free (tested).
// The SVG is equirectangular: 2 units per degree, longitude -180..180, latitude 84..-58 (scripts/build-world-map.mjs).

export const MAP_W = 720;
export const MAP_H = 284;
const LAT_MAX = 84;
const LAT_MIN = -58;

/** [latitude, longitude] of a place travellers actually go (a main city), keyed by country slug. */
export const PIN_COORDS: Record<string, [number, number]> = {
  japan: [35.7, 139.7], kazakhstan: [43.2, 76.9], china: [39.9, 116.4], turkey: [41.0, 28.98], australia: [-33.9, 151.2],
  korea: [37.6, 127.0], 'south-korea': [37.6, 127.0], thailand: [13.75, 100.5], indonesia: [-8.4, 115.2], malaysia: [3.14, 101.7],
  singapore: [1.35, 103.8], vietnam: [21.0, 105.8], taiwan: [25.0, 121.5], switzerland: [46.95, 7.45], uk: [51.5, -0.12],
  'united-kingdom': [51.5, -0.12], france: [48.85, 2.35], italy: [41.9, 12.5], spain: [40.4, -3.7], germany: [52.5, 13.4],
  usa: [38.9, -77.0], 'united-states': [38.9, -77.0], canada: [43.65, -79.4], 'new-zealand': [-36.85, 174.8],
  'saudi-arabia': [21.5, 39.2], uae: [25.2, 55.3], 'united-arab-emirates': [25.2, 55.3], egypt: [30.0, 31.2], morocco: [31.6, -8.0],
  india: [28.6, 77.2], philippines: [14.6, 121.0], cambodia: [13.4, 103.9], laos: [19.9, 102.1], nepal: [27.7, 85.3],
  'sri-lanka': [6.9, 79.9], maldives: [4.2, 73.5], 'hong-kong': [22.3, 114.2], uzbekistan: [41.3, 69.2], jordan: [31.95, 35.9],
  greece: [37.98, 23.7], portugal: [38.7, -9.1], netherlands: [52.4, 4.9], austria: [48.2, 16.4], czechia: [50.1, 14.4],
  croatia: [45.8, 16.0], iceland: [64.1, -21.9], norway: [59.9, 10.75], brazil: [-22.9, -43.2], mexico: [19.4, -99.1],
  argentina: [-34.6, -58.4], peru: [-12.05, -77.0], 'south-africa': [-33.9, 18.4], kenya: [-1.3, 36.8], tanzania: [-6.8, 39.3],
  qatar: [25.3, 51.5], oman: [23.6, 58.4], russia: [55.75, 37.6], azerbaijan: [40.4, 49.9], georgia: [41.7, 44.8],
  kyrgyzstan: [42.9, 74.6], brunei: [4.9, 114.9], myanmar: [16.8, 96.15], bali: [-8.4, 115.2],
};

/** Position as percentages of the map box (left, top), clamped inside it. */
export function project(lat: number, lon: number): { left: number; top: number } {
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  return {
    left: clamp(((lon + 180) / 360) * 100),
    top: clamp(((LAT_MAX - Math.max(LAT_MIN, Math.min(LAT_MAX, lat))) / (LAT_MAX - LAT_MIN)) * 100),
  };
}

export interface MapCountry {
  slug: string;
  name: string;
  flag: string;
  stats: { hasItinerary: boolean; totalDays: number; totalActivities: number };
}

export interface MapPin {
  slug: string;
  name: string;
  flag: string;
  planned: boolean;
  days: number;
  activities: number;
  left: number;
  top: number;
}

/** Splits countries into pins on the map and the ones we have no coordinates for (they stay reachable as chips). */
export function placePins(countries: MapCountry[]): { pins: MapPin[]; unplaced: MapCountry[] } {
  const pins: MapPin[] = [];
  const unplaced: MapCountry[] = [];
  for (const c of countries) {
    const at = PIN_COORDS[c.slug];
    if (!at) {
      unplaced.push(c);
      continue;
    }
    const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    pins.push({
      slug: c.slug,
      name: c.name,
      flag: c.flag,
      planned: c.stats.hasItinerary,
      days: n(c.stats.totalDays),
      activities: n(c.stats.totalActivities),
      ...project(at[0], at[1]),
    });
  }
  // Planned trips first, so the default selection and tab order start with something to open
  pins.sort((a, b) => Number(b.planned) - Number(a.planned));
  return { pins, unplaced };
}
