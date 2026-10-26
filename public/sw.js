/* PlanTravel service worker: offline READ access (no offline writes).
 * - Pages: network first (3s timeout, Doherty Threshold), then the saved copy, then /offline.
 * - /_astro/* (hashed, immutable): cache first, precached from /sw-assets.json on install.
 * - Other public files (logo, icons, manifest) and Google Fonts: stale-while-revalidate. Read-only public APIs: network first, cached copy offline.
 * - Never cached: non-GET, /api/* writes, auth/admin screens. Signing out clears the saved pages (shared devices).
 * Pure helpers are attached to self.__pwa so tests/sw.test.ts can exercise them in node:vm. */
const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const RUNTIME = `runtime-${VERSION}`;
const KEEP = [SHELL, PAGES, ASSETS, RUNTIME];

const OFFLINE_URL = '/offline';
const SHELL_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/favicon.svg', '/logo.svg', '/icons/icon-192.png'];
const NETWORK_TIMEOUT_MS = 3000;
const WARM_EVERY_MS = 6 * 60 * 60 * 1000; // re-save the whole trip at most every 6h
const WARM_KEY = '/__pwa/warmed-at';
const LIMITS = { [PAGES]: 80, [RUNTIME]: 60 };

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const READ_APIS = ['/api/currency-exchange', '/api/prayer-times'];
// Signed-in or per-session screens: always live, never saved
const NO_STORE = ['/login', '/add', '/api', '/__pwa'];

// Same prefix rule as src/middleware.ts: the path itself or anything below it
const startsWithAny = (path, list) => list.some((p) => path === p || path.startsWith(`${p}/`));

/** Which strategy handles a request. Pure: (method, url, origin, mode) -> name. */
function strategyFor(method, url, origin, mode) {
  if (method !== 'GET') return 'bypass';
  const u = new URL(url);
  if (u.origin !== origin) return FONT_HOSTS.includes(u.hostname) ? 'font' : 'bypass';
  if (READ_APIS.includes(u.pathname)) return 'api';
  if (startsWithAny(u.pathname, NO_STORE)) return 'bypass';
  if (u.pathname.startsWith('/_astro/')) return 'asset';
  if (mode === 'navigate') return 'page';
  if (/\.[a-z0-9]+$/i.test(u.pathname)) return 'static'; // public/ files: logo, icons, manifest
  return 'bypass';
}

/** Same-origin paths from a sitemap.xml body (other hosts and admin paths are dropped). */
function sitemapPaths(xml, origin) {
  const out = new Set();
  for (const m of String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try {
      const u = new URL(m[1].replace(/&amp;/g, '&'));
      if (u.origin === origin && !startsWithAny(u.pathname, NO_STORE)) out.add(u.pathname);
    } catch {
      // ignore malformed entries
    }
  }
  return [...out];
}

/** Only a complete, same-origin HTML 200 is worth saving as a page. */
function isCacheablePage(res) {
  return !!res && res.status === 200 && res.type === 'basic' && !res.redirected && (res.headers.get('content-type') || '').includes('text/html');
}

const pageKey = (url) => {
  const u = new URL(url);
  return u.origin + (u.pathname.replace(/\/+$/, '') || '/'); // one copy per page, query strings ignored
};

self.__pwa = { strategyFor, sitemapPaths, isCacheablePage, pageKey, VERSION };

async function trim(cacheName) {
  const max = LIMITS[cacheName];
  if (!max) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(req);
}

async function putPage(url, res) {
  if (!isCacheablePage(res)) return;
  const cache = await caches.open(PAGES);
  await cache.put(pageKey(url), res);
  await trim(PAGES);
}

const saveData = () => !!(self.navigator && self.navigator.connection && self.navigator.connection.saveData);

async function precacheAssets() {
  if (saveData()) return; // Data Saver on: assets get cached as pages are visited instead
  try {
    const res = await fetch('/sw-assets.json', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    const urls = Array.isArray(list) ? list.filter((p) => typeof p === 'string' && p.startsWith('/_astro/')) : [];
    const cache = await caches.open(ASSETS);
    const have = new Set((await cache.keys()).map((r) => new URL(r.url).pathname));
    await Promise.all(urls.filter((p) => !have.has(p)).map((p) => cache.add(p).catch(() => {})));
  } catch {
    // best effort: missing assets are cached on first use
  }
}

/** Saves every trip page from the sitemap so the whole itinerary reads offline, not just visited pages. */
async function warmPages(force) {
  if (saveData()) return;
  const meta = await caches.open(SHELL);
  const last = await meta.match(WARM_KEY);
  const at = last ? Number(await last.text()) : 0;
  if (!force && Date.now() - at < WARM_EVERY_MS) return;
  await meta.put(WARM_KEY, new Response(String(Date.now())));
  try {
    const res = await fetch('/sitemap.xml', { cache: 'no-store' });
    if (!res.ok) return;
    const paths = sitemapPaths(await res.text(), self.location.origin);
    for (const p of paths) {
      try {
        await putPage(new URL(p, self.location.origin).href, await fetch(p, { credentials: 'same-origin' }));
      } catch {
        // offline mid-way: the rest is saved on the next warm
      }
    }
  } catch {
    // sitemap unreachable: try again next time
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(SHELL_URLS);
      await precacheAssets();
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (!KEEP.includes(name)) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'warm') event.waitUntil(warmPages(false));
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function pageResponse(event) {
  const { request } = event;
  const network = fetch(request);
  // Keep the saved copy fresh even when the slow network loses the race
  event.waitUntil(network.then((res) => putPage(request.url, res.clone())).catch(() => {}));
  try {
    return await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]);
  } catch {
    const saved = await caches.match(pageKey(request.url), { cacheName: PAGES });
    if (saved) return saved;
    try {
      return await network; // nothing saved: keep waiting for the network
    } catch {
      return (await caches.match(OFFLINE_URL, { cacheName: SHELL })) || Response.error();
    }
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (res) => {
      if (res.ok || res.type === 'opaque') {
        await cache.put(request, res.clone());
        await trim(cacheName);
      }
      return res;
    })
    .catch(() => cached || Response.error());
  event.waitUntil(network.then(() => {}));
  return cached || network;
}

async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, res.clone());
      await trim(cacheName);
    }
    return res;
  } catch {
    return (await caches.match(request, { cacheName })) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Signing out forgets every saved page, so the next person on this device can't read an editor's copy
  if (request.method === 'POST' && url.origin === self.location.origin && url.pathname === '/api/logout') {
    event.waitUntil(caches.delete(PAGES));
    return;
  }

  switch (strategyFor(request.method, request.url, self.location.origin, request.mode)) {
    case 'page':
      return event.respondWith(pageResponse(event));
    case 'asset':
      return event.respondWith(cacheFirst(request, ASSETS));
    case 'font':
    case 'static':
      return event.respondWith(staleWhileRevalidate(event, RUNTIME));
    case 'api':
      return event.respondWith(networkFirst(request, RUNTIME));
    default:
      return; // browser default (network)
  }
});
