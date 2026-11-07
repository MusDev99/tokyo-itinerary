/**
 * Where the header's back arrow goes when there is no earlier page of this site to return to (a link opened from a
 * message, a bookmark, a new tab). Pure and unit-tested. The old rule ("drop the last path segment") sent people from
 * `/trips/<slug>` to `/trips`, which is not a page: a 404.
 *
 * `tripParents` maps a trip slug to its natural "up" page: its country page, or `/` for a trip that is a plain
 * country tab (that country page would just redirect back to the trip).
 */
const TRIP_VIEWS = new Set(['overview', 'analysis', 'pocket', 'tools', 'prepare']);

export function backTarget(path: string, tripParents: Record<string, string> = {}): string {
  const clean = (path || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return '/';

  if (parts[0] === 'trips') {
    const slug = parts[1];
    if (!slug) return '/'; // `/trips` is not a page
    const up = tripParents[slug] ?? '/';
    if (parts.length === 2) return up; // the itinerary
    // The client page belongs to the trip; the tabs (Overview, Analysis, Pocket) are siblings of the itinerary
    return parts[2] === 'share' ? `/trips/${slug}` : TRIP_VIEWS.has(parts[2]) ? up : `/trips/${slug}`;
  }

  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
}

/**
 * Is there an earlier page of this site in the history to go back to? Soft navigation (Astro's router) keeps its own
 * position in `history.state.index`: above 0 means we navigated here from another page of the site. `document.referrer`
 * is only the page that sent the first full load, so on its own it says "no history" after every soft navigation.
 */
export function hasSiteHistory(state: unknown, referrer: string, origin: string, historyLength: number): boolean {
  const index = (state as { index?: unknown } | null)?.index;
  if (typeof index === 'number') return index > 0;
  try {
    return Boolean(referrer) && new URL(referrer).origin === origin && historyLength > 1;
  } catch {
    return false;
  }
}
