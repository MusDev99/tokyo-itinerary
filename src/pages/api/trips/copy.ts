import type { APIRoute } from 'astro';
import { appendActivities, deleteTrip, getPlace, savePlace, saveTripDates, saveTripMeta } from '../../../utils/googleSheets';
import { getAllCountriesWithSheets, tripBySlug } from '../../../utils/countries';
import { clientError } from '../../../utils/security';
import { recordAudit } from '../../../utils/users';
import { chunk } from '../../../utils/chunk';
import { isIsoDate, MAX_TRIP_DAYS } from '../../../utils/tripDraft';
import { planCopy, type DaySelection } from '../../../utils/tripCopy';
import { tabNameFromTitle, uniqueSlug, type Stop } from '../../../utils/trips';

// Copy a trip (whole, or picked days / activities) to a new start date. Needs a signed-in, active editor
// (/api/trips is in PROTECTED_API). Anyone can OPEN any trip; copying creates a new trip owned by the editor.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const who = (locals: App.Locals) => locals.user?.email ?? 'unknown';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '');
const MAX_COPIED = 300;
const CHUNK = 50;

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, 400);
  if (body.website) return json({ ok: true }); // honeypot

  const sourceSlug = str(body.sourceSlug, 80);
  const start = str(body.start, 10);
  if (!sourceSlug) return json({ error: 'Pick a trip to copy' }, 400);
  if (!isIsoDate(start)) return json({ error: 'Pick the new start date', fieldErrors: { dates: 'Pick the new start date' } }, 400);

  const selection: DaySelection[] | undefined = Array.isArray(body.selection)
    ? body.selection.slice(0, 120).map((s: any) => ({ date: str(s?.date, 10), ...(Array.isArray(s?.ids) ? { ids: s.ids.slice(0, 200).map((x: unknown) => str(x, 80)) } : {}) }))
    : undefined;

  let tab = '';
  try {
    const { countries } = await getAllCountriesWithSheets();
    const source = tripBySlug(countries, sourceSlug);
    if (!source) return json({ error: 'That trip no longer exists' }, 404);

    const plan = planCopy(source.stateMeta.itinerary, start, { selection, includePrices: body.includePrices !== false });
    if ('error' in plan) return json({ error: plan.error }, 400);
    if (plan.activities.length > MAX_COPIED) return json({ error: `A copy holds at most ${MAX_COPIED} activities: pick fewer days` }, 400);
    if (plan.days > MAX_TRIP_DAYS) return json({ error: `A trip can span at most ${MAX_TRIP_DAYS} days` }, 400);

    const title = str(body.title, 100) || `${source.stateMeta.title} (copy)`;
    if (title.length < 2) return json({ error: 'Give the trip a title', fieldErrors: { title: 'Give the trip a title' } }, 400);
    const trips = countries.flatMap((c) => c.states);
    tab = tabNameFromTitle(title, trips.map((t) => t.tabName));
    const slug = uniqueSlug(title, trips.map((t) => t.slug));
    const country = source.baseCountry.name;
    const stops: Stop[] = plan.cityRuns.map((r) => ({ city: r.city, country, start: r.start, end: r.end }));

    // Create the (empty) tab, then write in chunks. If anything fails the half-made copy is removed again.
    await appendActivities(tab, []);
    try {
      for (const part of chunk(plan.activities, CHUNK)) await appendActivities(tab, part);
      await saveTripMeta(tab, { title, slug, country, stops, createdBy: who(locals), createdAt: new Date().toISOString(), copiedFrom: source.stateMeta.slug });
      await saveTripDates(tab, { start: plan.start, end: plan.end });
    } catch (err) {
      await deleteTrip(tab).catch(() => {});
      throw err;
    }
    // The place (prayer times, timezone) comes along; best-effort like everywhere else
    const place = await getPlace(source.stateMeta.tabName);
    if (place) await savePlace(tab, place).catch(() => {});
    await recordAudit({ email: who(locals), action: 'copy_trip', tab, target: `from ${source.stateMeta.slug}, ${plan.activities.length} activities`.slice(0, 120) });
    return json({ ok: true, tab, slug, href: `/trips/${slug}`, count: plan.activities.length });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not copy the trip') }, 500);
  }
};
