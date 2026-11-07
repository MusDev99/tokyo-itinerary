import type { DayItinerary } from '../types/itinerary';
import { cacheState, timed, type Timed } from './swr';
import { WORLD_COUNTRIES, worldCountry } from './worldCountries';
import { cityForDay, citiesLabel, legacyTripSlug, orderedCities, RESERVED_TRIP_SLUGS, uniqueSlug, type Stop, type TripMeta } from './trips';
import { quotaGate, sheetsStats } from './quota';
import { applyTabUpdate, lastUsedRow, tabSlug, type RawTrips } from './cacheTabs';
import {
  cacheHooks,
  readTabRows,
  rowsToDayItinerary,
  pullCountriesFromGoogleSheets,
  getTripMetas,
  resolveSpreadsheetId,
  loadServiceAccountCredentials,
  type SheetSyncResult,
} from './googleSheets';

/**
 * One trip: a worksheet tab with a title. Its `slug` is the stable `/trips/<slug>` address (a registry row stores it;
 * an old `Country - State` tab without a registry row gets `country-state`). The type keeps its historical name
 * because most screens still read a country's trips as its "states".
 */
export interface StateMetadata {
  /** Stable trip slug (the address is /trips/<slug>) */
  slug: string;
  /** Short label: the city for an old `Country - State` tab, the title for a titled trip */
  name: string;
  /** The trip's title ("Tokyo, Japan" for an old tab) */
  title: string;
  tabName: string;
  currency: string;
  itinerary: DayItinerary[];
  stats: CountryMetadata['stats'];
  /** Cities in visiting order (from the rows, then the registry stops) */
  cities: string[];
  stops: Stop[];
  /** true for an old `Country - State` tab that has no registry row */
  legacy: boolean;
  createdBy: string;
  copiedFrom: string;
}

export interface CountryMetadata {
  slug: string;
  name: string;
  tabName: string;
  flag: string;
  currency: string;
  description: string;
  title: string;
  region?: string;
  season?: string;
  itinerary: DayItinerary[];
  dataSource: 'google-sheets';
  /** Per-state tabs ("Japan - Tokyo"). Empty for plain country tabs. */
  states: StateMetadata[];
  stats: {
    totalDays: number;
    totalActivities: number;
    totalLocalCost: number;
    firstDate: string | null;
    lastDate: string | null;
    hasItinerary: boolean;
  };
}

const COUNTRY_DEFAULTS: Record<
  string,
  { flag: string; currency: string; description: string; region?: string }
