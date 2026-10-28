import { getAllCountriesWithSheets } from './countries';
import { getPlace } from './googleSheets';
import { buildCalendar } from './ics';
import { authConfig } from './authEnv';

/**
 * Serves a trip's iCalendar feed: the same public data as the trip pages (read-only, no sign-in), so calendar
 * apps can subscribe. Reads go through the cached Sheets helpers (no per-request fan-out).
 */
export async function tripCalendarResponse(request: Request, countrySlug?: string, stateSlug?: string): Promise<Response> {
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  const { countries } = await getAllCountriesWithSheets();
  const country = countries.find((c) => c.slug === countrySlug?.toLowerCase());
  if (!country) return notFound();
  const state = stateSlug ? country.states.find((s) => s.slug === stateSlug.toLowerCase()) : undefined;
  if (stateSlug && !state) return notFound();

  const days = state ? state.itinerary : country.itinerary;
  // Saved place per tab (Tools tab) gives the IANA zone; a merged country feed looks it up per day's state
  const tabs = state ? [state] : country.states.length ? country.states : [{ name: country.name, tabName: country.tabName }];
  const zones = new Map<string, string | undefined>();
  await Promise.all(tabs.map(async (t) => zones.set(t.name, (await getPlace(t.tabName))?.timezone)));
  const zoneFor = (dayState?: string) => zones.get(state ? state.name : dayState || tabs[0].name) ?? zones.get(tabs[0].name);

  // SITE_URL first: behind Vercel's proxy the request URL can come through as http://
  const origin = authConfig().siteUrl || new URL(request.url).origin;
  const path = `/${country.slug}${state ? `/${state.slug}` : '/itinerary'}`;
  const name = state ? `${country.name} – ${state.name} trip` : `${country.name} trip`;
  const body = buildCalendar({ name, days, url: origin + path, timezoneFor: (d) => zoneFor(d.state) });

  const download = new URL(request.url).searchParams.has('download');
  const file = `${country.slug}${state ? `-${state.slug}` : ''}-trip.ics`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${file}"`,
      // Calendar apps poll; a short shared cache keeps Sheets reads low without serving stale trips for long
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
