import type { APIRoute } from 'astro';
import {
  OAUTH_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  clientIp,
  createRateLimiter,
  createSession,
  readOAuthState,
  safeNext,
  timingSafeEqual,
  validateIdTokenClaims,
  verifyGoogleIdToken,
  type Jwk,
} from '../../../../utils/auth';
import { authConfig } from '../../../../utils/authEnv';
import { registerLogin, recordAudit } from '../../../../utils/users';

const limiter = ((globalThis as any).__OAUTH_CB_LIMITER__ ||= createRateLimiter(30, 10 * 60 * 1000));
const g = globalThis as unknown as { __GOOGLE_JWKS__?: { keys: Jwk[]; expiresAt: number } };
const enc = new TextEncoder();

async function googleKeys(): Promise<Jwk[]> {
  if (g.__GOOGLE_JWKS__ && g.__GOOGLE_JWKS__.expiresAt > Date.now()) return g.__GOOGLE_JWKS__.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!res.ok) throw new Error(`Google keys ${res.status}`);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys;
  g.__GOOGLE_JWKS__ = { keys, expiresAt: Date.now() + 60 * 60 * 1000 };
  return keys;
}

const fail = (redirect: (p: string, s?: number) => Response, code: string, extra = '') => redirect(`/login?error=${code}${extra}`, 302);

// Step 2: Google sends the browser back with ?code. Verify everything, then check the user table.
export const GET: APIRoute = async ({ request, url, cookies, redirect }) => {
  const auth = authConfig();
  if (!auth.configured) return fail(redirect, 'not_configured');
  if (!limiter.take(clientIp(request))) return fail(redirect, 'too_many');

  const saved = await readOAuthState(cookies.get(OAUTH_COOKIE)?.value, auth.secret);
  cookies.delete(OAUTH_COOKIE, { path: '/api/auth' }); // one use only

  if (url.searchParams.get('error')) return fail(redirect, 'cancelled');
  const code = url.searchParams.get('code') ?? '';
  const state = url.searchParams.get('state') ?? '';
  if (!saved || !code || !timingSafeEqual(enc.encode(state), enc.encode(saved.state))) return fail(redirect, 'invalid');

  try {
    const redirectUri = `${auth.siteUrl || url.origin}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: auth.clientId,
        client_secret: auth.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: saved.verifier,
      }),
    });
    if (!tokenRes.ok) {
      console.error('[auth] Google token exchange failed:', tokenRes.status);
      return fail(redirect, 'failed');
    }
    const { id_token } = (await tokenRes.json()) as { id_token?: string };
    if (!id_token) return fail(redirect, 'failed');

    const claims = await verifyGoogleIdToken(id_token, await googleKeys());
    if (!claims) return fail(redirect, 'invalid');
    const checked = validateIdTokenClaims(claims, { clientId: auth.clientId, nonce: saved.nonce });
    if (!checked.ok) {
      console.error('[auth] ID token rejected:', checked.reason);
      return fail(redirect, 'invalid');
    }

    const result = await registerLogin(checked.profile);
    if (!result.ok) {
      if (result.reason === 'google-id-mismatch') return fail(redirect, 'denied');
      // Not registered: the login page shows the "ask the admin on WhatsApp" prompt for this email
      return fail(redirect, 'not_registered', `&email=${encodeURIComponent(checked.profile.email)}`);
    }

    cookies.set(
      SESSION_COOKIE,
      await createSession(
        { sub: result.user.googleId, email: result.user.email, name: result.user.name, picture: result.user.picture },
        auth.secret
      ),
      { httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax', path: '/', maxAge: SESSION_TTL_SECONDS }
    );
    void recordAudit({ email: result.user.email, action: 'login' });
    return redirect(safeNext(saved.next, '/'), 302);
  } catch (err) {
    console.error('[auth] sign-in failed:', err instanceof Error ? err.message : err);
    return fail(redirect, 'failed');
  }
};
