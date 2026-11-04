import type { APIRoute } from 'astro';
import { listPocket, addPocket, updatePocket, deletePocket } from '../../utils/googleSheets';
import { getAllCountriesWithSheets } from '../../utils/countries';
import { parsePocketItem, sortItems } from '../../utils/pocket';
import { clientError } from '../../utils/security';
import { recordAudit } from '../../utils/users';

// Every verb (GET too) needs a signed-in, active editor: see PROTECTED_API in src/middleware.ts.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const who = (locals: App.Locals) => locals.user?.email ?? 'unknown';
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Only existing trip tabs are accepted, so the hidden sheet can't be filled with made-up trips. */
async function knownTab(tab: string): Promise<string | null> {
  if (!tab) return null;
  const { countries } = await getAllCountriesWithSheets();
  const wanted = tab.toLowerCase();
  for (const c of countries) {
    if (c.tabName && c.tabName.toLowerCase() === wanted) return c.tabName;
    for (const st of c.states) if (st.tabName.toLowerCase() === wanted) return st.tabName;
  }
  return null;
}

// Audit log keeps only kind + title: never notes, confirmation codes or links (OWASP A09).
const target = (item: { kind: string; title: string }) => `${item.kind}: ${item.title}`.slice(0, 120);

export const GET: APIRoute = async ({ url }) => {
  try {
    const tab = await knownTab(str(url.searchParams.get('tab'), 100));
    if (!tab) return json({ error: 'Unknown trip' }, 404);
    const items = sortItems(await listPocket(tab)).map(({ rowNumber, ...item }) => item);
    return json({ ok: true, items });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not load your Pocket') }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, 400);
  if (body.website) return json({ ok: true }); // honeypot
  try {
    const tab = await knownTab(str(body.tab, 100));
    if (!tab) return json({ error: 'Unknown trip' }, 404);
    const parsed = parsePocketItem(body.item);
    if (parsed.errors) return json({ error: 'Please fix the highlighted fields', fieldErrors: parsed.errors }, 400);
    const item = await submitPocket(tab, parsed.value!, who(locals));
    await recordAudit({ email: who(locals), action: 'pocket_add', tab, target: target(item) });
    return json({ ok: true, item });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not save to your Pocket') }, 500);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const id = str(body?.id, 64);
  if (!id) return json({ error: 'id is required' }, 400);
  try {
    const tab = await knownTab(str(body?.tab, 100));
    if (!tab) return json({ error: 'Unknown trip' }, 404);
    const parsed = parsePocketItem(body?.item);
    if (parsed.errors) return json({ error: 'Please fix the highlighted fields', fieldErrors: parsed.errors }, 400);
    if (!(await updatePocket(tab, id, parsed.value!))) return json({ error: 'Item not found' }, 404);
    await recordAudit({ email: who(locals), action: 'pocket_update', tab, target: target(parsed.value!) });
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not update your Pocket') }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const id = str(body?.id, 64);
  if (!id) return json({ error: 'id is required' }, 400);
  try {
    const tab = await knownTab(str(body?.tab, 100));
    if (!tab) return json({ error: 'Unknown trip' }, 404);
    if (!(await deletePocket(tab, id))) return json({ error: 'Item not found' }, 404);
    await recordAudit({ email: who(locals), action: 'pocket_delete', tab, target: id });
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: clientError(err, 'Could not delete from your Pocket') }, 500);
  }
};

/** Single write seam for Pocket (same idea as submitItinerary). */
async function submitPocket(tab: string, input: Parameters<typeof addPocket>[1], by: string) {
  return addPocket(tab, input, by);
}
