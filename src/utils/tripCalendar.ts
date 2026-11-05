import { getAllCountriesWithSheets, tripBySlug } from './countries';
import { legacyTripSlug } from './trips';
import { getPlace } from './googleSheets';
import { buildCalendar } from './ics';
import { authConfig } from './authEnv';

/**
 * Serves a trip's iCalendar feed: the same public data as the trip pages (read-only, no sign-in), so calendar
 * apps can subscribe. Reads go through the cached Sheets helpers (no per-request fan-out).
 */
export async function tripCalendarResponse(
  request: Request,
  target: { tripSlug?: string; countrySlug?: string; stateSlug?: string }
): Promise<Response> {
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { countries } = await getAllCountriesWithSheets();

  // One trip (`/trips/<slug>/calendar.ics`, or the old `/<country>/<state>/calendar.ics`), or a whole country
  const tripSlug = target.tripSlug ?? (target.stateSlug ? legacyTripSlug(target.countrySlug ?? '', target.stateSlug) : undefined);
  const found = tripSlug ? tripBySlug(countries, tripSlug) : null;
  if (tripSlug && !found) return notFound();
  const country = found ? found.baseCountry : countries.find((c) => c.slug === target.countrySlug?.toLowerCase());
  if (!country) return notFound();
  const state = found?.stateMeta;

  const days = state ? state.itinerary : country.itinerary;
  // Saved place per trip (Pocket tab) gives the IANA zone; a merged country feed looks it up per day's trip/city
  const tabs = state ? [state] : country.states.length ? country.states : [{ name: country.name, tabName: country.tabName }];
  const zones = new Map<string, string | undefined>();
  await Promise.all(tabs.map(async (t) => zones.set(t.name, (await getPlace(t.tabName))?.timezone)));
  const zoneFor = (dayState?: string) => zones.get(state ? state.name : dayState || tabs[0].name) ?? zones.get(tabs[0].name);

  // SITE_URL first: behind Vercel's proxy the request URL can come through as http://
  const origin = authConfig().siteUrl || new URL(request.url).origin;
  const path = state ? `/trips/${state.slug}` : `/${country.slug}/itinerary`;
  const name = state ? state.title : `${country.name} trip`;
  const body = buildCalendar({ name, days, url: origin + path, timezoneFor: (d) => zoneFor(d.state) });

  const download = new URL(request.url).searchParams.has('download');
  const file = `${state ? state.slug : country.slug}-trip.ics`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${file}"`,
      // Calendar apps poll; a short shared cache keeps Sheets reads low without serving stale trips for long
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
