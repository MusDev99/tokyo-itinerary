import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DayItinerary, TimelineItem } from '../types/itinerary';

export interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri?: string;
}

export interface SheetSyncResult {
  configured: boolean;
  spreadsheetId: string | null;
  spreadsheetTitle?: string;
  serviceAccountEmail: string | null;
  countriesSynced: string[];
  totalDays: number;
  totalActivities: number;
  source: 'google-sheets' | 'unconfigured' | 'error';
  error?: string;
  syncedAt: string;
}

export const SHEET_HEADERS = [
  'day',
  'date',
  'day_title',
  'time',
  'title',
  'description',
  'category',
  'location_name',
  'maps_url',
  'price_amount',
  'price_currency',
  'price_notes',
  'note',
  'images',
  'youtube_url',
] as const;

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Load environment variables from .env file if running in Node CLI or if import.meta.env hasn't populated process.env
 */
function loadDotEnvIfNeeded(): Record<string, string> {
  const envVars: Record<string, string> = {};
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed
            .slice(eqIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, '');
          envVars[key] = val;
        }
      }
    }
  } catch {
    // Ignore fs errors
  }
  return envVars;
}

/**
 * Extracts a clean Google Spreadsheet ID from either a raw ID string or a full docs.google.com URL.
 */
export function resolveSpreadsheetId(overrideId?: string): string | null {
  const dotEnv = loadDotEnvIfNeeded();
  const raw =
    overrideId ||
    process.env.GOOGLE_SHEET_ID ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GOOGLE_SHEET_ID) ||
    dotEnv.GOOGLE_SHEET_ID ||
    '';

  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'your_google_spreadsheet_id_or_url_here') {
    return null;
  }

  // Match /spreadsheets/d/{ID} if user pasted a full Google Sheet URL
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  return trimmed;
}

/**
 * Loads Google Service Account credentials from:
 * 1. GOOGLE_SERVICE_ACCOUNT_JSON (raw JSON string or Base64-encoded JSON - ideal for Vercel)
 * 2. GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (individual env vars on Vercel)
 * 3. Local file at GOOGLE_CREDENTIALS_PATH (defaults to ./credentials/keys.json)
 */
export function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  const dotEnv = loadDotEnvIfNeeded();

  const rawJsonEnv =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GOOGLE_SERVICE_ACCOUNT_JSON) ||
    dotEnv.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (rawJsonEnv) {
    try {
      const trimmed = rawJsonEnv.trim();
      const jsonStr = trimmed.startsWith('{')
        ? trimmed
        : Buffer.from(trimmed, 'base64').toString('utf8');
      const parsed = JSON.parse(jsonStr) as ServiceAccountCredentials;
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (e) {
      console.error('[GoogleSheets] Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', e);
    }
  }

  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GOOGLE_CLIENT_EMAIL) ||
    dotEnv.GOOGLE_CLIENT_EMAIL;
  const privateKey =
    process.env.GOOGLE_PRIVATE_KEY ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GOOGLE_PRIVATE_KEY) ||
    dotEnv.GOOGLE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    return {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID || dotEnv.GOOGLE_PROJECT_ID || 'mus-project-2024',
      private_key_id: '',
      private_key: privateKey.replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n'),
      client_email: clientEmail.trim(),
      client_id: '',
      token_uri: 'https://oauth2.googleapis.com/token',
    };
  }

  const credRelPath =
    process.env.GOOGLE_CREDENTIALS_PATH ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.GOOGLE_CREDENTIALS_PATH) ||
    dotEnv.GOOGLE_CREDENTIALS_PATH ||
    './credentials/keys.json';

  const fullPath = path.resolve(process.cwd(), credRelPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(raw) as ServiceAccountCredentials;
  } catch (e) {
    console.error(`[GoogleSheets] Failed to read credentials at ${fullPath}:`, e);
    return null;
  }
}

/**
 * Generates an OAuth2 Bearer access token using the Service Account private key (RS256 JWT).
 */
