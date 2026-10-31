import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DayItinerary, TimelineItem } from '../types/itinerary';
import type { Place } from '../types/place';
import { UserError, safeHttpUrl, sheetText, youtubeEmbedUrl } from './security.ts';
import { cacheState, timed, type Timed } from './swr.ts';
import { sortByTime } from './calendar.ts';

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
  'id',
] as const;

export type SheetColumn = (typeof SHEET_HEADERS)[number];

/** Accepted header spellings per canonical column (shared by the reader and writer). */
export const COLUMN_ALIASES: Record<SheetColumn, string[]> = {
  day: ['day', 'day_number', 'day_no'],
  date: ['date', 'trip_date'],
  day_title: ['day_title', 'day_name', 'headline'],
  time: ['time', 'start_time', 'schedule'],
  title: ['title', 'activity', 'activity_title', 'name'],
  description: ['description', 'details', 'desc'],
  category: ['category', 'type'],
  location_name: ['location_name', 'location', 'place', 'venue'],
  maps_url: ['maps_url', 'map_url', 'google_maps', 'maps'],
  price_amount: ['price_amount', 'price', 'cost', 'amount'],
  price_currency: ['price_currency', 'currency'],
  price_notes: ['price_notes', 'cost_notes', 'price_note'],
  note: ['note', 'notes', 'tip', 'tips'],
  images: ['images', 'image', 'image_url', 'photo'],
  youtube_url: ['youtube_url', 'youtube', 'video_url'],
  id: ['id', 'row_id'],
};

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
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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
export function rowsToDayItinerary(
  rows: string[][],
  fallbackCurrency = 'USD',
  tabName?: string
): DayItinerary[] {
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

  const idxDay = colIndex(COLUMN_ALIASES.day);
  const idxDate = colIndex(COLUMN_ALIASES.date);
  const idxDayTitle = colIndex(COLUMN_ALIASES.day_title);
  const idxTime = colIndex(COLUMN_ALIASES.time);
  const idxTitle = colIndex(COLUMN_ALIASES.title);
  const idxDesc = colIndex(COLUMN_ALIASES.description);
  const idxCategory = colIndex(COLUMN_ALIASES.category);
  const idxLocName = colIndex(COLUMN_ALIASES.location_name);
  const idxMapsUrl = colIndex(COLUMN_ALIASES.maps_url);
  const idxPriceAmount = colIndex(COLUMN_ALIASES.price_amount);
  const idxPriceCurrency = colIndex(COLUMN_ALIASES.price_currency);
  const idxPriceNotes = colIndex(COLUMN_ALIASES.price_notes);
  const idxNote = colIndex(COLUMN_ALIASES.note);
  const idxImages = colIndex(COLUMN_ALIASES.images);
  const idxYoutube = colIndex(COLUMN_ALIASES.youtube_url);
  const idxId = colIndex(COLUMN_ALIASES.id);

  const dayMap = new Map<number, DayItinerary>();

  // Auto day numbering: rows without a `day` value get their day from the trip's dates.
  const cellAt = (row: string[], idx: number): string =>
    idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';
  const dateToDay = new Map<string, number>();
  const blankDayDates = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const date = cellAt(row, idxDate);
    if (!date) continue;
    const explicit = parseInt(cellAt(row, idxDay), 10);
    if (explicit) {
      if (!dateToDay.has(date)) dateToDay.set(date, explicit);
    } else {
      blankDayDates.add(date);
    }
  }
  const usedDays = new Set(dateToDay.values());
  const sortedBlank = [...blankDayDates]
    .filter((d) => !dateToDay.has(d))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  let nextDay = 1;
  for (const d of sortedBlank) {
    while (usedDays.has(nextDay)) nextDay++;
    dateToDay.set(d, nextDay);
    usedDays.add(nextDay);
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((cell) => !String(cell || '').trim())) continue;

    const getCell = (idx: number): string =>
      idx >= 0 && idx < row.length ? String(row[idx] ?? '').trim() : '';

    const dateStr = getCell(idxDate);
    const dayNum = parseInt(getCell(idxDay), 10) || dateToDay.get(dateStr) || 1;
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
      if ((!existingDay.title || existingDay.title === `Day ${dayNum}`) && dayTitle) existingDay.title = dayTitle;
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
    // Only http(s) links are trusted from sheet cells (blocks javascript: URLs)
    const mapsUrl =
      safeHttpUrl(getCell(idxMapsUrl)) ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locName)}`;

    const item: TimelineItem = {
      date: dateStr,
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

    const rowId = getCell(idxId);
    if (rowId) item.id = rowId;
    item.row = r + 1; // 1-based sheet row (fallback addressing for legacy rows without an id)
    if (tabName) item.tab = tabName;

    const cat = getCell(idxCategory);
    if (cat) item.category = cat as any;

    const img = safeHttpUrl(getCell(idxImages));
    if (img) item.images = img;

    const yt = youtubeEmbedUrl(getCell(idxYoutube));
    if (yt) item.youtubeUrl = yt;

    dayMap.get(dayNum)!.items.push(item);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => a.day - b.day);
  // Sheet rows can be added in any order: show each day's activities by time (9:30 before 22:00)
  for (const d of days) d.items = sortByTime(d.items, d.date);
  return days;
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

      const parsedDays = rowsToDayItinerary(vr.values || [], 'USD', rawTabName);
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

// ---------------------------------------------------------------------------
// Write side: create trip tabs, append / update / delete activity rows
// ---------------------------------------------------------------------------

export interface ActivityInput {
  date: string;
  day_title?: string;
  title: string;
  time: string;
  description?: string;
  category?: string;
  location_name?: string;
  price_amount?: number | null;
  price_currency?: string;
  price_notes?: string;
}

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

function normalizeHeader(h: unknown): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function quoteTab(tab: string): string {
  return `'${tab.replace(/'/g, "''")}'`;
}

