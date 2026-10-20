export interface Place {
  name: string;
  admin1?: string;
  country: string;
  country_code: string;
  lat: number;
  lng: number;
  timezone: string;
}

export function placeLabel(p: Place): string {
  return [p.name, p.admin1, p.country].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
}

/** Runtime check for untrusted input (API bodies). */
export function parsePlace(raw: any): Place | null {
  if (!raw || typeof raw !== 'object') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 120) : '';
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const timezone = typeof raw.timezone === 'string' ? raw.timezone.slice(0, 60) : 'UTC';
  if (!/^[A-Za-z_+\-/0-9]+$/.test(timezone)) return null;
  return {
    name,
    admin1: typeof raw.admin1 === 'string' ? raw.admin1.trim().slice(0, 120) : undefined,
    country: typeof raw.country === 'string' ? raw.country.trim().slice(0, 120) : '',
    country_code: typeof raw.country_code === 'string' ? raw.country_code.trim().toUpperCase().slice(0, 2) : '',
    lat,
    lng,
    timezone,
  };
}
