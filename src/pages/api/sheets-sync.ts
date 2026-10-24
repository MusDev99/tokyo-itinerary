import type { APIRoute } from 'astro';
import {
  pullCountriesFromGoogleSheets,
  resolveSpreadsheetId,
  loadServiceAccountCredentials,
  SHEET_HEADERS,
} from '../../utils/googleSheets';
import { clientError } from '../../utils/security';

export const GET: APIRoute = async () => {
  const spreadsheetId = resolveSpreadsheetId();
  const creds = loadServiceAccountCredentials();

  if (!spreadsheetId || !creds) {
    return new Response(
      JSON.stringify({
        configured: false,
        spreadsheetId: spreadsheetId || null,
        serviceAccountEmail: creds?.client_email || null,
        headers: SHEET_HEADERS,
        source: 'unconfigured',
        message: !creds
          ? 'Service account credentials not found (set GOOGLE_SERVICE_ACCOUNT_JSON or provide credentials/keys.json)'
          : 'GOOGLE_SHEET_ID is not set in environment variables.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const { result } = await pullCountriesFromGoogleSheets({
    spreadsheetId,
  });

  return new Response(JSON.stringify({ ...result, headers: SHEET_HEADERS }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async () => {
  try {
    // The target sheet is fixed server-side: a caller-supplied spreadsheetId would let a request
    // point the service account at any sheet it can reach (OWASP A01/A10).
    // Clear in-memory cache so subsequent page loads fetch fresh Google Sheet tabs
    (globalThis as any).__TOKYO_SHEETS_CACHE__ = undefined;

    const { result } = await pullCountriesFromGoogleSheets({});
    return new Response(JSON.stringify(result), {
      status: result.error ? 400 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: clientError(err, 'Unexpected error during Google Sheets refresh'),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