function clearSheetsCache() {
  const g = globalThis as any;
  g.__TOKYO_SHEETS_CACHE__ = undefined;
  g.__TOKYO_SHEETS_INFLIGHT__ = undefined; // a read started before this write must not answer after it
  g.__TOKYO_SHEETS_GEN__ = (g.__TOKYO_SHEETS_GEN__ ?? 0) + 1;
  placeRowsCache = null;
}

async function writeContext() {
  const creds = loadServiceAccountCredentials();
  const spreadsheetId = resolveSpreadsheetId();
  if (!creds || !spreadsheetId) {
    throw new Error('Google Sheets is not configured (service account or GOOGLE_SHEET_ID missing).');
  }
  const token = await getGoogleAccessToken(creds);
  return { creds, spreadsheetId, token };
}

async function sheetsRequest<T = any>(
  ctx: { creds: ServiceAccountCredentials; token: string },
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetchSheetsApiWithRetry(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const hint =
      res.status === 403
        ? ` Share the spreadsheet with ${ctx.creds.client_email} as Editor.`
        : '';
    throw new Error(`Google Sheets request failed (${res.status}).${hint} ${body}`);
  }
  return (await res.json()) as T;
}

async function listTabs(
  ctx: { creds: ServiceAccountCredentials; token: string },
  spreadsheetId: string
): Promise<Array<{ title: string; sheetId: number }>> {
  const meta = await sheetsRequest<{
    sheets?: Array<{ properties?: { title?: string; sheetId?: number } }>;
  }>(ctx, `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(title,sheetId)`);
  return (meta.sheets || []).map((s) => ({
    title: s.properties?.title || '',
    sheetId: s.properties?.sheetId ?? 0,
  }));
}

/** Case-insensitive tab lookup; returns the exact existing title or null. */
export async function findTabTitle(tabName: string): Promise<string | null> {
  const ctx = await writeContext();
  const tabs = await listTabs(ctx, ctx.spreadsheetId);
  const wanted = tabName.trim().toLowerCase();
  return tabs.find((t) => t.title.trim().toLowerCase() === wanted)?.title ?? null;
}

function recordToRow(headers: string[], record: Partial<Record<SheetColumn, string>>): string[] {
  return headers.map((h) => {
    const canonical = (Object.keys(COLUMN_ALIASES) as SheetColumn[]).find((k) =>
      COLUMN_ALIASES[k].includes(h)
    );
    return canonical ? record[canonical] ?? '' : '';
  });
}

function activityToRecord(a: ActivityInput, id?: string): Partial<Record<SheetColumn, string>> {
  return {
    date: a.date,
    // sheetText() stops formula injection: values go in with USER_ENTERED
    ...(a.day_title ? { day_title: sheetText(a.day_title) } : {}),
    time: a.time,
    title: sheetText(a.title),
    description: sheetText(a.description || ''),
    category: sheetText(a.category || ''),
    location_name: sheetText(a.location_name || ''),
    price_amount: a.price_amount != null && a.price_amount > 0 ? String(a.price_amount) : '',
    price_currency: a.price_currency || '',
    price_notes: sheetText(a.price_notes || ''),
    ...(id ? { id } : {}),
  };
}