export async function getGoogleAccessToken(
  creds?: ServiceAccountCredentials | null
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 60) {
    return cachedAccessToken.token;
  }

  const serviceAccount = creds ?? loadServiceAccountCredentials();
  if (!serviceAccount || !serviceAccount.private_key || !serviceAccount.client_email) {
    throw new Error(
      'Missing valid Google Service Account credentials in credentials/keys.json or GOOGLE_SERVICE_ACCOUNT_JSON'
    );
  }

  const tokenUri = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);
  const assertion = `${signingInput}.${base64UrlEncode(signature)}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth2 token exchange failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Converts a 2D array of Google Sheet rows (including header row) into structured DayItinerary[].
 */
export function rowsToDayItinerary(rows: string[][], fallbackCurrency = 'USD'): DayItinerary[] {
  if (!rows || rows.length <= 1) return [];

  const rawHeaders = rows[0].map((h) =>
    String(h || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
  );

  const colIndex = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = rawHeaders.indexOf(c);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxDay = colIndex(['day', 'day_number', 'day_no']);
  const idxDate = colIndex(['date', 'trip_date']);
  const idxDayTitle = colIndex(['day_title', 'day_name', 'headline']);
  const idxTime = colIndex(['time', 'start_time', 'schedule']);
  const idxTitle = colIndex(['title', 'activity', 'activity_title', 'name']);
  const idxDesc = colIndex(['description', 'details', 'desc']);
  const idxCategory = colIndex(['category', 'type']);
  const idxLocName = colIndex(['location_name', 'location', 'place', 'venue']);
  const idxMapsUrl = colIndex(['maps_url', 'map_url', 'google_maps', 'maps']);
  const idxPriceAmount = colIndex(['price_amount', 'price', 'cost', 'amount']);
  const idxPriceCurrency = colIndex(['price_currency', 'currency']);
  const idxPriceNotes = colIndex(['price_notes', 'cost_notes', 'price_note']);
  const idxNote = colIndex(['note', 'notes', 'tip', 'tips']);
  const idxImages = colIndex(['images', 'image', 'image_url', 'photo']);
  const idxYoutube = colIndex(['youtube_url', 'youtube', 'video_url']);

  const dayMap = new Map<number, DayItinerary>();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((cell) => !String(cell || '').trim())) continue;

    const getCell = (idx: number): string =>
      idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

    const dayNum = parseInt(getCell(idxDay), 10) || 1;
    const dateStr = getCell(idxDate);
    const dayTitle = getCell(idxDayTitle);
    const activityTitle = getCell(idxTitle);

    if (!dayMap.has(dayNum)) {
      dayMap.set(dayNum, {
        day: dayNum,
        title: dayTitle || `Day ${dayNum}`,
        date: dateStr || '',
        items: [],
      });
    } else {
      const existingDay = dayMap.get(dayNum)!;
      if (!existingDay.title && dayTitle) existingDay.title = dayTitle;
      if (!existingDay.date && dateStr) existingDay.date = dateStr;
    }

    // Only skip adding an item if the row has no activity fields at all
    const descStr = getCell(idxDesc);
    const locCell = getCell(idxLocName);
    const noteCell = getCell(idxNote);
    const priceCell = getCell(idxPriceAmount);
    if (!activityTitle && !descStr && !locCell && !noteCell && !priceCell && !dayTitle) continue;

    const rawAmount = priceCell.replace(/[^0-9.-]/g, '');
    const parsedAmount = parseFloat(rawAmount);
    const priceAmount = isNaN(parsedAmount) ? 0 : parsedAmount;
    const priceCurrency = getCell(idxPriceCurrency) || fallbackCurrency;
    const priceNotes = getCell(idxPriceNotes);
    const resolvedTitle = activityTitle || locCell || dayTitle || 'Scheduled Activity';
    const locName = locCell || resolvedTitle;
    const mapsUrl =
      getCell(idxMapsUrl) ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName)}`;

    const item: TimelineItem = {
      time: getCell(idxTime) || '09:00',
      title: resolvedTitle,
      description: descStr,
      location: {
        name: locName,
        mapsUrl,
      },
      price: {
        amount: priceAmount,
        currency: priceCurrency,
        ...(priceNotes ? { notes: priceNotes } : {}),
      },
      note: getCell(idxNote),
    };

    const cat = getCell(idxCategory);
    if (cat) item.category = cat as any;

    const img = getCell(idxImages);
    if (img) item.images = img;

    const yt = getCell(idxYoutube);
    if (yt) item.youtubeUrl = yt;

    dayMap.get(dayNum)!.items.push(item);
  }

  return Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
}

const IGNORED_TAB_SLUGS = new Set([
  'sheet1',
  'sheet2',
  'sheet3',
  'template',
  'readme',
  'instructions',
]);

async function fetchSheetsApiWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, init);
    if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
      attempt++;
      const waitSec = attempt * 16; // 16s, 32s, 48s to clear 60-second quota window
      console.warn(
        `⏳ Google Sheets API rate limit (${res.status}) hit. Waiting ${waitSec}s for quota window to reset (retry ${attempt}/${maxRetries})...`
      );
      await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      continue;
    }
    return res;
  }
}

/**
 * Fetches all worksheet tabs from the configured Google Spreadsheet (Single Source of Truth).
 * One tab represents one country, and the tab name defines the country name.
 */
