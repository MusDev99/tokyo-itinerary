import type { APIRoute } from 'astro';
import { findTabTitle, savePlace } from '../../utils/googleSheets';
import { parsePlace } from '../../types/place';
import { clientError } from '../../utils/security';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// Confirm / change the saved location of an existing trip tab.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const tab = typeof body?.tab === 'string' ? body.tab.trim().slice(0, 100) : '';
  const place = parsePlace(body?.place);
  if (!tab || !place) return json({ error: 'tab and a valid place are required' }, 400);
  try {
    const exact = await findTabTitle(tab);
    if (!exact) return json({ error: 'Trip tab not found.' }, 404);
    await savePlace(exact, place);
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: clientError(err, 'Failed to save place') }, 500);
  }
};
