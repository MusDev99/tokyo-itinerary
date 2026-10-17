import type { DayItinerary } from '../types/itinerary';

export interface CountryMetadata {
  slug: string;
  name: string;
  flag: string;
  currency: string;
  description: string;
  title: string;
  region?: string;
  season?: string;
  itinerary: DayItinerary[];
  dictionary?: any;
  prayer?: any;
  stats: {
    totalDays: number;
    totalActivities: number;
    totalLocalCost: number;
    firstDate: string | null;
    lastDate: string | null;
    hasItinerary: boolean;
    hasDictionary: boolean;
    hasPrayer: boolean;
  };
}

const COUNTRY_DEFAULTS: Record<
  string,
  { name: string; flag: string; currency: string; description: string; region?: string }
> = {
  japan: {
    name: 'Japan',
    flag: '🇯🇵',
    currency: 'JPY',
    description: 'Explore ancient shrines, neon-lit cities, Mount Fuji, and culinary wonders.',
    region: 'Tokyo & Mt. Fuji',
  },
  kazakhstan: {
    name: 'Kazakhstan',
    flag: '🇰🇿',
    currency: 'KZT',
    description: 'Discover alpine lakes, dramatic canyons, and modern Silk Road heritage in Almaty.',
    region: 'Almaty & Tian Shan',
  },
  china: {
    name: 'China',
    flag: '🇨🇳',
    currency: 'CNY',
    description: 'Discover vast imperial landscapes, high-speed marvels, and millennia of history.',
    region: 'Mainland China',
  },
  turkey: {
    name: 'Turkey',
    flag: '🇹🇷',
    currency: 'TRY',
    description: 'A crossroads of empires offering fairy chimneys, bazaars, and coastal beauty.',
    region: 'Istanbul & Cappadocia',
  },
  australia: {
    name: 'Australia',
    flag: '🇦🇺',
    currency: 'AUD',
    description: 'From iconic coastal cities to the outback, wildlife, and natural wonders.',
    region: 'Sydney & Melbourne',
  },
  korea: {
    name: 'South Korea',
    flag: '🇰🇷',
    currency: 'KRW',
    description: 'Vibrant K-culture, royal palaces, street food markets, and scenic mountains.',
  },
  'south-korea': {
    name: 'South Korea',
    flag: '🇰🇷',
    currency: 'KRW',
    description: 'Vibrant K-culture, royal palaces, street food markets, and scenic mountains.',
  },
  thailand: {
    name: 'Thailand',
    flag: '🇹🇭',
    currency: 'THB',
    description: 'Golden temples, tropical islands, night markets, and world-famous street food.',
  },
  indonesia: {
    name: 'Indonesia',
    flag: '🇮🇩',
    currency: 'IDR',
    description: 'Volcanic landscapes, emerald rice terraces, and rich archipelago culture.',
  },
  malaysia: {
    name: 'Malaysia',
    flag: '🇲🇾',
    currency: 'MYR',
    description: 'Diverse heritage, modern skylines, rainforests, and culinary fusion.',
  },
  singapore: {
    name: 'Singapore',
    flag: '🇸🇬',
    currency: 'SGD',
    description: 'Futuristic gardens, hawker culture, and world-class urban architecture.',
  },
  vietnam: {
    name: 'Vietnam',
    flag: '🇻🇳',
    currency: 'VND',
    description: 'Limestone karsts, lantern-lit ancient towns, and vibrant coffee culture.',
  },
  taiwan: {
    name: 'Taiwan',
    flag: '🇹🇼',
    currency: 'TWD',
    description: 'Bustling night markets, misty mountain railways, and hot springs.',
  },
  switzerland: {
    name: 'Switzerland',
    flag: '🇨🇭',
    currency: 'CHF',
    description: 'Panoramic alpine peaks, glacier express trains, and pristine lakes.',
  },
  uk: {
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: 'GBP',
    description: 'Historic landmarks, royal heritage, museums, and countryside charm.',
  },
  france: {
    name: 'France',
    flag: '🇫🇷',
    currency: 'EUR',
    description: 'Art, gastronomy, iconic boulevards, and scenic regions.',
  },
  italy: {
    name: 'Italy',
    flag: '🇮🇹',
    currency: 'EUR',
    description: 'Renaissance masterpieces, ancient ruins, and authentic regional cuisine.',
  },
  spain: {
    name: 'Spain',
    flag: '🇪🇸',
    currency: 'EUR',
    description: 'Architectural wonders, lively plazas, and Mediterranean coastlines.',
  },
  germany: {
    name: 'Germany',
    flag: '🇩🇪',
    currency: 'EUR',
    description: 'Fairytale castles, historic towns, and scenic alpine roads.',
  },
  usa: {
    name: 'United States',
    flag: '🇺🇸',
    currency: 'USD',
    description: 'Iconic metropolises, national parks, and diverse cultural landmarks.',
  },
  canada: {
    name: 'Canada',
    flag: '🇨🇦',
    currency: 'CAD',
    description: 'Turquoise mountain lakes, vast wilderness, and welcoming cities.',
  },
  'new-zealand': {
    name: 'New Zealand',
    flag: '🇳🇿',
    currency: 'NZD',
    description: 'Dramatic fjords, geothermal wonders, and alpine adventure.',
  },
  'saudi-arabia': {
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    currency: 'SAR',
    description: 'Sacred sanctuaries, ancient desert oases, and heritage sites.',
  },
  uae: {
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    currency: 'AED',
    description: 'Futuristic architecture, desert dunes, and cultural landmarks.',
  },
  egypt: {
    name: 'Egypt',
    flag: '🇪🇬',
    currency: 'EGP',
    description: 'Ancient pyramids, Nile river cruises, and timeless monuments.',
  },
  morocco: {
    name: 'Morocco',
    flag: '🇲🇦',
    currency: 'MAD',
    description: 'Vibrant medinas, Sahara desert camps, and Atlas mountain villages.',
  },
};

