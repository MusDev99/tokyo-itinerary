import type { APIRoute } from 'astro';
import { getAllCountriesWithSheets } from '../utils/countries';
import { errorInfo, log } from '../utils/log';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ url }) => {
  // The legal pages are public and static: listed so they are also saved for offline reading
  const paths = new Set<string>(['/', '/privacy', '/terms']);
  try {
    const { countries } = await getAllCountriesWithSheets();
    for (const c of countries) {
      paths.add(`/${c.slug}`);
      paths.add(`/${c.slug}/itinerary`);
      // Every trip: its pages read offline too (the Pocket page holds no private data: bookings load from the API)
      for (const s of c.states) {
        paths.add(`/trips/${s.slug}`);
        paths.add(`/trips/${s.slug}/overview`);
        paths.add(`/trips/${s.slug}/pocket`);
        if (s.stats.hasItinerary) paths.add(`/trips/${s.slug}/analysis`);
      }
    }
  } catch (err) {
    log.error('sitemap_read_failed', errorInfo(err)); // still serve a valid sitemap with the home page
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths]
    .map((p) => `  <url><loc>${esc(url.origin + p)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