export async function pullCountriesFromGoogleSheets(options?: {
  spreadsheetId?: string;
}): Promise<{
  result: SheetSyncResult;
  itineraries: Record<string, DayItinerary[]>;
  tabTitles: Record<string, string>;
}> {
  const creds = loadServiceAccountCredentials();
  const spreadsheetId = resolveSpreadsheetId(options?.spreadsheetId);

  if (!spreadsheetId || !creds) {
    return {
      result: {
        configured: false,
        spreadsheetId: spreadsheetId || null,
        serviceAccountEmail: creds?.client_email || null,
        countriesSynced: [],
        totalDays: 0,
        totalActivities: 0,
        source: 'unconfigured',
        error: !creds
          ? 'Google Service Account credentials not found (set GOOGLE_SERVICE_ACCOUNT_JSON or provide credentials/keys.json)'
          : 'GOOGLE_SHEET_ID is not set in environment variables',
        syncedAt: new Date().toISOString(),
      },
      itineraries: {},
      tabTitles: {},
    };
  }

  try {
    const token = await getGoogleAccessToken(creds);

    // 1. Fetch spreadsheet metadata to discover worksheet tabs
    const metaRes = await fetchSheetsApiWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}?fields=properties.title,sheets.properties(title,sheetId)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!metaRes.ok) {
      const errBody = await metaRes.text();
      const hint =
        metaRes.status === 429
          ? 'Google Sheets API per-minute read quota exceeded. Wait ~60 seconds and try again.'
          : `Make sure the sheet is shared with ${creds.client_email}`;
      throw new Error(`Failed to fetch spreadsheet metadata (${metaRes.status}). ${hint}: ${errBody}`);
    }

    const metaJson = (await metaRes.json()) as {
      properties?: { title?: string };
      sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
    };

    const sheetTitles = (metaJson.sheets || [])
      .map((s) => s.properties?.title || '')
      .filter((title) => {
        if (!title || title.startsWith('_')) return false;
        const normalized = title.trim().toLowerCase().replace(/\s+/g, '');
        return !IGNORED_TAB_SLUGS.has(normalized);
      });

    if (sheetTitles.length === 0) {
      return {
        result: {
          configured: true,
          spreadsheetId,
          spreadsheetTitle: metaJson.properties?.title,
          serviceAccountEmail: creds.client_email,
          countriesSynced: [],
          totalDays: 0,
          totalActivities: 0,
          source: 'google-sheets',
          syncedAt: new Date().toISOString(),
        },
        itineraries: {},
        tabTitles: {},
      };
    }

    // 2. Batch-fetch all worksheet values in a single call
    const rangesQuery = sheetTitles
      .map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'!A1:Z2000`)}`)
      .join('&');

    const valuesRes = await fetchSheetsApiWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchGet?${rangesQuery}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!valuesRes.ok) {
      const errBody = await valuesRes.text();
      throw new Error(`Failed to batchGet sheet values (${valuesRes.status}): ${errBody}`);
    }

    const valuesJson = (await valuesRes.json()) as {
      valueRanges?: Array<{ range?: string; values?: string[][] }>;
    };

    const itineraries: Record<string, DayItinerary[]> = {};
    const tabTitles: Record<string, string> = {};
    const countriesSynced: string[] = [];
    let totalDays = 0;
    let totalActivities = 0;

    (valuesJson.valueRanges || []).forEach((vr, idx) => {
      const rawTabName = (sheetTitles[idx] || '').trim();
      const slug = rawTabName
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
      if (!slug || IGNORED_TAB_SLUGS.has(slug)) return;

      const parsedDays = rowsToDayItinerary(vr.values || []);
      itineraries[slug] = parsedDays;
      tabTitles[slug] = rawTabName;
      countriesSynced.push(slug);
      totalDays += parsedDays.length;
      totalActivities += parsedDays.reduce((acc, d) => acc + d.items.length, 0);
    });

    return {
      result: {
        configured: true,
        spreadsheetId,
        spreadsheetTitle: metaJson.properties?.title,
        serviceAccountEmail: creds.client_email,
        countriesSynced,
        totalDays,
        totalActivities,
        source: 'google-sheets',
        syncedAt: new Date().toISOString(),
      },
      itineraries,
      tabTitles,
    };
  } catch (error: any) {
    return {
      result: {
        configured: true,
        spreadsheetId,
        serviceAccountEmail: creds.client_email,
        countriesSynced: [],
        totalDays: 0,
        totalActivities: 0,
        source: 'error',
        error: error?.message || String(error),
        syncedAt: new Date().toISOString(),
      },
      itineraries: {},
      tabTitles: {},
    };
  }
}

// Allow direct CLI invocation: `node src/utils/googleSheets.ts [spreadsheetId]`
const isDirectCli =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].endsWith('googleSheets.ts');

if (isDirectCli) {
  const argSheetId =
    process.argv[2] && process.argv[2] !== 'pull' ? process.argv[2] : process.argv[3];

  (async () => {
    console.log('\n🔄 Fetching country tabs from Google Sheets (Single Source of Truth)...');
    const { result, itineraries, tabTitles } = await pullCountriesFromGoogleSheets({
      spreadsheetId: argSheetId,
    });
    if (result.error) {
      console.error(`❌ ${result.error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `✅ Connected to "${result.spreadsheetTitle || result.spreadsheetId}" — ${result.countriesSynced.length} country tabs (${result.totalDays} days, ${result.totalActivities} activities):`
      );
      for (const slug of result.countriesSynced) {
        const days = itineraries[slug] || [];
        const acts = days.reduce((acc, d) => acc + d.items.length, 0);
        console.log(`   • Tab "${tabTitles[slug]}" (/${slug}): ${days.length} days, ${acts} activities`);
      }
    }
  })();
}
