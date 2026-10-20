import type { APIRoute } from 'astro';
import {
  appendActivities,
  updateActivity,
  deleteActivity,
  deleteTrip,
  renameTrip,
  type ActivityInput,
} from '../../utils/googleSheets';
import { buildTabName, slugify, RESERVED_SLUGS } from '../../utils/countries';
import { savePlace } from '../../utils/googleSheets';
import { parsePlace } from '../../types/place';

const MAX_ACTIVITIES = 50;
const TAB_FORBIDDEN = /[\[\]*?:\/\\'!]/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Validates one activity; returns the clean record or a map of field errors. */
function parseActivity(raw: any, requireDayTitle = false): { value?: ActivityInput; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};
  const date = str(raw?.date, 20);
  const title = str(raw?.title, 200);
  const time = str(raw?.time, 20);
  const dayTitle = str(raw?.day_title, 200);

  if (!date || isNaN(new Date(date).getTime())) errors.date = 'Valid date is required';
  if (!title) errors.title = 'Title is required';
  if (!time) errors.time = 'Time is required';
  if (requireDayTitle && !dayTitle) errors.day_title = 'Day title is required';

  let amount: number | null = null;
  if (raw?.price_amount !== undefined && raw?.price_amount !== null && raw?.price_amount !== '') {
    amount = Number(raw.price_amount);
    if (!Number.isFinite(amount) || amount < 0) errors.price_amount = 'Amount must be 0 or more';
  }

  const currency = str(raw?.price_currency, 3).toUpperCase();
  if (currency && !/^[A-Z]{3}$/.test(currency)) errors.price_currency = 'Use a 3-letter currency code';

  if (Object.keys(errors).length) return { errors };

  return {
    value: {
      date,
      title,
      time,
      ...(dayTitle ? { day_title: dayTitle } : {}),
      description: str(raw?.description, 2000),
      category: str(raw?.category, 40),
      location_name: str(raw?.location_name, 200),
      price_amount: amount,
      price_currency: currency,
      price_notes: str(raw?.price_notes, 200),
    },
  };
}

function validateTab(country: string, state: string): string | null {
  if (!country) return 'Country is required';
  if (!state) return 'State / city is required';
  if (TAB_FORBIDDEN.test(country) || TAB_FORBIDDEN.test(state)) {
    return "Country and state can't contain [ ] * ? : / \\ ' !";
  }
  if (country.includes(' - ') || state.includes(' - ')) return "Country and state can't contain ' - '";
  if (buildTabName(country, state).length > 100) return 'Country + state is too long';
  const cs = slugify(country);
  const ss = slugify(state);
  if (!cs || !ss) return 'Country and state need at least one letter or number';
  if (RESERVED_SLUGS.has(cs) || RESERVED_SLUGS.has(ss)) return 'That name is reserved';
  return null;
}

// Create a trip tab (if new) and/or append activities.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'Invalid JSON body' }, 400);

  // Honeypot: bots fill hidden fields. Pretend success.
  if (body.website) return json({ ok: true });

  const country = str(body.country, 60);
  const state = str(body.state, 60);
  const tabError = validateTab(country, state);
  if (tabError) return json({ error: tabError, fieldErrors: { trip: tabError } }, 400);

  const rawActivities = Array.isArray(body.activities) ? body.activities : [];
  if (rawActivities.length === 0) return json({ error: 'Add at least one activity' }, 400);
  if (rawActivities.length > MAX_ACTIVITIES) {
    return json({ error: `Max ${MAX_ACTIVITIES} activities per submit` }, 400);
  }

  const activities: ActivityInput[] = [];
  const rowErrors: Array<Record<string, string>> = [];
  let hasErrors = false;
  for (const raw of rawActivities) {
    const parsed = parseActivity(raw, true);
    rowErrors.push(parsed.errors || {});
    if (parsed.errors) hasErrors = true;
    else activities.push(parsed.value!);
  }
  if (hasErrors) return json({ error: 'Please fix the highlighted fields', rowErrors }, 400);

  try {
    const result = await submitItinerary(buildTabName(country, state), activities);
    // Save the confirmed location (best-effort: itinerary rows are already written)
    const place = parsePlace(body.place);
    let placeSaved = false;
    if (place) {
      try {
        await savePlace(result.tab, place);
        placeSaved = true;
      } catch {}
    }
    return json({
      placeSaved,
      ok: true,
      tab: result.tab,
      created: result.created,
      count: activities.length,
      href: `/${slugify(country)}/${slugify(state)}`,
    });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to save itinerary' }, 500);
  }
};

function parseRef(body: any) {
  const id = str(body?.id, 64);
  const row = Number(body?.row);
  const ref: { id?: string; row?: number; expectTitle?: string } = {};
  if (id) ref.id = id;
  else if (Number.isInteger(row) && row > 1) {
    ref.row = row;
    ref.expectTitle = str(body?.expectTitle, 200);
  }
  return ref.id || ref.row ? ref : null;
}

// Edit one activity, or rename a whole trip ({ tab, rename: { country, state } }).
export const PATCH: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const tab = str(body?.tab, 100);
  if (!tab) return json({ error: 'tab is required' }, 400);

  if (body?.rename) {
    const country = str(body.rename.country, 60);
    const state = str(body.rename.state, 60);
    const tabError = validateTab(country, state);
    if (tabError) return json({ error: tabError }, 400);
    try {
      const newTab = buildTabName(country, state);
      await renameTrip(tab, newTab);
      return json({ ok: true, tab: newTab, href: `/${slugify(country)}/${slugify(state)}` });
    } catch (err: any) {
      return json({ error: err?.message || 'Failed to rename trip' }, 500);
    }
  }

  const ref = parseRef(body);
  if (!ref) return json({ error: 'id (or row) is required' }, 400);
  const parsed = parseActivity(body?.activity);
  if (parsed.errors) return json({ error: 'Please fix the highlighted fields', rowErrors: [parsed.errors] }, 400);
  try {
    await updateActivity(tab, ref, parsed.value!);
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to update activity' }, 500);
  }
};

// Delete one activity, or a whole trip ({ tab, wholeTrip: true }).
export const DELETE: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const tab = str(body?.tab, 100);
  if (!tab) return json({ error: 'tab is required' }, 400);

  try {
    if (body?.wholeTrip === true) {
      await deleteTrip(tab);
      return json({ ok: true });
    }
    const ref = parseRef(body);
    if (!ref) return json({ error: 'id (or row) is required' }, 400);
    await deleteActivity(tab, ref);
    return json({ ok: true });
  } catch (err: any) {
    return json({ error: err?.message || 'Failed to delete' }, 500);
  }
};

/**
 * Single write seam: today this writes straight to Google Sheets. To move to an
 * "email draft -> approve" flow later, replace only this function.
 */
async function submitItinerary(tabName: string, activities: ActivityInput[]) {
  return appendActivities(tabName, activities);
}
