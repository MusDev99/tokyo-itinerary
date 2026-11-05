import type { APIRoute } from 'astro';
import { appendActivities, deleteTrip, getTripDates, getTripMetas, savePlace, saveTripDates, saveTripMeta } from '../../utils/googleSheets';
import { getAllCountriesWithSheets, findTripByTab } from '../../utils/countries';
import { parsePlace } from '../../types/place';
import { clientError } from '../../utils/security';
import { recordAudit } from '../../utils/users';
import { validateRange, buildDays } from '../../utils/tripDraft';
import { stopsFromParts, tabNameFromTitle, uniqueSlug, validateStops, legacyTripSlug, type Stop, type TripMeta } from '../../utils/trips';

// Create and edit titled trips. Needs a signed-in, active editor (PROTECTED_API in src/middleware.ts).
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const who = (locals: App.Locals) => locals.user?.email ?? 'unknown';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');

/** Raw stops from the client: city + number of days (the server lays them out on the dates). */
function parseParts(raw: unknown): Array<{ city: string; country: string; days: number }> {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 20).map((p) => ({ city: str(p?.city, 80), country: str(p?.country, 80), days: Number(p?.days) || 1 })).filter((p) => p.city);
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, 400);
  if (body.website) return json({ ok: true }); // honeypot

  const country = str(body.country, 80);
  const city = str(body.city, 80);
  const start = str(body.dates?.start, 10);
  const end = str(body.dates?.end, 10);
  if (!country) return json({ error: 'Country is required', fieldErrors: { country: 'Country is required' } }, 400);
  const rangeError = validateRange(start, end);
  if (rangeError) return json({ error: rangeError, fieldErrors: { dates: rangeError } }, 400);

  const total = buildDays(start, end).length;
  const parts = parseParts(body.stops);
  if (parts.length === 0) {
    if (!city) return json({ error: 'Add at least one city', fieldErrors: { city: 'City is required' } }, 400);
    parts.push({ city, country, days: total });
  }
  const stops: Stop[] = stopsFromParts(start, total, parts.map((p) => ({ ...p, country: p.country || country })));
  if (stops.length === 0) return json({ error: 'Add at least one city' }, 400);
  const stopError = validateStops(stops, start, end);
  if (stopError) return json({ error: stopError }, 400);

  const year = start.slice(0, 4);
  const title = str(body.title, 100) || `${stops[0].city} trip ${year}`;
  if (title.length < 2) return json({ error: 'Give the trip a title', fieldErrors: { title: 'Give the trip a title' } }, 400);

  let tab = '';
  try {
    const { countries } = await getAllCountriesWithSheets();
    const trips = countries.flatMap((c) => c.states);
    tab = tabNameFromTitle(title, trips.map((t) => t.tabName));
    const slug = uniqueSlug(title, trips.map((t) => t.slug));

    // Create the (empty) tab first; if a later step fails the half-made trip is removed again
    await appendActivities(tab, []);
    try {
      await saveTripMeta(tab, { title, slug, country, stops, createdBy: who(locals), createdAt: new Date().toISOString(), copiedFrom: '' });
      await saveTripDates(tab, { start, end });
    } catch (err) {
      await deleteTrip(tab).catch(() => {});
      throw err;
    }
    const place = parsePlace(body.place);
    if (place) await savePlace(tab, place).catch((err) => console.error('savePlace failed', err instanceof Error ? err.message : 'unknown'));
    await recordAudit({ email: who(locals), action: 'create_trip', tab, target: title.slice(0, 120) });
    return json({ ok: true, tab, slug, href: `/trips/${slug}` });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not create the trip') }, 500);
  }
};

// Edit a trip's title and cities. The slug and the worksheet tab never change, so shared links keep working.
export const PATCH: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const tab = str(body?.tab, 100);
  if (!tab) return json({ error: 'tab is required' }, 400);
  try {
    const { countries } = await getAllCountriesWithSheets();
    const found = findTripByTab(countries, tab);
    if (!found) return json({ error: 'Unknown trip' }, 404);
    const { trip, country } = found;

    const metas = await getTripMetas();
    const current: TripMeta | undefined = metas.find((m) => m.tab.toLowerCase() === trip.tabName.toLowerCase());
    // An old `Country - State` trip gets its registry row on first edit, keeping its derived slug
    const base: Omit<TripMeta, 'tab'> = current
      ? { title: current.title, slug: current.slug, country: current.country, stops: current.stops, createdBy: current.createdBy, createdAt: current.createdAt, copiedFrom: current.copiedFrom }
      : { title: trip.title, slug: trip.slug || legacyTripSlug(country.name, null), country: country.name, stops: [], createdBy: '', createdAt: '', copiedFrom: '' };

    const next = { ...base };
    if (body.title !== undefined) {
      const title = str(body.title, 100);
      if (title.length < 2) return json({ error: 'Give the trip a title', fieldErrors: { title: 'Give the trip a title' } }, 400);
      next.title = title;
    }
    if (body.stops !== undefined) {
      const range = (await getTripDates(trip.tabName)) ?? (trip.stats.firstDate && trip.stats.lastDate ? { start: trip.stats.firstDate.slice(0, 10), end: trip.stats.lastDate.slice(0, 10) } : null);
      if (!range) return json({ error: 'Set the trip dates before adding cities' }, 400);
      const parts = parseParts(body.stops);
      const stops = stopsFromParts(range.start, buildDays(range.start, range.end).length, parts.map((p) => ({ ...p, country: p.country || next.country })));
      const stopError = validateStops(stops, range.start, range.end);
      if (stopError) return json({ error: stopError }, 400);
      next.stops = stops;
    }
    await saveTripMeta(trip.tabName, next);
    await recordAudit({ email: who(locals), action: 'update_trip', tab: trip.tabName, target: next.title.slice(0, 120) });
    return json({ ok: true, slug: next.slug, title: next.title });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not update the trip') }, 500);
  }
};
