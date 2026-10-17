import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  const urlObj = new URL(request.url);
  const base = urlObj.searchParams.get('base') || 'MYR';
  const target = urlObj.searchParams.get('target') || 'JPY';

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
    if (response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch {
    // Offline or build-time fallback
  }

  // Fallback response for offline / build time
  return new Response(
    JSON.stringify({
      result: 'success',
      base_code: base,
      rates: {
        MYR: 1.0,
        JPY: 35.5,
        KZT: 108.2,
        CNY: 1.62,
        TRY: 7.75,
        AUD: 0.35,
        USD: 0.225,
        EUR: 0.21,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
};