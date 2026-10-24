import type { APIRoute } from 'astro';

// Admin and API paths are never useful in search results; the sitemap lists the public trip pages.
export const GET: APIRoute = ({ url }) =>
  new Response(
    ['User-agent: *', 'Disallow: /add', 'Disallow: /login', 'Disallow: /api/', `Sitemap: ${url.origin}/sitemap.xml`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } }
  );