/** Reads row 1 of a tab and appends any missing canonical headers (e.g. `id` on legacy tabs). */
async function ensureHeaders(
  ctx: { creds: ServiceAccountCredentials; token: string },
  spreadsheetId: string,
  tab: string
): Promise<string[]> {
  const data = await sheetsRequest<{ values?: string[][] }>(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${quoteTab(tab)}!1:1`
    )}`
  );
  const headers = (data.values?.[0] || []).map(normalizeHeader);
  if (headers.length === 0) {
    headers.push(...SHEET_HEADERS);
  } else {
    for (const col of SHEET_HEADERS) {
      const present = headers.some((h) => COLUMN_ALIASES[col].includes(h));
      if (!present && ['date', 'day_title', 'time', 'title', 'id'].includes(col)) headers.push(col);
    }
  }
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${quoteTab(tab)}!A1`
    )}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [headers] }) }
  );
  return headers;
}

/**
 * Appends activities to a trip tab, creating the tab (with headers) first when it doesn't exist.
 * Returns the exact tab title and the generated row ids.
 */
export async function appendActivities(
  tabName: string,
  activities: ActivityInput[]
): Promise<{ tab: string; created: boolean; ids: string[] }> {
  const ctx = await writeContext();
  const { spreadsheetId } = ctx;
  const tabs = await listTabs(ctx, spreadsheetId);
  const existing = tabs.find((t) => t.title.trim().toLowerCase() === tabName.trim().toLowerCase());

  let tab = existing?.title ?? tabName;
  const created = !existing;
  if (created) {
    await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tabName } } }] }),
    });
    tab = tabName;
  }

  const headers = await ensureHeaders(ctx, spreadsheetId, tab);
  const ids = activities.map(() => crypto.randomUUID());
  const rows = activities.map((a, i) => recordToRow(headers, activityToRecord(a, ids[i])));

  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${quoteTab(tab)}!A1`
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: rows }) }
  );

  clearSheetsCache();
  return { tab, created, ids };
}

export interface RowRef {
  id?: string;
  /** 1-based sheet row; only used for legacy rows without an id */
  row?: number;
  /** Original title, required with `row` to make sure the row hasn't shifted */
  expectTitle?: string;
}

async function locateRow(
  ctx: { creds: ServiceAccountCredentials; token: string },
  spreadsheetId: string,
  tab: string,
  ref: RowRef
): Promise<{ rowNumber: number; headers: string[]; row: string[] } | null> {
  const data = await sheetsRequest<{ values?: string[][] }>(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(
      `${quoteTab(tab)}!A1:Z2000`
    )}`
  );
  const rows = data.values || [];
  if (rows.length === 0) return null;
  const headers = rows[0].map(normalizeHeader);

  if (ref.id) {
    const idIdx = headers.findIndex((h) => COLUMN_ALIASES.id.includes(h));
    if (idIdx === -1) return null;
    for (let r = 1; r < rows.length; r++) {
      if (String(rows[r]?.[idIdx] ?? '').trim() === ref.id) {
        return { rowNumber: r + 1, headers, row: rows[r] };
      }
    }
    return null;
  }

  if (ref.row && ref.row > 1 && ref.expectTitle !== undefined) {
    const row = rows[ref.row - 1];
    if (!row) return null;
    const titleIdx = headers.findIndex((h) => COLUMN_ALIASES.title.includes(h));
    const locIdx = headers.findIndex((h) => COLUMN_ALIASES.location_name.includes(h));
    const cellTitle = String(row[titleIdx] ?? '').trim();
    const cellLoc = String(row[locIdx] ?? '').trim();
    const expected = ref.expectTitle.trim();
    // The reader falls back to location name when a row has no title
    if (cellTitle === expected || (!cellTitle && cellLoc === expected)) {
      return { rowNumber: ref.row, headers, row };
    }
  }
  return null;
}

export async function updateActivity(tabName: string, ref: RowRef, a: ActivityInput): Promise<void> {
  const ctx = await writeContext();
  const tab = (await findTabTitle(tabName)) ?? tabName;
  const found = await locateRow(ctx, ctx.spreadsheetId, tab, ref);
  if (!found) throw new UserError('Activity not found — it may have been changed or removed. Refresh and try again.');

  const record = activityToRecord(a);
  const merged = found.headers.map((h, i) => {
    const canonical = (Object.keys(COLUMN_ALIASES) as SheetColumn[]).find((k) =>
      COLUMN_ALIASES[k].includes(h)
    );
    if (canonical && canonical in record) return record[canonical] ?? '';
    return found.row[i] ?? '';
  });
  const lastCol = columnLetter(found.headers.length - 1);
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(
      `${quoteTab(tab)}!A${found.rowNumber}:${lastCol}${found.rowNumber}`
    )}?valueInputOption=USER_ENTERED`,
    { method: 'PUT', body: JSON.stringify({ values: [merged] }) }
  );
  clearSheetsCache();
}

