#!/usr/bin/env node
// Post-deploy smoke test: node scripts/smoke.mjs https://your-site.example
// Proves the OWASP A01/A05 basics on a live deployment: writes need a session and hardening headers are present.
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const req = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init });

const home = await req('/');
check('home is served (no 5xx)', home.status < 500, `HTTP ${home.status}`);
for (const h of ['x-content-type-options', 'x-frame-options', 'referrer-policy']) {
  check(`header ${h}`, home.headers.has(h), home.headers.get(h) ?? 'missing');
}
if (base.startsWith('https://')) check('header strict-transport-security', home.headers.has('strict-transport-security'));
check('CSP present (production only)', !base.startsWith('https://') || home.headers.has('content-security-policy'));

const welcome = await req('/welcome');
check('/welcome is reachable and never cached', welcome.status === 200 && /no-store/.test(welcome.headers.get('cache-control') ?? ''), `HTTP ${welcome.status}`);
const first = await req('/', { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 smoke' } });
check('first visit to / goes to /welcome', first.status === 302 && (first.headers.get('location') ?? '').endsWith('/welcome'), `HTTP ${first.status}`);
const seen = await req('/', { headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 smoke', cookie: 'pt_welcome=1' } });
check('a returning guest gets the trips', seen.status === 200, `HTTP ${seen.status}`);

const login = await req('/login');
check('/login is reachable', login.status === 200, `HTTP ${login.status}`);

check('responses carry a request id (x-request-id)', home.headers.has('x-request-id'), home.headers.get('x-request-id') ?? 'missing');

const health = await req('/api/health');
let healthBody = {};
try { healthBody = await health.json(); } catch { /* not JSON */ }
check('/api/health answers and the trip sheet is readable', health.status === 200 && ['ok', 'degraded'].includes(healthBody.status), `HTTP ${health.status} ${healthBody.status ?? ''} v${healthBody.version ?? '?'}`);
check('/api/health is not cached', /no-store/.test(health.headers.get('cache-control') ?? ''));
check('/api/health shows no details to anonymous callers', !('checks' in healthBody) && !('stats' in healthBody));

const sg = await req('/api/suggestions');
check('GET /api/suggestions is public and read-only', sg.status === 200, `HTTP ${sg.status}`);

for (const [method, path] of [['POST', '/api/itinerary'], ['PATCH', '/api/itinerary'], ['DELETE', '/api/itinerary'], ['POST', '/api/place'], ['POST', '/api/trips'], ['PATCH', '/api/trips'], ['POST', '/api/trips/copy'], ['GET', '/api/pocket?tab=x'], ['POST', '/api/pocket']]) {
  const r = await req(path, { method, headers: { 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body: '{}' }) });
  check(`${method} ${path} without session is refused`, r.status === 401 || r.status === 503, `HTTP ${r.status}`);
}
const sync = await req('/api/sheets-sync');
check('GET /api/sheets-sync without session is refused', sync.status === 401 || sync.status === 503, `HTTP ${sync.status}`);
const add = await req('/add');
check('/add redirects to /login', add.status >= 300 && add.status < 400 && (add.headers.get('location') ?? '').includes('/login'), `HTTP ${add.status}`);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll smoke checks passed');
process.exit(failed ? 1 : 0);
