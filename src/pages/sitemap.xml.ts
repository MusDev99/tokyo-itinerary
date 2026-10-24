import type { APIRoute } from 'astro';
import { getAllCountriesWithSheets } from '../utils/countries';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const GET: APIRoute = async ({ url }) => {
  const paths = new Set<string>(['/']);
  try {
    const { countries } = await getAllCountriesWithSheets();
    for (const c of countries) {
      paths.add(`/${c.slug}`);
      paths.add(`/${c.slug}/itinerary`);
      for (const s of c.states) paths.add(`/${c.slug}/${s.slug}`);
    }
  } catch (err) {
    console.error('sitemap: could not read Google Sheets', err); // still serve a valid sitemap with the home page
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...paths]
    .map((p) => `  <url><loc>${esc(url.origin + p)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
};
