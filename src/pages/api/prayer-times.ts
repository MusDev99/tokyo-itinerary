import type { APIRoute } from 'astro';
import { methodForCountry, PRAYERS, type DayTimings } from '../../utils/prayer';

const cache = ((globalThis as any).__PRAYER_CACHE__ ||= new Map<string, { at: number; value: any }>());
const TTL = 6 * 60 * 60 * 1000; // times are calculated, so they barely change
const MAX_DAYS = 62;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clean = (t: string) => String(t || '').split(' ')[0]; // "05:30 (+08)" -> "05:30"

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

// GET ?lat&lng&from=YYYY-MM-DD&to=YYYY-MM-DD&cc=MY&tz=Asia/Kuala_Lumpur
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams;
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  const from = q.get('from') || '';
  const to = q.get('to') || from;
  const tz = q.get('tz') || 'UTC';
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Valid lat and lng are required' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
    return json({ error: 'from/to must be YYYY-MM-DD dates (from <= to)' }, 400);
  }
  if (!/^[A-Za-z_+\-/0-9]+$/.test(tz)) return json({ error: 'Invalid timezone' }, 400);

  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if ((end.getTime() - start.getTime()) / 86400000 > MAX_DAYS) {
    return json({ error: `Range too long (max ${MAX_DAYS} days)` }, 400);
  }

  const method = methodForCountry(q.get('cc') || '');

  // Months touched by the range
  const months = new Set<string>();
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    months.add(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  }

  try {
    const days: DayTimings[] = [];
    for (const m of months) {
      const [year, month] = m.split('-');
      const key = `cal:${year}-${month}:${lat.toFixed(3)}:${lng.toFixed(3)}:${method.id}:${tz}`;
      const rows = await cached(key, async () => {
        const res = await fetch(
          `https://api.aladhan.com/v1/calendar/${year}/${month}?latitude=${lat}&longitude=${lng}&method=${method.id}&school=0&timezonestring=${encodeURIComponent(tz)}`
        );
        if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
        const data = (await res.json()) as { data: any[] };
        return data.data;
      });
      for (const r of rows) {
        const [dd, mm, yyyy] = String(r.date.gregorian.date).split('-');
        const date = `${yyyy}-${mm}-${dd}`;
        if (date < from || date > to) continue;
        const day: any = { date };
        for (const p of PRAYERS) day[p.key] = clean(r.timings[p.key]);
        days.push(day);
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));

    const qibla = await cached(`qibla:${lat.toFixed(3)}:${lng.toFixed(3)}`, async () => {
      const res = await fetch(`https://api.aladhan.com/v1/qibla/${lat}/${lng}`);
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: { direction?: number } };
      return data.data?.direction ?? null;
    }).catch(() => null);

    return json({ method, timezone: tz, qibla, days });
  } catch {
    return json({ error: 'Prayer times are unavailable right now. Please try again.' }, 502);
  }
};
