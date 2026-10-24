import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, isSameOrigin, readAuthConfig, verifySessionToken } from './utils/auth';
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

  const needsEditor =
    matches(path, PROTECTED_PAGES) || (matches(path, PROTECTED_API) && (path === '/api/sheets-sync' || !SAFE_METHODS.has(request.method)));

  let response: Response | null = null;

  if (needsEditor) {
    const auth = readAuthConfig();
    if (!auth.configured && production) {
      // Fail closed: reading keeps working, editing is off until EDITOR_PASSWORD + AUTH_SECRET are set.
      response = isApi ? json({ error: 'Editing is disabled: the server has no editor password configured.' }, 503) : context.redirect('/login');
    } else if (auth.configured) {
      const ok = await verifySessionToken(cookies.get(SESSION_COOKIE)?.value, auth.secret);
      if (!ok) {
        response = isApi
          ? json({ error: 'Please sign in to edit.', code: 'unauthenticated' }, 401)
          : context.redirect(`/login?next=${encodeURIComponent(path + url.search)}`);
      } else if (isApi && !SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
        response = json({ error: 'Cross-site request blocked.' }, 403);
      }
    }
    // Not configured in dev: allow, so local work needs no setup.
  }

  const res = response ?? (await next());
  const headers = securityHeaders(production);
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
