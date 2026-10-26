# Feature: PWA with offline read access

**Status:** ✅ verified
**Owner:** Mustaqeem · **Branch:** `feat/pwa-offline` · **Target version:** next minor

## 1. 🧠 Brainstorm
**Problem:** travellers open the itinerary on planes, in the subway and on roaming data. Today the site is SSR-only, so no signal means a blank page right when it's needed most.

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. `@vite-pwa/astro` (Workbox) | Battle-tested strategies | New deps (A06/A08); precache model fits static sites, not SSR pages on Vercel | M | |
| B. Hand-written `public/sw.js` + build asset list | No deps, small, testable, fits SSR (network-first pages) | We own the caching logic | M | ✅ |
| C. Manifest only (installable, no offline) | Trivial | Doesn't meet "offline read" | S | |

**Decision:** B. It needs no new packages and no CSP change, and every caching rule lives in one testable file.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk | Status |
|---|---|---|---|---|
| 1 | Manifest + icons + SW: network-first pages, cache-first `/_astro`, `/offline` fallback | M | Stale pages | ✅ |
| 2 | Pre-save every sitemap page + full client bundle (`/sw-assets.json`) | S | Data use | ✅ (skipped on Data Saver) |
| 3 | Offline pill + `/offline` saved-pages list | S | Low | ✅ |
| 4 (later) | Offline images (external `https:` photos), PDF fonts (jsdelivr, ~MBs), "last saved" time, install button | M | Storage quota | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given a production build, when the site loads, then the manifest and SW register and the app is installable | manual (Chromium e2e: manifest ok, SW controls page) |
| AC-2 | Given a page visited (or pre-saved from the sitemap), when offline and reloaded, then the saved copy renders with logo and islands | e2e: offline reload title + logo loaded |
| AC-3 | Given an unsaved page, when offline, then `/offline` shows the list of saved pages | e2e: h1 "You're offline", list = [Home] |
| AC-4 | Writes, `/api/*` (except read APIs), `/login`, `/add` are never cached | unit: `writes, auth and admin screens are never cached` |
| AC-5 | Signing out deletes saved pages | e2e: `pages-v1` deleted after POST `/api/logout` |
| AC-6 | Offline pill appears when offline, 44px, no overflow at 375px | e2e + screenshot |
| AC-7 | Sitemap pre-save only takes same-origin, non-admin paths | unit: `sitemap paths stay on our origin` |

### 3.2 Data impact
No sheet, tab or column changes. Browser Cache Storage only: `shell-v1`, `pages-v1` (max 80), `assets-v1`, `runtime-v1` (max 60). Rollback: bump `VERSION` or ship a no-op `sw.js` (old caches get deleted on activate).

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 Access control | ✅ | SW never caches non-GET or `/api/*` writes; `/login`, `/add`, `/api/auth/*` bypass (`NO_STORE`); sign-out deletes saved pages so an editor's copy (avatar/email) isn't left on a shared device. Residual: a session that expires without sign-out keeps its saved pages until the next sign-out/version bump |
| A03 Injection | ✅ | `/offline` builds the list with `textContent` (no HTML from cache keys); sitemap URLs filtered to our origin |
| A05 Misconfiguration | ✅ | No CSP change needed: `worker-src`/`manifest-src` fall back to `'self'` |
| A06 Components | ✅ | No new dependencies |
| A08 Integrity | ✅ | Only same-origin + Google Fonts cached; no new third-party host |
| A10 SSRF | ✅ | SW fetches same-origin sitemap paths only (other hosts dropped) |
| A02/A04/A07/A09 | — | Untouched (SW logs nothing sensitive) |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Jakob | Familiar "Offline" pill + native install prompt / Add to Home Screen |
| Fitts (>= 44px) | Pill is `h-11`, bottom-left thumb zone, clear of the theme switcher; saved-page links are `touch-target` |
| Doherty (< 400ms) | 3s network timeout → saved copy; cache-first hashed assets render instantly |
| Recognition over recall | `/offline` lists saved pages instead of a dead end |
| Hick | No new settings or toggles; offline works automatically |

### 3.5 Mobile-first (375px)
Pill sits at bottom-left above the safe area; no horizontal scroll (e2e check). `/offline` is a single-column card.

### 3.6 Out of scope
Offline edits/queued writes, external images, PDF export offline (needs jsdelivr fonts), push notifications.

## 4. 🔨 Implementation checklist
- [x] Smallest diff; reused Layout/Header/Footer, Motion pattern from `UserMenu`
- [x] No new endpoints (`/offline` is a read-only page)
- [x] Empty (nothing saved), error (no Cache API) states on `/offline`
- [x] No `any`, `@ts-ignore`, secrets; one `console.error` for a failed SW registration (A09)

## 5. 📏 Verification gates
- [x] **Performance**: no new runtime JS on pages beyond a ~1 kB island; pre-download ~1.3 MB raw once, skipped on Data Saver
- [x] **SEO**: `/offline` is `noindex` and not in the sitemap
- [x] **Quality**: `npm run verify` green (23 tests)
- [x] **Constraints**: CLAUDE.md updated (`NO_STORE` rule for new per-user screens)

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-1 | Chromium on the local Vercel output: manifest fetch ok, SW controls page, 36 assets precached | ✅ |
| AC-2 | Offline reload renders "PlanTravel – Your Trips", logo loaded | ✅ |
| AC-3 | `/japan/never-saved` offline → "You're offline", list [Home] | ✅ |
| AC-4/7 | `tests/sw.test.ts` | ✅ |
| AC-5 | `pages-v1` deleted after sign-out POST | ✅ |
| AC-6 | Screenshot 375px, `scrollWidth <= innerWidth` | ✅ |

- [x] Unit tests added and passing
- [ ] Re-check sitemap pre-save on the Vercel preview with real sheet data (local run had no Sheets credentials)

## 7. 🌿 Git & 🚀 release
- [x] Conventional Commit; CHANGELOG + README + CLAUDE.md updated
- [ ] Preview deploy: install from Chrome Android, airplane mode, open trips
