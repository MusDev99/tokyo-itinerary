// First-visit welcome: who should be sent to /welcome, and the cookie that remembers they saw it.
// Pure and dependency-free so tests/welcome.test.ts can run it directly.

export const WELCOME_COOKIE = 'pt_welcome';
export const WELCOME_MAX_AGE = 60 * 60 * 24 * 365;

export interface WelcomeCheck {
  method: string;
  signedIn: boolean;
  /** Value of the WELCOME_COOKIE, if any. */
  seen: string | undefined;
  accept: string | null;
  userAgent: string | null;
  /** `Sec-Purpose` / `Purpose` header: prefetches must not set the cookie or redirect. */
  purpose: string | null;
}

// Crawlers and link-preview bots keep reading the real home page (SEO, shared links).
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

/** True when a page view is a person's first visit: a guest, no cookie yet, a real HTML navigation. */
export function shouldShowWelcome(c: WelcomeCheck): boolean {
  if (c.method !== 'GET') return false;
  if (c.signedIn || c.seen === '1') return false;
  if (!(c.accept ?? '').includes('text/html')) return false;
  if (/prefetch|prerender/i.test(c.purpose ?? '')) return false;
  if (BOT.test(c.userAgent ?? '')) return false;
  return true;
}

/** Counts shown on the landing page, from whatever the sheet returned (never negative, never NaN). */
export function worldTotals(countries: Array<{ stats: { hasItinerary: boolean; totalDays: number; totalActivities: number } }>) {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
  let trips = 0;
  let days = 0;
  let activities = 0;
  for (const c of countries) {
    if (!c.stats.hasItinerary) continue;
    trips += 1;
    days += n(c.stats.totalDays);
    activities += n(c.stats.totalActivities);
  }
  return { countries: countries.length, trips, days, activities };
}

/** The three "how it works" steps, in order (one definition for the page and its tests). */
export const WELCOME_STEPS = [
  { id: 'browse', icon: '🌏', title: 'Browse', text: 'Pick a country or city. Every trip is open to read, no account needed.' },
  { id: 'plan', icon: '🗓️', title: 'Plan', text: 'Sign in to add days and activities. Costs and times are saved to your Google Sheet.' },
  { id: 'go', icon: '🧭', title: 'Go', text: "On the trip, Today shows what's on now and next. Everything you saved reads offline." },
] as const;
