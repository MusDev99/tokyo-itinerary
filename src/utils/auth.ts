// Minimal, dependency-free Google sign-in + signed sessions (OWASP A01/A02/A07).
// Web Crypto only, so it runs unchanged on Vercel (Node), Netlify and the Edge.
// No relative imports on purpose: tests run this file directly with `node --test`.

export const SESSION_COOKIE = 'tk_session';
export const OAUTH_COOKIE = 'tk_oauth';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days (access is re-checked against the user table on every write)
export const OAUTH_TTL_SECONDS = 60 * 10; // the sign-in round trip must finish within 10 minutes

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface AuthConfig {
  /** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET (>= 16 chars) are all set. */
  configured: boolean;
  clientId: string;
  clientSecret: string;
  secret: string;
  /** Public origin used for the OAuth redirect URI (e.g. https://trips.example.com). Empty = use the request origin. */
  siteUrl: string;
  /** Admin WhatsApp number for access requests (digits only). */
  adminWhatsapp: string;
}

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const clientId = (env.GOOGLE_CLIENT_ID ?? '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? '').trim();
  const secret = env.AUTH_SECRET ?? '';
  return {
    configured: clientId.length > 10 && clientSecret.length > 5 && secret.length >= 16,
    clientId,
    clientSecret,
    secret,
    siteUrl: (env.SITE_URL ?? '').trim().replace(/\/+$/, ''),
    adminWhatsapp: (env.ADMIN_WHATSAPP ?? '').replace(/\D/g, ''),
  };
}

// ---- base64url + HMAC helpers ------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** Signs `{...payload, exp}` as `<b64 json>.<b64 hmac>`; `purpose` keeps different token kinds from being swapped. */
async function signPayload(purpose: string, payload: object, ttlSeconds: number, secret: string, nowMs: number): Promise<string> {
  const body = toBase64Url(enc.encode(JSON.stringify({ ...payload, exp: Math.floor(nowMs / 1000) + ttlSeconds })));
  return `${body}.${toBase64Url(await hmac(secret, `${purpose}:${body}`))}`;
}

async function readPayload<T>(purpose: string, token: string | undefined, secret: string, nowMs: number): Promise<(T & { exp: number }) | null> {
  if (!token || !secret || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = toBase64Url(await hmac(secret, `${purpose}:${parts[0]}`));
  if (!timingSafeEqual(enc.encode(parts[1]), enc.encode(expected))) return null;
  try {
    const data = JSON.parse(dec.decode(fromBase64Url(parts[0])));
    if (typeof data?.exp !== 'number' || data.exp * 1000 <= nowMs) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- Session -------------------------------------------------------------------

export interface SessionUser {
  /** Google account id (the OIDC `sub`) */
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export function createSession(user: SessionUser, secret: string, nowMs = Date.now()): Promise<string> {
  return signPayload('session', user, SESSION_TTL_SECONDS, secret, nowMs);
}

export async function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionUser | null> {
  const data = await readPayload<SessionUser>('session', token, secret, nowMs);
  if (!data || typeof data.sub !== 'string' || typeof data.email !== 'string' || !data.sub || !data.email) return null;
  return { sub: data.sub, email: data.email, name: String(data.name ?? ''), picture: String(data.picture ?? '') };
}

// ---- OAuth (Authorization Code + PKCE) --------------------------------------------

export interface OAuthState {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
}

export function createOAuthState(value: OAuthState, secret: string, nowMs = Date.now()): Promise<string> {
  return signPayload('oauth', value, OAUTH_TTL_SECONDS, secret, nowMs);
}

export async function readOAuthState(token: string | undefined, secret: string, nowMs = Date.now()): Promise<OAuthState | null> {
  const d = await readPayload<OAuthState>('oauth', token, secret, nowMs);
  if (!d || !d.state || !d.verifier || !d.nonce) return null;
  return { state: d.state, verifier: d.verifier, nonce: d.nonce, next: typeof d.next === 'string' ? d.next : '/' };
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
}

export function buildGoogleAuthUrl(p: { clientId: string; redirectUri: string; state: string; nonce: string; challenge: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

type ClaimsResult = { ok: true; profile: GoogleProfile } | { ok: false; reason: string };

/** Checks the (already signature-verified) ID token claims. Never trust a token that skips any of these. */
export function validateIdTokenClaims(
  claims: Record<string, unknown>,
  expected: { clientId: string; nonce: string },
  nowMs = Date.now()
): ClaimsResult {
  if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') return { ok: false, reason: 'issuer' };
  const aud = claims.aud;
  if (!(aud === expected.clientId || (Array.isArray(aud) && aud.includes(expected.clientId)))) return { ok: false, reason: 'audience' };
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= nowMs) return { ok: false, reason: 'expired' };
  if (typeof claims.iat === 'number' && claims.iat * 1000 > nowMs + 5 * 60 * 1000) return { ok: false, reason: 'issued-in-future' };
  if (!claims.nonce || claims.nonce !== expected.nonce) return { ok: false, reason: 'nonce' };
  if (claims.email_verified !== true) return { ok: false, reason: 'email-unverified' };
  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, reason: 'subject' };
  if (typeof claims.email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(claims.email)) return { ok: false, reason: 'email' };
  return {
    ok: true,
    profile: {
      sub: claims.sub,
      email: claims.email.toLowerCase(),
      name: typeof claims.name === 'string' ? claims.name.slice(0, 120) : '',
      picture: typeof claims.picture === 'string' ? claims.picture.slice(0, 500) : '',
    },
  };
}

export interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  n: string;
  e: string;
}

/** Verifies an RS256 JWT against Google's published keys and returns its claims, or null. */
export async function verifyGoogleIdToken(idToken: string, keys: Jwk[]): Promise<Record<string, unknown> | null> {
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(dec.decode(fromBase64Url(parts[0])));
    if (header.alg !== 'RS256') return null;
    const jwk = keys.find((k) => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, fromBase64Url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    return JSON.parse(dec.decode(fromBase64Url(parts[1])));
  } catch {
    return null;
  }
}

/** wa.me link with a ready-made access request for the admin; null when no admin number is configured. */
export function whatsappLink(adminNumber: string, email: string): string | null {
  const digits = adminNumber.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  const safeEmail = email.replace(/[\r\n]/g, '').slice(0, 200);
  const text = `Hi, please give my Google account access to edit PlanTravel itineraries.${safeEmail ? ` My email: ${safeEmail}` : ''}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// ---- Request helpers --------------------------------------------------------------

/** Only same-site relative paths are allowed after login (prevents open redirects, A01). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return fallback;
  return next;
}

/** CSRF defence for cookie-authenticated writes: Origin (or Sec-Fetch-Site) must match this site. */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Best-effort throttle. In-memory, so per serverless instance; add an edge/WAF rule for a hard limit. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key: string, now = Date.now()): boolean {
      const cur = hits.get(key);
      if (!cur || cur.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        return true;
      }
      cur.count += 1;
      return cur.count <= max;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

export function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim();
}
