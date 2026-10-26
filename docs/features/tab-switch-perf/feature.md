# Fix: tab switching delay (~1.3s) and 60fps background

**Status:** ✅ verified · **Branch:** `fix/tab-switch-perf`

## 1. 🧠 Brainstorm
**Problem:** tapping Overview / Itinerary / Tools took over 1s. Profiling showed two causes:
1. Each tab is a full page load that waited on 2–3 sequential Google Sheets calls (3s cache, `no-store` pages).
2. The season background (autumn, winter, spring, night) ran its particle animations in JavaScript every frame (several animations per element and `repeatDelay` force Motion's main-thread loop): 120 style recalcs per 2s competing with taps and scrolls.

| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. Client-side router / SPA tabs | Instant swaps | Big refactor, hydration cost, breaks SSR model | |
| B. Server SWR cache + prefetch + browser cache + compositor animations | Small diffs, keeps SSR, measurable | Sheet edits made outside the app show up within ~30s | ✅ |
| C. CDN cache (`s-maxage`) | Fastest | Pages differ per user (edit controls), so a CDN could serve an editor page to guests (A01) | ❌ |

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | SWR cache for trips + trip locations, generation guard on writes | ✅ |
| 2 | Guest `private, max-age=30` + `Vary: Cookie`; opt-in prefetch on sub-nav tabs | ✅ |
| 3 | Background animations on the compositor (`compositorFrames`, wrapper per motion, no `repeatDelay`) | ✅ |
| 4 (later) | View Transitions between tabs; lazy-hydrate below-the-fold islands | ⬜ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given a warm server, a tab click never waits on Google | e2e: Google calls 19 → 4 over 6 clicks |
| AC-2 | Given an app write, the next render shows it | unit (`cacheState(null)` = miss) + generation guard on `clearSheetsCache()` |
| AC-3 | Guests reuse the prefetched tab; editors' pages are never stored | unit `pageCacheControl`; e2e only 2 page requests |
| AC-4 | After sign-in the cached guest page isn't reused | e2e `Vary: Cookie`: cookie change → no cache hit |
| AC-5 | Idle background causes no main-thread work in any season | e2e: style recalcs 0 (night 6), WAAPI animations > 0 |

### OWASP
| Risk | Mitigation |
|---|---|
| A01 | Never `public`/`s-maxage`; editors `no-store`; `Vary: Cookie`; prefetch off for editors and never `prefetchAll` (`/api/auth/google` must not be fetched ahead) |
| A04 | Stale data is bounded (10 min) and refreshed in the background; Google errors keep the last good snapshot |
| A05/A08 | No new dependencies, hosts or CSP changes |

### Laws of UX
Doherty Threshold (tab response down from 1.3s toward 0.4s; prefetch before the tap); Jakob's Law (instant Back via browser cache); aesthetic-usability kept: same scenes, same motion.

## 5–6. 📏✅ Evidence (375px, 4x CPU slowdown, ~300ms per Google call)
| Metric | Before | After |
|---|---|---|
| Tab click → painted (median) | 1,320 ms | 416–438 ms |
| Back | 473 ms | 132–228 ms |
| Google calls (6 clicks) | 19 | 4 |
| Main-thread work per load | 732 ms | 512 ms |
| Idle style recalcs / 2s (autumn) | 120 | 0 |
| Day-tab switch (in page) | ~40 ms | ~38 ms (already fine) |

- [x] `npm run verify` green · [x] all 7 seasons render without errors (screenshots)
- [ ] Real-device check on the Vercel preview (headless Chromium can't measure GPU frame time)