> = {
  japan: {
    flag: '🇯🇵',
    currency: 'JPY',
    description: 'Explore ancient shrines, neon-lit cities, Mount Fuji, and culinary wonders.',
    region: 'Tokyo & Mt. Fuji',
  },
  kazakhstan: {
    flag: '🇰🇿',
    currency: 'KZT',
    description: 'Discover alpine lakes, dramatic canyons, and modern Silk Road heritage in Almaty.',
    region: 'Almaty & Tian Shan',
  },
  china: {
    flag: '🇨🇳',
    currency: 'CNY',
    description: 'Discover vast imperial landscapes, high-speed marvels, and millennia of history.',
    region: 'Mainland China',
  },
  turkey: {
    flag: '🇹🇷',
    currency: 'TRY',
    description: 'A crossroads of empires offering fairy chimneys, bazaars, and coastal beauty.',
    region: 'Istanbul & Cappadocia',
  },
  australia: {
    flag: '🇦🇺',
    currency: 'AUD',
    description: 'From iconic coastal cities to the outback, wildlife, and natural wonders.',
    region: 'Sydney & Melbourne',
  },
  korea: {
    flag: '🇰🇷',
    currency: 'KRW',
    description: 'Vibrant K-culture, royal palaces, street food markets, and scenic mountains.',
  },
  'south-korea': {
    flag: '🇰🇷',
    currency: 'KRW',
    description: 'Vibrant K-culture, royal palaces, street food markets, and scenic mountains.',
  },
  thailand: {
    flag: '🇹🇭',
    currency: 'THB',
    description: 'Golden temples, tropical islands, night markets, and world-famous street food.',
  },
  indonesia: {
    flag: '🇮🇩',
    currency: 'IDR',
    description: 'Volcanic landscapes, emerald rice terraces, and rich archipelago culture.',
  },
  malaysia: {
    flag: '🇲🇾',
    currency: 'MYR',
    description: 'Diverse heritage, modern skylines, rainforests, and culinary fusion.',
  },
  singapore: {
    flag: '🇸🇬',
    currency: 'SGD',
    description: 'Futuristic gardens, hawker culture, and world-class urban architecture.',
  },
  vietnam: {
    flag: '🇻🇳',
    currency: 'VND',
    description: 'Limestone karsts, lantern-lit ancient towns, and vibrant coffee culture.',
  },
  taiwan: {
    flag: '🇹🇼',
    currency: 'TWD',
    description: 'Bustling night markets, misty mountain railways, and hot springs.',
  },
  switzerland: {
    flag: '🇨🇭',
    currency: 'CHF',
    description: 'Panoramic alpine peaks, glacier express trains, and pristine lakes.',
  },
  uk: {
    flag: '🇬🇧',
    currency: 'GBP',
    description: 'Historic landmarks, royal heritage, museums, and countryside charm.',
  },
  france: {
    flag: '🇫🇷',
    currency: 'EUR',
    description: 'Art, gastronomy, iconic boulevards, and scenic regions.',
  },
  italy: {
    flag: '🇮🇹',
    currency: 'EUR',
    description: 'Renaissance masterpieces, ancient ruins, and authentic regional cuisine.',
  },
  spain: {
    flag: '🇪🇸',
    currency: 'EUR',
    description: 'Architectural wonders, lively plazas, and Mediterranean coastlines.',
  },
  germany: {
    flag: '🇩🇪',
    currency: 'EUR',
    description: 'Fairytale castles, historic towns, and scenic alpine roads.',
  },
  usa: {
    flag: '🇺🇸',
    currency: 'USD',
    description: 'Iconic metropolises, national parks, and diverse cultural landmarks.',
  },
  canada: {
    flag: '🇨🇦',
    currency: 'CAD',
    description: 'Turquoise mountain lakes, vast wilderness, and welcoming cities.',
  },
  'new-zealand': {
    flag: '🇳🇿',
    currency: 'NZD',
    description: 'Dramatic fjords, geothermal wonders, and alpine adventure.',
  },
  'saudi-arabia': {
    flag: '🇸🇦',
    currency: 'SAR',
    description: 'Sacred sanctuaries, ancient desert oases, and heritage sites.',
  },
  uae: {
    flag: '🇦🇪',
    currency: 'AED',
    description: 'Futuristic architecture, desert dunes, and cultural landmarks.',
  },
  egypt: {
    flag: '🇪🇬',
    currency: 'EGP',
    description: 'Ancient pyramids, Nile river cruises, and timeless monuments.',
  },
  morocco: {
    flag: '🇲🇦',
    currency: 'MAD',
    description: 'Vibrant medinas, Sahara desert camps, and Atlas mountain villages.',
  },
};

/**
 * Formats the Google Sheet worksheet tab name into a clean display country name.
 * If the tab name is lowercase (e.g., "australia" or "south-korea"), converts it to Title Case ("Australia", "South Korea").
 * If the user already capitalized it in Google Sheets (e.g., "USA" or "New Zealand"), preserves their casing.
 */
