import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoogleAuthUrl,
  createOAuthState,
  createRateLimiter,
  createSession,
  fromBase64Url,
  isSameOrigin,
  pkceChallenge,
  randomToken,
  readAuthConfig,
  readOAuthState,
  safeNext,
  toBase64Url,
  validateIdTokenClaims,
  verifyGoogleIdToken,
  verifySession,
  whatsappLink,
} from '../src/utils/auth.ts';
import { safeHttpUrl, sheetText, youtubeEmbedUrl } from '../src/utils/security.ts';

const SECRET = 'x'.repeat(32);
const USER = { sub: '1234567890', email: 'a@example.com', name: 'Aisha', picture: 'https://lh3.googleusercontent.com/a' };

test('session carries the user, expires and rejects tampering', async () => {
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const token = await createSession(USER, SECRET, t0);
  assert.deepEqual(await verifySession(token, SECRET, t0 + 1000), USER);
  assert.equal(await verifySession(token, SECRET, t0 + 8 * 24 * 3600 * 1000), null, 'expired after 7 days');
  assert.equal(await verifySession(token, 'y'.repeat(32), t0 + 1000), null, 'wrong secret');
  const [body, sig] = token.split('.');
  const forged = toBase64Url(new TextEncoder().encode(JSON.stringify({ ...USER, email: 'evil@example.com', exp: 9999999999 })));
  assert.equal(await verifySession(`${forged}.${sig}`, SECRET, t0), null, 'payload swap');
  assert.equal(await verifySession(`${body}.${sig}x`, SECRET, t0), null, 'signature change');
  for (const bad of ['', 'a', 'a.b.c', '.sig', 'body.', undefined]) assert.equal(await verifySession(bad, SECRET, t0), null);
});

test('an oauth-state token cannot be used as a session (and vice versa)', async () => {
  const t0 = Date.now();
  const oauth = await createOAuthState({ state: 's', verifier: 'v', nonce: 'n', next: '/x' }, SECRET, t0);
  assert.equal(await verifySession(oauth, SECRET, t0), null);
  const session = await createSession(USER, SECRET, t0);
  assert.equal(await readOAuthState(session, SECRET, t0), null);
  assert.deepEqual(await readOAuthState(oauth, SECRET, t0 + 1000), { state: 's', verifier: 'v', nonce: 'n', next: '/x' });
  assert.equal(await readOAuthState(oauth, SECRET, t0 + 11 * 60 * 1000), null, 'sign-in must finish within 10 minutes');
});

test('PKCE challenge matches the RFC 7636 example', async () => {
  assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.notEqual(randomToken(), randomToken());
  assert.deepEqual(fromBase64Url(toBase64Url(new Uint8Array([251, 255, 0, 7]))), new Uint8Array([251, 255, 0, 7]));
});

test('google auth url requests PKCE, nonce and state', () => {
  const u = new URL(buildGoogleAuthUrl({ clientId: 'cid', redirectUri: 'https://t.example/api/auth/google/callback', state: 's', nonce: 'n', challenge: 'c' }));
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('state'), 's');
  assert.equal(u.searchParams.get('nonce'), 'n');
  assert.equal(u.searchParams.get('scope'), 'openid email profile');
});

const NOW = Date.parse('2026-01-01T00:00:00Z');
const claims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: 'client-123',
  sub: '999',
  email: 'User@Example.com',
  email_verified: true,
  name: 'User',
  picture: 'https://p.example/u.png',
  nonce: 'n1',
  iat: NOW / 1000 - 10,
  exp: NOW / 1000 + 3000,
  ...over,
});

test('id token claims: every check is enforced', () => {
  const ok = validateIdTokenClaims(claims(), { clientId: 'client-123', nonce: 'n1' }, NOW);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.profile.email, 'user@example.com', 'email is lower-cased');
  const bad = (over: Record<string, unknown>) => validateIdTokenClaims(claims(over), { clientId: 'client-123', nonce: 'n1' }, NOW);
  assert.deepEqual(bad({ iss: 'https://evil.test' }), { ok: false, reason: 'issuer' });
  assert.deepEqual(bad({ aud: 'other-client' }), { ok: false, reason: 'audience' });
  assert.deepEqual(bad({ exp: NOW / 1000 - 1 }), { ok: false, reason: 'expired' });
  assert.deepEqual(bad({ nonce: 'replayed' }), { ok: false, reason: 'nonce' });
  assert.deepEqual(bad({ email_verified: false }), { ok: false, reason: 'email-unverified' });
  assert.deepEqual(bad({ sub: '' }), { ok: false, reason: 'subject' });
  assert.deepEqual(bad({ email: 'not-an-email' }), { ok: false, reason: 'email' });
});