export async function deleteActivity(tabName: string, ref: RowRef): Promise<void> {
  const ctx = await writeContext();
  const tabs = await listTabs(ctx, ctx.spreadsheetId);
  const match = tabs.find((t) => t.title.trim().toLowerCase() === tabName.trim().toLowerCase());
  if (!match) throw new UserError('Trip not found.');
  const found = await locateRow(ctx, ctx.spreadsheetId, match.title, ref);
  if (!found) throw new UserError('Activity not found — it may have been changed or removed. Refresh and try again.');

  await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: match.sheetId,
              dimension: 'ROWS',
              startIndex: found.rowNumber - 1,
              endIndex: found.rowNumber,
            },
          },
        },
      ],
    }),
  });
  clearSheetsCache();
}

/** Deletes a whole trip tab. Refuses to delete the last remaining tab. */
export async function deleteTrip(tabName: string): Promise<void> {
  const ctx = await writeContext();
  const tabs = await listTabs(ctx, ctx.spreadsheetId);
  const match = tabs.find((t) => t.title.trim().toLowerCase() === tabName.trim().toLowerCase());
  if (!match) throw new UserError('Trip not found.');
  if (tabs.length <= 1) throw new UserError("This is the only trip, so it can't be deleted.");
  await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: match.sheetId } }] }),
  });
  await removePlace(match.title).catch(() => {});
  clearSheetsCache();
}

/** Renames a trip tab (e.g. "Japan - Tokyo" -> "Japan - Osaka"). */
export async function renameTrip(tabName: string, newName: string): Promise<void> {
  const ctx = await writeContext();
  const tabs = await listTabs(ctx, ctx.spreadsheetId);
  const match = tabs.find((t) => t.title.trim().toLowerCase() === tabName.trim().toLowerCase());
  if (!match) throw new UserError('Trip not found.');
  const clash = tabs.find(
    (t) => t.sheetId !== match.sheetId && t.title.trim().toLowerCase() === newName.trim().toLowerCase()
  );
  if (clash) throw new UserError(`A trip named "${clash.title}" already exists.`);
  await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: match.sheetId, title: newName },
            fields: 'title',
          },
        },
      ],
    }),
  });
  await renamePlaceTab(match.title, newName).catch(() => {});
  clearSheetsCache();
}

// ---------------------------------------------------------------------------
// Trip places: hidden "_trips" worksheet (tabs starting with "_" are ignored by the reader)
// Columns: tab, place, admin1, country, country_code, lat, lng, timezone
// ---------------------------------------------------------------------------

const PLACES_TAB = '_trips';
const PLACE_HEADERS = ['tab', 'place', 'admin1', 'country', 'country_code', 'lat', 'lng', 'timezone'];

function placeToRow(tab: string, p: Place): string[] {
  return [tab, p.name, p.admin1 || '', p.country, p.country_code, String(p.lat), String(p.lng), p.timezone];
}

function rowToPlace(row: string[]): Place | null {
  const lat = parseFloat(row[5]);
  const lng = parseFloat(row[6]);
  if (!row[1] || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name: row[1],
    admin1: row[2] || undefined,
    country: row[3] || '',
    country_code: row[4] || '',
    lat,
    lng,
    timezone: row[7] || 'UTC',
  };
}

