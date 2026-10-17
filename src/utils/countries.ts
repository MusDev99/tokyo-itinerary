import type { DayItinerary } from '../types/itinerary';
import {
  pullCountriesFromGoogleSheets,
  resolveSpreadsheetId,
  loadServiceAccountCredentials,
  type SheetSyncResult,
} from './googleSheets';

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
  const defaults = COUNTRY_DEFAULTS[slug];
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

interface GlobalSheetsCache {
  countries: CountryMetadata[];
  syncResult: SheetSyncResult;
  expiresAt: number;
}

const g = globalThis as unknown as {
  __TOKYO_SHEETS_CACHE__?: GlobalSheetsCache;
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
  const now = Date.now();
  if (!forceRefresh && g.__TOKYO_SHEETS_CACHE__ && g.__TOKYO_SHEETS_CACHE__.expiresAt > now) {
    return {
      countries: g.__TOKYO_SHEETS_CACHE__.countries,
      syncResult: g.__TOKYO_SHEETS_CACHE__.syncResult,
    };
  }

  if (!forceRefresh && g.__TOKYO_SHEETS_INFLIGHT__) {
    return g.__TOKYO_SHEETS_INFLIGHT__;
  }

  const runFetch = async () => {
    const spreadsheetId = resolveSpreadsheetId();
    const creds = loadServiceAccountCredentials();

    if (!spreadsheetId || !creds) {
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

    const { result, itineraries, tabTitles } = await pullCountriesFromGoogleSheets({
      spreadsheetId,
    });

    if (result.source === 'google-sheets') {
      const sheetCountries: CountryMetadata[] = [];

      for (const [slug, sheetDays] of Object.entries(itineraries)) {
        const rawTabTitle = tabTitles[slug] || slug;
        sheetCountries.push(buildCountryMetadataFromTab(slug, rawTabTitle, sheetDays));
      }

      const sorted = sortCountries(sheetCountries);
      g.__TOKYO_SHEETS_CACHE__ = {
        countries: sorted,
        syncResult: result,
        expiresAt: Date.now() + 3_000, // 3-second deduplication cache so every browser refresh gets live Sheet rows
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