function formatSlugToName(slug: string): string {
  return slug
    .split(/[-_]/)
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

export function getAllCountries(): CountryMetadata[] {
  // 1. Load top-level /src/data/{country}.json files
  const rootFiles = import.meta.glob('/src/data/*.json', { eager: true }) as Record<string, any>;
  // 2. Load nested /src/data/{country}/itinerary.json files (if any exist)
  const nestedItineraries = import.meta.glob('/src/data/*/itinerary.json', { eager: true }) as Record<string, any>;
  // 3. Load optional /src/data/{country}/dictionary.json & prayer.json
  const dictionaryFiles = import.meta.glob('/src/data/*/dictionary.json', { eager: true }) as Record<string, any>;
  const prayerFiles = import.meta.glob('/src/data/*/prayer.json', { eager: true }) as Record<string, any>;

  const countrySlugs = new Set<string>();
  const rawItineraryMap: Record<string, any> = {};
  const rawDictMap: Record<string, any> = {};
  const rawPrayerMap: Record<string, any> = {};

  for (const [path, mod] of Object.entries(rootFiles)) {
    const match = path.match(/\/src\/data\/([^/]+)\.json$/);
    if (match) {
      const slug = match[1].toLowerCase();
      if (slug === 'itinerarydata') continue;
      countrySlugs.add(slug);
      rawItineraryMap[slug] = mod.default ?? mod;
    }
  }

  for (const [path, mod] of Object.entries(nestedItineraries)) {
    const match = path.match(/\/src\/data\/([^/]+)\/itinerary\.json$/);
    if (match) {
      const slug = match[1].toLowerCase();
      countrySlugs.add(slug);
      if (!rawItineraryMap[slug]) {
        rawItineraryMap[slug] = mod.default ?? mod;
      }
    }
  }

  for (const [path, mod] of Object.entries(dictionaryFiles)) {
    const match = path.match(/\/src\/data\/([^/]+)\/dictionary\.json$/);
    if (match) {
      const slug = match[1].toLowerCase();
      rawDictMap[slug] = mod.default ?? mod;
    }
  }

  for (const [path, mod] of Object.entries(prayerFiles)) {
    const match = path.match(/\/src\/data\/([^/]+)\/prayer\.json$/);
    if (match) {
      const slug = match[1].toLowerCase();
      rawPrayerMap[slug] = mod.default ?? mod;
    }
  }

  const countries: CountryMetadata[] = [];

  for (const slug of countrySlugs) {
    const rawData = rawItineraryMap[slug];
    const defaults = COUNTRY_DEFAULTS[slug];

    let itinerary: DayItinerary[] = [];
    let customMeta: Partial<CountryMetadata> = {};

    if (Array.isArray(rawData)) {
      itinerary = rawData;
    } else if (rawData && typeof rawData === 'object') {
      if (Array.isArray(rawData.itinerary)) {
        itinerary = rawData.itinerary;
      }
      customMeta = rawData;
    }

    const dictionary = customMeta.dictionary ?? rawDictMap[slug] ?? null;
    const prayer = customMeta.prayer ?? rawPrayerMap[slug] ?? null;

    // Detect currency from first priced item or fallback to defaults
    let detectedCurrency = customMeta.currency || defaults?.currency || 'USD';
    let totalActivities = 0;
    let totalLocalCost = 0;

    for (const day of itinerary) {
      if (!day || !Array.isArray(day.items)) continue;
      for (const item of day.items) {
        totalActivities++;
        if (item.price?.currency && detectedCurrency === 'USD' && ! defaults?.currency) {
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

    const name = customMeta.name || defaults?.name || formatSlugToName(slug);
    const flag = customMeta.flag || defaults?.flag || '🌍';
    const firstDate = itinerary.length > 0 ? itinerary[0].date : null;
    const lastDate = itinerary.length > 0 ? itinerary[itinerary.length - 1].date : null;
    const season = customMeta.season || inferSeason(firstDate);
    const region = customMeta.region || defaults?.region || name;
    const description =
      customMeta.description ||
      defaults?.description ||
      `Explore ${itinerary.length > 0 ? `${itinerary.length}-day` : ''} travel itinerary, analytics, and local insights for ${name}.`;
    const title = customMeta.title || `${name} Trip Itinerary`;

    countries.push({
      slug,
      name,
      flag,
      currency: detectedCurrency,
      description,
      title,
      region,
      season,
      itinerary,
      dictionary,
      prayer,
      stats: {
        totalDays: itinerary.length,
        totalActivities,
        totalLocalCost,
        firstDate,
        lastDate,
        hasItinerary: itinerary.length > 0,
        hasDictionary: Boolean(dictionary),
        hasPrayer: Boolean(prayer),
      },
    });
  }

  // Sort: countries with active itineraries first (by days desc), then alphabetical
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

export function getCountryBySlug(slug: string): CountryMetadata | undefined {
  const normalized = slug.toLowerCase();
  return getAllCountries().find((c) => c.slug === normalized);
}

export function getActiveItinerariesMap(): Record<string, DayItinerary[]> {
  const map: Record<string, DayItinerary[]> = {};
  for (const country of getAllCountries()) {
    if (country.stats.hasItinerary) {
      map[country.slug] = country.itinerary;
    }
  }
  return map;
}
