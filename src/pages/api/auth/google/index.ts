import type { APIRoute } from 'astro';
import {
  OAUTH_COOKIE,
  OAUTH_TTL_SECONDS,
  buildGoogleAuthUrl,
  clientIp,
  createOAuthState,
  createRateLimiter,
  pkceChallenge,
  randomToken,
  safeNext,
} from '../../../../utils/auth';
import { authConfig } from '../../../../utils/authEnv';

const limiter = ((globalThis as any).__OAUTH_START_LIMITER__ ||= createRateLimiter(20, 10 * 60 * 1000));

// Step 1: send the browser to Google with PKCE, a random state and a nonce (A07).
export const GET: APIRoute = async ({ request, url, cookies, redirect }) => {
  const auth = authConfig();
  if (!auth.configured) return redirect('/login?error=not_configured');
  if (!limiter.take(clientIp(request))) return redirect('/login?error=too_many');

  const state = randomToken(24);
  const nonce = randomToken(24);
  const verifier = randomToken(48);
  const next = safeNext(url.searchParams.get('next'), '/');

  cookies.set(OAUTH_COOKIE, await createOAuthState({ state, verifier, nonce, next }, auth.secret), {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax', // must be sent when Google redirects back (top-level GET)
    path: '/api/auth',
    maxAge: OAUTH_TTL_SECONDS,
  });

  const redirectUri = `${auth.siteUrl || url.origin}/api/auth/google/callback`;
  return redirect(
    buildGoogleAuthUrl({ clientId: auth.clientId, redirectUri, state, nonce, challenge: await pkceChallenge(verifier) }),
    302
  );
};