function formatTabNameToCountryName(tabName: string): string {
  const trimmed = tabName.trim();
  if (!trimmed) return 'Destination';
  const hasUppercase = /[A-Z]/.test(trimmed);
  if (hasUppercase && !trimmed.includes('-') && !trimmed.includes('_')) {
    return trimmed;
  }
  return trimmed
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function inferSeason(dateStr: string | null): string {
  if (!dateStr) return 'All Seasons';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'All Seasons';
  const month = d.getMonth(); // 0-11
  if (month === 11 || month === 0 || month === 1) return 'Winter Season';
  if (month >= 2 && month <= 4) return 'Spring Season';
  if (month >= 5 && month <= 7) return 'Summer Season';
  return 'Autumn Season';
}

function buildCountryMetadataFromTab(
  slug: string,
  tabName: string,
  itinerary: DayItinerary[]
): CountryMetadata {
  // Built-in defaults first (they carry descriptions); any other country gets its flag + currency from the world table
  const world = worldCountry(slug);
  const defaults = COUNTRY_DEFAULTS[slug] ?? (world ? { flag: world.flag, currency: world.currency, description: '' } : undefined);
  let detectedCurrency = defaults?.currency || 'USD';
  let totalActivities = 0;
  let totalLocalCost = 0;

  for (const day of itinerary) {
    if (!day || !Array.isArray(day.items)) continue;
    for (const item of day.items) {
      totalActivities++;
      if (item.price?.currency && item.price.currency !== 'USD') {
        detectedCurrency = item.price.currency;
      } else if (item.price?.currency && !defaults?.currency) {
        detectedCurrency = item.price.currency;
      }
      if (item.price?.amount > 0) {
        totalLocalCost += item.price.amount;
        if (item.price.currency) {
          detectedCurrency = item.price.currency;
        }
      }
    }
  }

  // Tab name defines the country name
  const name = formatTabNameToCountryName(tabName || slug);
  const flag = defaults?.flag || '🌍';
  const firstDate = itinerary.length > 0 ? itinerary[0].date : null;
  const lastDate = itinerary.length > 0 ? itinerary[itinerary.length - 1].date : null;
  const season = inferSeason(firstDate);
  const region = defaults?.region || name;
  const description =
    defaults?.description ||
    `Explore ${itinerary.length > 0 ? `${itinerary.length}-day` : ''} travel itinerary, budget analytics, and local insights for ${name}.`;
  const title = `${name} Trip Itinerary`;

  return {
    slug,
    name,
    tabName: tabName || slug,
    flag,
    currency: detectedCurrency,
    description,
    title,
    region,
    season,
    itinerary,
    dataSource: 'google-sheets',
    states: [],
    stats: {
      totalDays: itinerary.length,
      totalActivities,
      totalLocalCost,
      firstDate,
      lastDate,
      hasItinerary: itinerary.length > 0,
    },
  };
}

function sortCountries(countries: CountryMetadata[]): CountryMetadata[] {
  return countries.sort((a, b) => {
    if (a.stats.hasItinerary !== b.stats.hasItinerary) {
      return a.stats.hasItinerary ? -1 : 1;
    }
    if (b.stats.totalDays !== a.stats.totalDays) {
      return b.stats.totalDays - a.stats.totalDays;
    }
    return a.name.localeCompare(b.name);
  });
}


export const TAB_SEPARATOR = ' - ';
export const RESERVED_SLUGS = new Set(['itinerary', 'add', 'api', '404', 'tools', 'prepare', 'pocket', 'trips']);

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "Japan - Tokyo" -> { country: "Japan", state: "Tokyo" }; "japan" -> { country: "japan", state: null } */
export function parseTabName(tabName: string): { country: string; state: string | null } {
  const idx = tabName.indexOf(TAB_SEPARATOR);
  if (idx === -1) return { country: tabName.trim(), state: null };
  const state = tabName.slice(idx + TAB_SEPARATOR.length).trim();
  return { country: tabName.slice(0, idx).trim(), state: state || null };
}

export function buildTabName(country: string, state: string): string {
  return `${country.trim()}${TAB_SEPARATOR}${state.trim()}`;
}

/** Known countries (slug -> defaults) for the add-itinerary form. */
export function getCountryOptions(): Array<{ name: string; slug: string; flag: string; currency: string }> {
  const known = Object.entries(COUNTRY_DEFAULTS).map(([slug, d]) => ({
    slug,
    name: formatTabNameToCountryName(slug),
    flag: d.flag,
    currency: d.currency,
  }));
  // Plus the rest of the world (flag + currency), so any destination can be typed or picked
  const have = new Set(known.map((k) => k.slug));
  const rest = WORLD_COUNTRIES.filter((c) => !have.has(c.slug)).map((c) => ({ slug: c.slug, name: c.name, flag: c.flag, currency: c.currency }));
  return [...known, ...rest].sort((a, b) => a.name.localeCompare(b.name));
}

function firstTime(days: DayItinerary[]): number {
  const t = days[0]?.date ? new Date(days[0].date).getTime() : NaN;
  return isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/**
 * Builds countries from TRIPS. Every worksheet tab is one trip: a tab with a registry row (`_trips`: title, slug,
 * stops...) is a titled trip, any other tab is an old `Country - State` trip whose slug is `country-state`.
 * A trip is listed under its primary country, and a country's `itinerary` is all its trips merged by start date
 * (days renumbered), each day labelled with its city.
 */
export function buildCountries(
  itineraries: Record<string, DayItinerary[]>,
  tabTitles: Record<string, string>,
  metas: TripMeta[] = []
): CountryMetadata[] {
  interface T {
    tab: string;
    slug: string;
    name: string;
    title: string;
    legacy: boolean;
    meta?: TripMeta;
    days: DayItinerary[];
  }
  const metaByTab = new Map(metas.map((m) => [m.tab.trim().toLowerCase(), m]));
  const groups = new Map<string, { countryName: string; trips: T[] }>();
  const taken = new Set<string>();

  // Titled trips first, so a registry slug always wins over an old tab's derived one
  const entries = Object.entries(itineraries).sort(([a], [b]) => Number(metaByTab.has((tabTitles[b] || b).trim().toLowerCase())) - Number(metaByTab.has((tabTitles[a] || a).trim().toLowerCase())));

  for (const [slug, rawDays] of entries) {
    const rawTab = tabTitles[slug] || slug;
    const meta = metaByTab.get(rawTab.trim().toLowerCase());
    let countryName: string;
    let tripSlug: string;
    let name: string;
    let title: string;
    if (meta) {
      countryName = meta.country || meta.stops.find((s) => s.country)?.country || rawDays.flatMap((d) => d.items).find((i) => i.country)?.country || 'Other';
      tripSlug = meta.slug;
      name = meta.title;
      title = meta.title;
    } else {
      const { country, state } = parseTabName(rawTab);
      countryName = country;
      tripSlug = legacyTripSlug(country, state);
      name = state ? formatTabNameToCountryName(state) : formatTabNameToCountryName(country);
      title = state ? `${name}, ${formatTabNameToCountryName(country)}` : name;
    }
    const countrySlug = slugify(countryName);
    if (!countrySlug || RESERVED_SLUGS.has(countrySlug) || !tripSlug) continue;
    if (RESERVED_TRIP_SLUGS.has(tripSlug) || taken.has(tripSlug)) tripSlug = uniqueSlug(tripSlug, taken);
    taken.add(tripSlug);

    // Every day knows its city: its own cell, else the registry stop covering its date, else the old tab's state
    const stops = meta?.stops ?? [];
    const legacyCity = meta ? '' : parseTabName(rawTab).state ? formatTabNameToCountryName(parseTabName(rawTab).state as string) : '';
    const cityOfDay = rawDays.map((d) => cityForDay(d, stops) || legacyCity);
    // A trip through several cities labels each day with its city (the "📍 Osaka" badge and the day's route origin)
    const multiCity = new Set(cityOfDay.filter(Boolean).map((c) => c.toLowerCase())).size > 1;
    const days = rawDays.map((d, i) => {
      const city = cityOfDay[i];
      return city ? { ...d, city, ...(multiCity ? { state: city } : {}) } : d;
    });

    const group = groups.get(countrySlug) || { countryName, trips: [] };
    group.trips.push({ tab: rawTab, slug: tripSlug, name, title, legacy: !meta, meta, days });
    groups.set(countrySlug, group);
  }

  const result: CountryMetadata[] = [];
  for (const [countrySlug, group] of groups) {
    // Order trips chronologically and merge days into one continuous country timeline
    const ordered = [...group.trips].sort((a, b) => firstTime(a.days) - firstTime(b.days));
    let offset = 0;
    const merged: DayItinerary[] = [];
    for (const t of ordered) {
      for (const d of t.days) {
        merged.push({ ...d, day: d.day + offset, state: d.city || t.name });
      }
      offset += t.days.length ? Math.max(...t.days.map((d) => d.day)) : 0;
    }

    const country = buildCountryMetadataFromTab(countrySlug, group.countryName, merged);
    country.tabName = group.countryName;

    country.states = group.trips
      .map((t) => {
        const meta = buildCountryMetadataFromTab(countrySlug, t.tab, t.days);
        const cities = orderedCities(t.days.map((d) => d.city || ''), t.meta?.stops);
        return {
          slug: t.slug,
          name: t.name,
          title: t.title,
          tabName: t.tab,
          currency: meta.currency,
          itinerary: t.days,
          stats: meta.stats,
          cities,
          stops: t.meta?.stops ?? [],
          legacy: t.legacy,
          createdBy: t.meta?.createdBy ?? '',
          copiedFrom: t.meta?.copiedFrom ?? '',
        } satisfies StateMetadata;
      })
      // Newest trips first; trips without dates last
      .sort((a, b) => (b.stats.firstDate ? Date.parse(b.stats.firstDate) || 0 : 0) - (a.stats.firstDate ? Date.parse(a.stats.firstDate) || 0 : 0) || a.name.localeCompare(b.name));

    result.push(country);
  }
  return result;
}

/** The trip stored in worksheet tab `tab` (case-insensitive), with its country; null when no trip uses that tab. */
export function findTripByTab(countries: CountryMetadata[], tab: string) {
  const wanted = tab.trim().toLowerCase();
  for (const country of countries) {
    const trip = country.states.find((s) => s.tabName.trim().toLowerCase() === wanted);
    if (trip) return { country, trip };
  }
  return null;
}

/** The one trip of a country that was a plain `korea` tab (no state): the country page IS that trip, as before. */
export function plainCountryTrip(country: CountryMetadata): StateMetadata | null {
  const only = country.states.length === 1 ? country.states[0] : null;
  return only && only.legacy && !only.tabName.includes(' - ') ? only : null;
}

/** Cities label for a trip ("Tokyo → Osaka"), or '' when it has none. */
export const tripCitiesLabel = (t: Pick<StateMetadata, 'cities'>) => citiesLabel(t.cities);

interface GlobalSheetsCache extends Timed {
  countries: CountryMetadata[];
  syncResult: SheetSyncResult;
  /** What `countries` was built from, so one tab can be re-read and patched after a write (see cacheTabs.ts) */
  raw?: RawTrips & { metas: TripMeta[] };
}

const g = globalThis as unknown as {
  __TOKYO_SHEETS_CACHE__?: GlobalSheetsCache;
  __TOKYO_SHEETS_GEN__?: number;
  __TOKYO_SHEETS_LAST_GOOD__?: {
    countries: CountryMetadata[];
    syncResult: SheetSyncResult;
  };
  __TOKYO_SHEETS_INFLIGHT__?: Promise<{
    countries: CountryMetadata[];
    syncResult: SheetSyncResult;
  }>;
};

/**
 * Primary loader: fetches all country tabs directly from Google Sheets (Single Source of Truth).
 * Each worksheet tab represents one country, and the tab name defines the country name.
 */
export async function getAllCountriesWithSheets(forceRefresh = false): Promise<{
  countries: CountryMetadata[];
  syncResult: SheetSyncResult;
}> {
  const cached = g.__TOKYO_SHEETS_CACHE__;
  const state = forceRefresh ? 'miss' : cacheState(cached, Date.now());
  if (cached && state !== 'miss') {
    // Stale: answer now from memory and refresh once in the background (no click waits on Google)
    if (state === 'stale' && !g.__TOKYO_SHEETS_INFLIGHT__) startSheetsFetch().catch(() => {});
    return { countries: cached.countries, syncResult: cached.syncResult };
  }

  if (!forceRefresh && g.__TOKYO_SHEETS_INFLIGHT__) {
    return g.__TOKYO_SHEETS_INFLIGHT__;
  }

  return startSheetsFetch();
}

function startSheetsFetch(): Promise<{ countries: CountryMetadata[]; syncResult: SheetSyncResult }> {
  // A write bumps the generation (clearSheetsCache); a read that started before it must not re-cache old rows
  const gen = g.__TOKYO_SHEETS_GEN__ ?? 0;
  const runFetch = async () => {
    const spreadsheetId = resolveSpreadsheetId();
    const creds = loadServiceAccountCredentials();
    // Dev-only sample data (see utils/fixture.ts): skip the "unconfigured" shortcut
    const fixture = Boolean((import.meta as any).env?.DEV && process.env.SHEETS_FIXTURE);

    if (!fixture && (!spreadsheetId || !creds)) {
      const unconfiguredResult: SheetSyncResult = {
        configured: false,
        spreadsheetId: spreadsheetId || null,
        serviceAccountEmail: creds?.client_email || null,
        countriesSynced: [],
        totalDays: 0,
        totalActivities: 0,
        source: 'unconfigured',
        error: !creds
          ? 'Google Service Account credentials not found'
          : 'GOOGLE_SHEET_ID is not set in environment variables',
        syncedAt: new Date().toISOString(),
      };
      return { countries: [], syncResult: unconfiguredResult };
    }

    // Google just told us to slow down: serve what we already have instead of every reader retrying at once
    const closedFor = quotaGate.closedFor(Date.now());
    if (closedFor > 0 && g.__TOKYO_SHEETS_LAST_GOOD__) {
      sheetsStats.servedFromGate++;
      return g.__TOKYO_SHEETS_LAST_GOOD__;
    }

    const t0 = Date.now();
    const { result, itineraries, tabTitles } = await pullCountriesFromGoogleSheets({
      spreadsheetId,
    });
    sheetsStats.lastReadMs = Date.now() - t0;
    sheetsStats.lastReadAt = Date.now();
    sheetsStats.fullReads++;
    if (result.source === 'error') { sheetsStats.lastError = (result.error || '').slice(0, 200); sheetsStats.lastErrorAt = Date.now(); }

    if (result.source === 'google-sheets') {
      const metas = await getTripMetas();
      const sheetCountries = buildCountries(itineraries, tabTitles, metas);

      const sorted = sortCountries(sheetCountries);
      if (gen !== (g.__TOKYO_SHEETS_GEN__ ?? 0)) return { countries: sorted, syncResult: result };
      g.__TOKYO_SHEETS_CACHE__ = {
        countries: sorted,
        syncResult: result,
        raw: { itineraries, tabTitles, metas },
        ...timed(Date.now()), // a write re-reads just its tab (or clears this), so edits show up immediately
      };
      g.__TOKYO_SHEETS_LAST_GOOD__ = {
        countries: sorted,
        syncResult: result,
      };

      return { countries: sorted, syncResult: result };
    }

    // If a transient error (e.g. 429) occurred and we have a previous good Google Sheets snapshot in memory, serve it
    if (g.__TOKYO_SHEETS_LAST_GOOD__) {
      return g.__TOKYO_SHEETS_LAST_GOOD__;
    }

    return { countries: [], syncResult: result };
  };

  g.__TOKYO_SHEETS_INFLIGHT__ = runFetch().finally(() => {
    g.__TOKYO_SHEETS_INFLIGHT__ = undefined;
  });

  return g.__TOKYO_SHEETS_INFLIGHT__;
}

export function getActiveItinerariesMap(countriesList: CountryMetadata[]): Record<string, DayItinerary[]> {
  const map: Record<string, DayItinerary[]> = {};
  for (const country of countriesList) {
    if (country.stats.hasItinerary) {
      map[country.slug] = country.itinerary;
    }
  }
  return map;
}

/**
 * One trip presented as its own destination (the shape CountrySubNav and the trip pages use), or null when the slug
 * is unknown. `page` names the tab ("Itinerary", "Pocket"...) in the title.
 */
export function tripBySlug(countries: CountryMetadata[], tripSlug?: string, page = 'Itinerary') {
  const slug = tripSlug?.toLowerCase();
  for (const baseCountry of countries) {
    const stateMeta = baseCountry.states.find((s) => s.slug === slug);
    if (!stateMeta) continue;
    const place = stateMeta.legacy ? `${baseCountry.name} – ${stateMeta.name}` : stateMeta.title;
    const country: CountryMetadata = {
      ...baseCountry,
      title: `${place} ${page}`,
      description: `Day-by-day plan, budget analytics, and local insights for ${stateMeta.title}.`,
      itinerary: stateMeta.itinerary,
      currency: stateMeta.currency,
      region: stateMeta.cities.join(', ') || stateMeta.name,
      stats: stateMeta.stats,
      tabName: stateMeta.tabName,
    };
    return { baseCountry, stateMeta, country };
  }
  return null;
}

/** Old two-slug lookup (`/japan/tokyo`): resolves through the trip's stable slug. */
export function stateTrip(countries: CountryMetadata[], countrySlug?: string, stateSlug?: string, page = 'Itinerary') {
  return tripBySlug(countries, legacyTripSlug(countrySlug || '', stateSlug || ''), page);
}


// ---------------------------------------------------------------------------
// After a write to one tab: re-read just that tab and patch the cache (hooks used by googleSheets.ts)
// ---------------------------------------------------------------------------

cacheHooks.refreshTab = async (tab: string): Promise<boolean> => {
  const cached = g.__TOKYO_SHEETS_CACHE__;
  if (!cached?.raw) return false;
  const gen = g.__TOKYO_SHEETS_GEN__ ?? 0;
  const rows = await readTabRows(tab);
  // Another write happened while we were reading (or the cache was replaced): do not patch with possibly old rows
  if (gen !== (g.__TOKYO_SHEETS_GEN__ ?? 0) || g.__TOKYO_SHEETS_CACHE__ !== cached) return false;
  const next = applyTabUpdate(cached.raw, tab, (title) => rowsToDayItinerary(rows, 'USD', title));
  if (!next) return false;

  const countries = sortCountries(buildCountries(next.itineraries, next.tabTitles, cached.raw.metas));
  const all = Object.values(next.itineraries);
  const syncResult: SheetSyncResult = {
    ...cached.syncResult,
    totalDays: all.reduce((n, d) => n + d.length, 0),
    totalActivities: all.reduce((n, d) => n + d.reduce((m, x) => m + x.items.length, 0), 0),
    syncedAt: new Date().toISOString(),
  };
  g.__TOKYO_SHEETS_CACHE__ = { countries, syncResult, raw: { ...next, metas: cached.raw.metas }, ...timed(Date.now()) };
  g.__TOKYO_SHEETS_LAST_GOOD__ = { countries, syncResult };
  return true;
};

cacheHooks.lastRow = (tab: string): number | null => {
  const days = g.__TOKYO_SHEETS_CACHE__?.raw?.itineraries[tabSlug(tab)];
  return days ? lastUsedRow(days) : null;
};
