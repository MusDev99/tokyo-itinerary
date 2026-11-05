import type { APIRoute } from 'astro';
import { getAllCountriesWithSheets } from '../../utils/countries';
import { buildSuggestions, filterSuggestions } from '../../utils/suggestions';

// Places other trips already used, ranked by how many trips used them. Read-only and public like the trip pages
// themselves (it only repeats what they show), so no sign-in; creating a trip from it still needs one.
export const GET: APIRoute = async ({ url }) => {
  try {
    const { countries } = await getAllCountriesWithSheets();
    const all = buildSuggestions(countries.flatMap((c) => c.states.map((s) => ({ slug: s.slug, cities: s.cities, itinerary: s.itinerary }))));
    const q = url.searchParams;
    const items = filterSuggestions(all, {
      q: (q.get('q') || '').slice(0, 80),
      city: (q.get('city') || '').slice(0, 80),
      category: (q.get('category') || '').slice(0, 30),
      limit: 200,
    });
    // The city list for the filter, by how many places each has
    const cityCount = new Map<string, number>();
    for (const s of all) if (s.city) cityCount.set(s.city, (cityCount.get(s.city) || 0) + 1);
    const cities = [...cityCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([c]) => c);
    return new Response(JSON.stringify({ ok: true, items, cities, total: all.length }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=30' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Could not load suggestions' }), { status: 500, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
};