test('id token signature is verified against the published keys', async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as { n: string; e: string; kty: string };
  const enc = (o: unknown) => toBase64Url(new TextEncoder().encode(JSON.stringify(o)));
  const sign = async (header: object, payload: object) => {
    const input = `${enc(header)}.${enc(payload)}`;
    const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(input)));
    return `${input}.${toBase64Url(sig)}`;
  };
  const keys = [{ kid: 'k1', kty: 'RSA', n: jwk.n, e: jwk.e }];
  const token = await sign({ alg: 'RS256', kid: 'k1' }, { sub: '1', email: 'a@b.co' });
  assert.deepEqual(await verifyGoogleIdToken(token, keys), { sub: '1', email: 'a@b.co' });
  const [h, , s] = token.split('.');
  assert.equal(await verifyGoogleIdToken(`${h}.${enc({ sub: '2', email: 'x@y.co' })}.${s}`, keys), null, 'tampered payload');
  assert.equal(await verifyGoogleIdToken(await sign({ alg: 'RS256', kid: 'unknown' }, { sub: '1' }), keys), null, 'unknown key id');
  assert.equal(await verifyGoogleIdToken(await sign({ alg: 'none', kid: 'k1' }, { sub: '1' }), keys), null, 'alg none is never accepted');
  assert.equal(await verifyGoogleIdToken('not.a.jwt', keys), null);
});

test('auth config needs a Google client and a real secret', () => {
  assert.equal(readAuthConfig({}).configured, false);
  assert.equal(readAuthConfig({ GOOGLE_CLIENT_ID: 'id-1234567890', GOOGLE_CLIENT_SECRET: 'sec-123', AUTH_SECRET: 'tiny' }).configured, false);
  assert.equal(readAuthConfig({ GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: 'sec-123', AUTH_SECRET: SECRET }).configured, false);
  const cfg = readAuthConfig({ GOOGLE_CLIENT_ID: 'id-1234567890', GOOGLE_CLIENT_SECRET: 'sec-123', AUTH_SECRET: SECRET, ADMIN_WHATSAPP: '+60 12-345 6789', SITE_URL: 'https://t.example/' });
  assert.equal(cfg.configured, true);
  assert.equal(cfg.adminWhatsapp, '60123456789');
  assert.equal(cfg.siteUrl, 'https://t.example');
});

test('whatsapp access-request link', () => {
  const link = whatsappLink('+60 12-345 6789', 'a@example.com') as string;
  assert.ok(link.startsWith('https://wa.me/60123456789?text='));
  assert.ok(decodeURIComponent(link).includes('a@example.com'));
  assert.equal(whatsappLink('', 'a@example.com'), null, 'no admin number configured');
  assert.equal(whatsappLink('123', 'a@example.com'), null, 'implausible number');
  assert.ok(!decodeURIComponent(whatsappLink('60123456789', 'a@b.co\r\nx') as string).includes('\n'));
});

test('safeNext blocks open redirects', () => {
  assert.equal(safeNext('/japan/tokyo?x=1'), '/japan/tokyo?x=1');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/a\r\nSet-Cookie: x', null, undefined]) {
    assert.equal(safeNext(bad as string | null), '/');
  }
});

test('same-origin check for CSRF', () => {
  const req = (h: Record<string, string>) => new Request('https://trip.example/api/itinerary', { method: 'POST', headers: h });
  assert.equal(isSameOrigin(req({ origin: 'https://trip.example' })), true);
  assert.equal(isSameOrigin(req({ origin: 'http://trip.example' })), true, 'scheme can differ behind a proxy; the host decides');
  assert.equal(isSameOrigin(req({ origin: 'https://evil.test' })), false);
  assert.equal(isSameOrigin(req({})), false, 'no Origin and no Fetch-Metadata is rejected');
  assert.equal(isSameOrigin(req({ 'sec-fetch-site': 'cross-site', origin: 'https://trip.example' })), false);
});

test('rate limiter blocks after max and recovers after the window', () => {
  const rl = createRateLimiter(2, 1000);
  assert.deepEqual([rl.take('ip', 0), rl.take('ip', 1), rl.take('ip', 2)], [true, true, false]);
  assert.equal(rl.take('other', 2), true);
  assert.equal(rl.take('ip', 1001), true);
});

test('sheet cell hardening', () => {
  assert.equal(sheetText('=HYPERLINK("http://evil")'), `'=HYPERLINK("http://evil")`);
  assert.equal(sheetText('+1 night'), `'+1 night`);
  assert.equal(sheetText('Senso-ji'), 'Senso-ji');
  assert.equal(safeHttpUrl('javascript:alert(1)'), null);
  assert.equal(safeHttpUrl('data:text/html,x'), null);
  assert.ok(safeHttpUrl('https://maps.google.com/?q=a'));
  assert.equal(youtubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(youtubeEmbedUrl('https://evil.test/embed/abc'), null);
});
