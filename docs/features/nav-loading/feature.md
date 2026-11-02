# Feature: loading state when switching tabs and pages

**Status:** ✅ verified locally · **Branch:** `feat/nav-loading`

## 1. 🧠 Brainstorm
**Problem:** every page is a full server render (MPA). After a tap, the old page sits unchanged until the next one arrives, so a slow Sheets read or a weak network reads as "nothing happened".

| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. Top loading bar + pressed link + skeleton for trip tabs (one small script) | Works with the SSR model, ~1 KB, no flicker on fast loads | Skeleton is generic, not per tab | ✅ |
| B. `<ClientRouter />` (view transitions, SPA-style) | Real per-page fallbacks, animated swaps | Re-runs every island/script, breaks the bfcache and SW assumptions; big refactor | ❌ |
| C. CSS cross-document view transitions only | Zero JS | No feedback while waiting, which is the actual problem | later |

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | `startsPageLoad()` (pure, tested): which clicks start a page load | ✅ |
| 2 | `NavProgress.astro`: top bar (Motion, compositor), pressed link, `<html data-nav>` states, bfcache + 15s reset | ✅ |
| 3 | `TabSkeleton.astro` under the trip header on trip-tab switches; other links dim the page | ✅ |
| 3b | Spinner pill naming the destination tab (`data-nav-label`) | ✅ |
| 4 (later) | Cross-document view transitions between tabs | ⬜ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | When a same-site page link is tapped, the link turns primary at once and `<html data-nav="pending">` is set | browser |
| AC-2 | Past 120ms a top bar grows (transform/opacity only); with reduced motion it shows still | browser (2 WAAPI animations on `#nav-progress`) |
| AC-3 | Past 400ms on a trip-tab switch (header tabs or bottom bar), the content under the trip header is replaced by the skeleton; the header and bottom bar stay | browser 375px + desktop |
| AC-4 | Past 400ms on any other link, the page dims and `#page-content` is `aria-busy` | browser |
| AC-7 | Past 400ms a spinner pill (`role=status`) shows "Loading <tab>…" at the top centre; the ring rotates via Motion (transform), still under reduced motion | browser 375px |
| AC-5 | New tab / modifier / middle clicks, other sites, `#anchors`, `/api/*`, files (`.ics`, `.xml`), `download` links and clicks an island already handled do nothing | unit `tests/navLoading.test.ts` |
| AC-6 | Back/Forward from bfcache shows the page clean; a stopped load gives the page back after 15s | `pageshow` handler + timer |

### OWASP
| Risk | Mitigation |
|---|---|
| A01/A10 | Client-only, reads no data, no new requests; `/api/auth/google` is excluded and nothing is prefetched |
| A08 | No new dependency or host (Motion is already bundled); no CSP change |

### Laws of UX
Doherty Threshold (feedback on the tap itself; bar and skeleton wait 120/400ms so prefetched loads don't flicker) · Jakob's Law (the familiar top loading bar) · Aesthetic-Usability (skeleton uses the same glass cards as the content).

## 5–6. 📏✅ Evidence
- [x] `npm run verify` green (86 tests, build OK)
- [x] 375px: tapping Analysis shows the bar, the highlighted tab and the skeleton; header and bottom bar stay; no horizontal scroll
- [x] 375px: "Loading Analysis…" pill with a spinning ring (4 WAAPI animations: bar ×2, pill fade, ring)
- [x] Desktop: header tab → skeleton; breadcrumb → page dims, no skeleton; `.ics` link ignored
- [ ] Real device on the Vercel preview (slow 3G throttle)
