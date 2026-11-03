# Feature: animated welcome landing (first visit, guest or Google)

**Status:** ✅ verified locally (375px, reduced motion) · **Branch:** session branch (rename to `feat/welcome-landing` for the PR)
Inspired by the DevLog sign-in landing: a looping product story, one clear action, what is recorded said up front.

## 1. 🧠 Brainstorm
| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. `/welcome` page + one-time redirect from `/` (cookie) | Home stays the real overview; replayable from the footer; crawlers unaffected | One extra hop on the very first visit | ✅ |
| B. Overlay/modal on the home page | No redirect | Loads the whole home first; focus-trap and a11y cost | ❌ |
| C. Replace `/login` | Reuses a page | Guests never see it; wrong moment | ❌ |

Animation: Motion (repo rule) with `compositorFrames` so every loop is transform/opacity on the compositor; CSS keyframes (as in DevLog) are not used.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | `shouldShowWelcome` + `worldTotals` + steps (pure, tested) | ✅ |
| 2 | `/welcome`: 9s story, hero, Google + guest, world-so-far, how-it-works tabs | ✅ |
| 3 | `/` redirects first-time guests; footer "How it works" replay; SW `NO_STORE`; smoke checks | ✅ |
| 4 (later) | Interactive world map of destinations (one SVG, pins only, no tiles) | ⬜ |
| 5 (later) | Guided first-trip tour for new editors (3 coach marks on `/add`) | ⬜ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A guest with no `pt_welcome` cookie opens `/` → 302 to `/welcome`; opening `/welcome` sets the cookie (1 year, HttpOnly, Lax) | unit + curl |
| AC-2 | Signed-in people, returning guests, bots, prefetches and non-HTML requests are never redirected | `tests/welcome.test.ts` |
| AC-3 | "Continue as guest" opens `/`; "Continue with Google" starts the existing PKCE flow with `next=/`; without Google env vars only the guest button shows (fail closed, no hint) | browser |
| AC-4 | At 375px: no horizontal scroll, story first, actions right after the pitch, 44px targets | browser |
| AC-5 | Story loops only while on screen and the tab is visible; all animations are transform/opacity | browser (22 WAAPI, 0 non-compositor) |
| AC-6 | Reduced motion: 0 animations, finished scene, everything visible | browser |
| AC-7 | How-it-works tabs: arrow/Home/End keys, auto-play stops at the first touch | browser |
| AC-8 | A broken sheet hides "The world so far" but never blocks the page | code path (try/catch) |

### OWASP
A01 no new write route, no data read beyond what the public home already shows · A03 no `set:html`; sheet values only as text · A04 Google button hidden when not configured · A05 same CSP, no new host (the page reuses the Inter font already allowed) · A07 reuses `/api/auth/google`, `next` is a fixed `/`.

### Laws of UX
Von Restorff (one primary action) · Fitts (44px, thumb-zone actions, Skip in the corner) · Hick + Miller (3 steps, one open at a time) · Doherty (feedback under 400ms, count-up under 1.2s) · Aesthetic-Usability (the ad uses the product's own glass cards and season tokens) · Peak-End (closing call to action) · Jakob (tabs, familiar Google button).

## 5–6. 📏✅ Evidence
- [x] `npm run verify` green (93 tests, build OK)
- [x] 375px: story, hero, features, tabs, closing CTA render; `scrollWidth` = 375
- [x] Reduced motion: 0 running animations
- [ ] Real device on the Vercel preview with Google configured