async function readPlaceRows(
  ctx: { creds: ServiceAccountCredentials; token: string },
  spreadsheetId: string
): Promise<string[][] | null> {
  const res = await fetchSheetsApiWithRetry(
    `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${PLACES_TAB}!A1:H1000`)}`,
    { headers: { Authorization: `Bearer ${ctx.token}` } }
  );
  if (!res.ok) return null; // tab doesn't exist yet
  const data = (await res.json()) as { values?: string[][] };
  return data.values || [];
}

// Trip locations change only through savePlace/removePlace, which clear this (same timing as the trip cache)
let placeRowsCache: (Timed & { rows: Promise<string[][] | null>; refreshing?: boolean }) | null = null;

/** Saved place for a trip tab, or null when none was confirmed yet. */
export async function getPlace(tab: string): Promise<Place | null> {
  try {
    const ctx = await writeContext();
    const now = Date.now();
    const state = cacheState(placeRowsCache, now);
    if (state === 'miss') {
      placeRowsCache = { ...timed(now), rows: readPlaceRows(ctx, ctx.spreadsheetId) };
    } else if (state === 'stale' && !placeRowsCache!.refreshing) {
      const base = placeRowsCache!;
      base.refreshing = true;
      readPlaceRows(ctx, ctx.spreadsheetId)
        .then((r) => {
          // Only replace the entry we refreshed: a save in the meantime cleared it and wins
          if (r && placeRowsCache === base) placeRowsCache = { ...timed(Date.now()), rows: Promise.resolve(r) };
        })
        .catch(() => {})
        .finally(() => (base.refreshing = false));
    }
    const pending = placeRowsCache!.rows;
    const rows = await pending.catch((err) => {
      if (placeRowsCache?.rows === pending) placeRowsCache = null; // don't keep a failed read
      throw err;
    });
    if (!rows) return null;
    const wanted = tab.trim().toLowerCase();
    const row = rows.slice(1).find((r) => String(r[0] || '').trim().toLowerCase() === wanted);
    return row ? rowToPlace(row) : null;
  } catch {
    return null;
  }
}

/** Creates/updates the trip's place row (creating the hidden tab on first use). */
export async function savePlace(tab: string, place: Place): Promise<void> {
  placeRowsCache = null;
  const ctx = await writeContext();
  const { spreadsheetId } = ctx;
  let rows = await readPlaceRows(ctx, spreadsheetId);
  if (!rows) {
    await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PLACES_TAB, hidden: true } } }] }),
    });
    await sheetsRequest(
      ctx,
      `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${PLACES_TAB}!A1`)}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [PLACE_HEADERS] }) }
    );
    rows = [PLACE_HEADERS];
  }
  const wanted = tab.trim().toLowerCase();
  const idx = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim().toLowerCase() === wanted);
  const values = [placeToRow(tab, place)];
  if (idx > 0) {
    await sheetsRequest(
      ctx,
      `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${PLACES_TAB}!A${idx + 1}:H${idx + 1}`)}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values }) }
    );
  } else {
    await sheetsRequest(
      ctx,
      `${SHEETS_BASE}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${PLACES_TAB}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) }
    );
  }
}

/** Blanks the place row of a deleted trip (rows are left in place; reader ignores empty tabs). */
export async function removePlace(tab: string): Promise<void> {
  placeRowsCache = null;
  const ctx = await writeContext();
  const rows = await readPlaceRows(ctx, ctx.spreadsheetId);
  if (!rows) return;
  const wanted = tab.trim().toLowerCase();
  const idx = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim().toLowerCase() === wanted);
  if (idx < 1) return;
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(`${PLACES_TAB}!A${idx + 1}:H${idx + 1}`)}:clear`,
    { method: 'POST', body: '{}' }
  );
}

export async function renamePlaceTab(oldTab: string, newTab: string): Promise<void> {
  const place = await getPlace(oldTab);
  if (!place) return;
  await removePlace(oldTab);
  await savePlace(newTab, place);
}

// ---------------------------------------------------------------------------
// Generic hidden-tab helpers (users, audit): tabs starting with "_" are ignored by the reader
// ---------------------------------------------------------------------------

/** Rows of a worksheet, or null when the tab doesn't exist. */
export async function readSheetRows(tab: string, lastCol = 'H'): Promise<string[][] | null> {
  const ctx = await writeContext();
  const res = await fetchSheetsApiWithRetry(
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A1:${lastCol}2000`)}`,
    { headers: { Authorization: `Bearer ${ctx.token}` } }
  );
  if (!res.ok) return null;
  return ((await res.json()) as { values?: string[][] }).values || [];
}

/** Creates a hidden worksheet with a header row when it doesn't exist yet. */
export async function ensureHiddenTab(tab: string, headers: readonly string[]): Promise<void> {
  const ctx = await writeContext();
  const tabs = await listTabs(ctx, ctx.spreadsheetId);
  if (tabs.some((t) => t.title === tab)) return;
  await sheetsRequest(ctx, `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab, hidden: true } } }] }),
  });
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A1`)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [headers] }) }
  );
}

export async function appendSheetRow(tab: string, values: string[]): Promise<void> {
  const ctx = await writeContext();
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [values] }) }
  );
}

export async function updateSheetRow(tab: string, rowNumber: number, values: string[]): Promise<void> {
  const ctx = await writeContext();
  const last = columnLetter(values.length - 1);
  await sheetsRequest(
    ctx,
    `${SHEETS_BASE}/${encodeURIComponent(ctx.spreadsheetId)}/values/${encodeURIComponent(`${quoteTab(tab)}!A${rowNumber}:${last}${rowNumber}`)}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [values] }) }
  );
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
