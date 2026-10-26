import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isSameOrigin, verifySession } from './utils/auth';
import { authConfig } from './utils/authEnv';
import { findActiveUser } from './utils/users';
import { securityHeaders } from './utils/security';

// Public site stays read-only for everyone. Anything that changes the sheet needs an editor session (OWASP A01).
const PROTECTED_PAGES = ['/add'];
const PROTECTED_API = ['/api/itinerary', '/api/place', '/api/sheets-sync']; // sheets-sync also leaks sheet metadata on GET
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, url } = context;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const production = import.meta.env.PROD;
  const isApi = path.startsWith('/api/');
  const auth = authConfig();

  // Who is this? A signed cookie check only (no sheet call), so every page can show the avatar / hide edit controls.
  context.locals.user = auth.configured ? await verifySession(cookies.get(SESSION_COOKIE)?.value, auth.secret) : null;

  const needsEditor =
    matches(path, PROTECTED_PAGES) || (matches(path, PROTECTED_API) && (path === '/api/sheets-sync' || !SAFE_METHODS.has(request.method)));

  let response: Response | null = null;

  if (needsEditor) {
    const user = context.locals.user;
    if (!auth.configured) {
      // Fail closed everywhere: reading keeps working, editing is off until Google sign-in is configured.
      response = isApi ? json({ error: 'Editing is disabled: Google sign-in is not configured on the server.' }, 503) : context.redirect('/login?error=not_configured');
    } else if (!user) {
      response = isApi
        ? json({ error: 'Please sign in to edit.', code: 'unauthenticated' }, 401)
        : context.redirect(`/login?next=${encodeURIComponent(path + url.search)}`);
    } else {
      // Registered AND still active in the user table (cached for a minute), so revoking a row takes effect quickly.
      let active = false;
      try {
        active = !!(await findActiveUser(user.email));
      } catch (err) {
        console.error('[auth] could not check the user table:', err instanceof Error ? err.message : err);
        response = isApi ? json({ error: 'Could not verify your access right now. Please try again.' }, 503) : context.redirect('/login?error=failed');
      }
      if (!response && !active) {
        cookies.delete(SESSION_COOKIE, { path: '/' });
        context.locals.user = null;
        response = isApi
          ? json({ error: 'Your access was removed. Ask the admin to re-enable it.', code: 'unauthenticated' }, 401)
          : context.redirect(`/login?error=not_registered&email=${encodeURIComponent(user.email)}`);
      } else if (!response && isApi && !SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
        response = json({ error: 'Cross-site request blocked.' }, 403);
      }
    }
  }

  const res = response ?? (await next());
  const headers: Record<string, string> = securityHeaders(production);
  // Pages are cached per session: signing in or out changes the cookie, so a cached guest copy is never reused
  if ((res.headers.get('content-type') || '').includes('text/html')) headers.Vary = 'Cookie';
  try {
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  } catch {
    // Some responses (e.g. fetched/redirect) have immutable headers: clone then set.
    const copy = new Response(res.body, res);
    for (const [k, v] of Object.entries(headers)) copy.headers.set(k, v);
    return copy;
  }
});
