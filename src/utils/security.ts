// Output-side hardening shared by the sheet reader/writer and the middleware (OWASP A03/A05).

/** http(s) URLs only: blocks javascript:, data: and other schemes coming from sheet cells. */
export function safeHttpUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Converts a YouTube watch/share/embed link to a privacy-friendly embed URL, or null for anything else. */
export function youtubeEmbedUrl(value: string | undefined | null): string | null {
  const url = safeHttpUrl(value);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
    id = u.pathname.startsWith('/embed/') ? u.pathname.slice('/embed/'.length) : u.searchParams.get('v');
  }
  return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Neutralises spreadsheet formula injection for text written with USER_ENTERED (=, +, -, @ at the start). */
export function sheetText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Astro/Preact hydration uses inline bootstrap scripts
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://open.er-api.com https://cdn.jsdelivr.net",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Cache-Control for public pages. Guests: `private, max-age=30` (never on a shared CDN; a prefetched tab is reused
 * on tap and Back is instant; matches the 30s server-side Sheets freshness, and a reload always revalidates).
 * Signed-in editors keep `no-store` so pressing Back after signing out can't bring an editor's page back (A01).
 */
export function pageCacheControl(signedIn: boolean): string {
  return signedIn ? 'private, no-store' : 'private, max-age=30';
}

export function securityHeaders(production: boolean): Record<string, string> {
  return {
    // CSP is production-only so the dev server's HMR/inline tooling is never blocked
    ...(production ? { 'Content-Security-Policy': `${CSP}; upgrade-insecure-requests` } : {}),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    ...(production ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : {}),
  };
}

/** An error whose message is safe to show to the person using the app. Everything else is logged, not leaked (A09/A05). */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

export function clientError(err: unknown, fallback: string): string {
  if (err instanceof UserError) return err.message;
  console.error(fallback, err);
  return fallback;
}
