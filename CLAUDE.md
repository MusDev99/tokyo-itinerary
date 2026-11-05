# CLAUDE.md

Multi-country travel itinerary planner (Astro 7 SSR on Vercel + Preact + Tailwind 3 via PostCSS). Google Sheets is the single source of truth. See `GEMINI.md` and `README.md` for the full feature tour.

## Commands

```bash
npm run dev      # dev server (http://localhost:4321)
npm run build    # production build (use this to type/compile check)
npm run preview  # preview the build
npm test         # unit tests (node --test, Node 22+)
npm run verify   # tests + build (run before every commit)
npm run smoke -- <url>   # post-deploy auth/header checks
SHEETS_FIXTURE=1 npm run dev   # dev only: sample trips without Google credentials (`many` = 150 more)
node scripts/perf-check.mjs    # phone-class tab-switch / JS / scroll check against the dev server
```

## Architecture

- **Data**: `src/utils/googleSheets.ts` reads/writes the spreadsheet with a service account (needs **Editor** access to write). `src/utils/countries.ts` turns tabs into countries/states.
- **Performance**: Sheets reads use stale-while-revalidate (`src/utils/swr.ts`, 30s fresh / 10 min stale, background refresh). Every write must call `clearSheetsCache()`, which also bumps a generation counter so an older in-flight read can't re-cache stale rows. Public pages set `pageCacheControl(signedIn)` (`security.ts`): guests `private, max-age=30` (never `public`/CDN), editors `no-store`. Sub-nav tabs use opt-in `data-astro-prefetch` (no `prefetchAll`, because `/api/auth/google` must never be prefetched). Background animations must stay on the compositor: animate `transform`/`opacity` via `compositorFrames()` (`utils/motion.ts`), one wrapper element per motion, and no `repeatDelay` (fold pauses into keyframes).
- **Trips**: one worksheet tab = one trip (`src/utils/trips.ts`, pure and tested; `buildCountries()` in `countries.ts` builds countries FROM trips). A trip with a registry row in the hidden `_trips` tab (columns K:Q: `title, slug, country, stops, created_by, created_at, copied_from`) is a titled trip, possibly through several cities (rows may carry `city` / `country`; `stops` are cities with day ranges). Any other tab is an old-style trip: `Country - State` (slug `country-state`, `legacyTripSlug()`) or a plain country tab. **Slugs are stored, never derived from a title that can change**, and renaming a title never renames the tab. A country lists its trips (`country.states` are trips: `StateMetadata.slug` is the trip slug).
- **Routes**: Trip tabs (Overview | Analysis | Itinerary | Pocket, four at most) are defined once in `src/utils/tripTabs.ts` (header tabs on desktop, floating `TripBottomNav` dock below `lg`) and live at `/trips/<slug>/overview`, `/analysis`, `/trips/<slug>` (itinerary), `/pocket`, `/calendar.ics`. A country page `/[country]` lists the country's trips (a country that is one plain tab redirects to that trip) with `/[country]/itinerary` merging them. Old `/[country]/[state][/…]`, `/tools` and `/prepare` URLs 301 to the trip pages (the old calendar feed keeps serving). `pocket`, `tools`, `prepare`, `trips` are reserved names. Also `/add` (3-step `TripWizard`), `/api/itinerary` (POST/PATCH/DELETE; adds to an existing trip by `tab`), `/api/pocket`, `/api/sheets-sync`.
- **Tabs**: tab name `Country - State` (e.g. `Japan - Tokyo`) = a state of a country; a plain tab (e.g. `japan`) = a country with no states.
- **Routes**: a *trip* is a `Country - State` tab or a country without states. Trip tabs (Overview | Analysis | Itinerary | Pocket, four at most) are defined once in `src/utils/tripTabs.ts` (header tabs on desktop, floating `TripBottomNav` dock below `lg`): state trips `/[country]/[state]/overview`, `/analysis`, `/[country]/[state]` (itinerary), `/pocket`; plain countries `/[country]` (overview), `/[country]/analysis`, `/[country]/itinerary`, `/pocket`. The old `/tools` and `/prepare` URLs 301 to `/pocket`; `pocket`, `tools`, `prepare` are reserved trip names. A country split into states is a hub (`/[country]` + merged `/[country]/itinerary`); it gets the same floating dock with its two tabs (Overview, Itinerary). Also `/add` (3-step `TripWizard`), `/api/itinerary` (POST/PATCH/DELETE), `/api/pocket`, `/api/sheets-sync`.
- **Auth**: viewing is public; any write needs Google sign-in by an `active` user in the hidden `_users` tab (`GOOGLE_CLIENT_ID/SECRET` + `AUTH_SECRET`, signed cookie), enforced by `src/middleware.ts` which also sets `Astro.locals.user`; `/login`, `/api/auth/google[/callback]`, `/api/logout`. Core in `src/utils/auth.ts`, user table helpers in `src/utils/userTable.ts` + `users.ts` (dependency-free, unit-tested). Edits are logged to the hidden `_audit` tab. Edit controls render only when `Astro.locals.user` is set.
- **Writes** all go through `submitItinerary()` in `src/pages/api/itinerary.ts` (the seam for a future email-approval flow).
- **PWA / offline read**: `public/sw.js` (registered by `OfflineStatus.tsx`, production only) caches pages network-first, `/_astro/*` cache-first (list from `/sw-assets.json`, written by `scripts/pwa-assets.mjs`) and pre-saves the pages in `/sitemap.xml`. It never caches non-GET, `/api/*` (except the read-only `READ_APIS`), `/login` or `/add` (`NO_STORE`). A new signed-in or per-user screen must be added to `NO_STORE` (the `/pocket` page itself holds no private data and is pre-saved; bookings need a connection). Bump `VERSION` in `sw.js` when cache formats change. Strategy helpers are tested in `tests/sw.test.ts`.
- **Pocket**: per-trip bookings, docs and notes (flight, stay, doc, note) live in the hidden `_pocket` tab (`src/utils/pocket.ts`, pure and tested; storage helpers in `googleSheets.ts`), written only through `/api/pocket`, where **every verb, reads included, needs a signed-in editor** (`PROTECT_READS` in `middleware.ts`). Items load client-side after sign-in and must never be rendered into page HTML (the page is cached by the service worker). No file upload: items carry an https link. Flights/stays also show as read-only `DayBookings` cards on their itinerary day (matched by date via `itemsForDay`), not as sheet rows. `_trips` also holds the wizard's `start_date`/`end_date` (`getTripDates`), which limit where an edit can move an activity.
- **Add / edit a place**: one `ActivitySheet` (bottom sheet in a body portal, z-90: above header 50 and tab bar 40, below pickers 100) serves both `TripBuilder` (add) and `TimelineItem` (edit). Time and day title are optional; an unset time shows `--:--`. The reader (`normalizeSheetDate/Time` in `calendar.ts`) turns Number-formatted cells (`46357`, `0.375`) into ISO dates and HH:MM. Fixed overlays must be portaled: a `backdrop-filter` ancestor (glass cards) traps `position: fixed`. The same goes for dropdowns: row/card "⋯" menus use `PortalMenu.tsx` (portal + fixed, on the picker engine), never an absolutely positioned panel inside a card, where the next card's stacking context or `content-visibility` would cover or clip it.
- **Soft navigation**: `Layout.astro` mounts Astro's `ClientRouter` (off with `PUBLIC_SOFT_NAV=0`), so tab taps swap the body instead of reloading. Consequences to respect: bundled `<script>` code runs once, so page behaviour must run inside `onPageLoad()` (`utils/pageLoad.ts`); `SeasonBackground`, `OfflineStatus` and the `NavProgress` bar are `transition:persist` (and `[data-astro-transition-persist]` has `view-transition-name: none` so they don't paint over the page); the saved `data-theme` is carried across swaps in the head script; links and forms that must be real navigations (`/api/auth/google`, logout, downloads) carry `data-astro-reload`; after a write use `refreshPage()` / `goTo()` (`utils/refresh.ts`), never `location.reload()`. Editor pages stay `no-store`, so Back after sign-out can't show them. The service worker only sees full navigations; router fetches go to the network.
- **Performance rules**: below `lg`, `.glass-effect` is a solid translucent surface (a `backdrop-filter` over the animated background is the main scroll cost): only the header and the tab dock may blur, and nothing nested. Repeated cards use `.cv-card` (`content-visibility`). No `transition-all`. Heavy libraries (`jspdf`, `chart.js`) load by dynamic import. The background has three motion levels (`utils/motionLevel.ts`: Full / Lite / Off, default Lite on phones and weak devices) and pauses while `html[data-overlay]` is set: open sheets, dialogs and drawers with `lockOverlay()` (`utils/overlay.ts`), which also locks page scroll. Measure with `SHEETS_FIXTURE=1 npm run dev` and `node scripts/perf-check.mjs`.
- **Theme**: the season/weather picker (`ThemePicker.tsx`, `useTheme`) lives in the profile menu (`UserMenu.tsx`; guests get a theme button beside Sign in). There is no floating theme button.
- **Checklist** (a Pocket section): rules live in `src/utils/checklist.ts` (pure, tested). Item ids must stay stable (ticks are stored per device under `checklist:<tab>` in localStorage). Add country extras to `COUNTRY_EXTRAS`, keyword rules to `ACTIVITY_RULES`. No AI and no sheet writes in this phase.
- Sheet columns are defined once in `SHEET_HEADERS` / `COLUMN_ALIASES` (`googleSheets.ts`); rows have a uuid `id` column used for edit/delete.

## Conventions

- Mobile-first: every page must work at 375px with no horizontal scroll. Containers that use `mx-auto` need `w-full` (they sit in a flex column).
- Match existing component style (Tailwind utility classes).
- Reuse the shared building blocks before writing new ones: `FormField` (label + error), `PickerPopover` (field-style popovers), `useDismiss` (outside press / Escape), `prefersReducedMotion()` (`utils/motion.ts`).
- **UI/UX: follow the [Laws of UX](https://lawsofux.com/)** for every new or changed screen (e.g. Hick's Law: progressive disclosure; Miller's Law: chunk content; Fitts's Law: touch targets of at least 44px; Jakob's Law: familiar patterns; Doherty Threshold: feedback under 400ms). Note the law applied in a short code comment where it drives a decision.
- **Animation: use [Motion](https://motion.dev/)** (the `motion` package) for animations and transitions instead of ad-hoc CSS/JS animation libraries. Keep animations subtle and purposeful, and respect `prefers-reduced-motion`.
- Never commit secrets: `credentials/` and `.env` stay out of git.

## Security — OWASP Top 10 (2021), mandatory
| Risk | Rule in this repo |
|---|---|
| A01 Access control | Reading is public; anything that changes the sheet (`POST/PATCH/DELETE /api/itinerary`, `/api/place`, all of `/api/sheets-sync`, every `/api/pocket` call, `/add`) needs a signed-in, still-`active` user, enforced in `src/middleware.ts`. A **new write route must be added to `PROTECTED_API`/`PROTECTED_PAGES`**. Redirect targets go through `safeNext()` |
| A02 Crypto | Secrets only in env (`AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_*`). Sessions are HMAC-signed, `HttpOnly`, `SameSite=Lax`, `Secure` in prod. Never hand-roll other crypto |
| A03 Injection | Validate + trim on the server (`parseActivity`); text written to the sheet goes through `sheetText()` (formula injection); URLs read from the sheet through `safeHttpUrl()` / `youtubeEmbedUrl()`; no `set:html` / `dangerouslySetInnerHTML` |
| A04 Design | Fail closed: without `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `AUTH_SECRET` writes return 503 in every environment (the public site keeps working) |
| A05 Misconfiguration | Headers/CSP live in `src/utils/security.ts` (applied by the middleware; CSP is production-only). API errors go through `clientError()`: only `UserError` text reaches the browser |
| A06 Components | `npm audit --omit=dev` before each release; `npm audit fix`, never `--force` without a test pass |
| A07 Auth | OAuth Authorization Code + PKCE, `state` and `nonce` checked, ID-token signature/`iss`/`aud`/`exp` verified, Google `sub` bound to the user row on first login, throttle, one generic message. Do not add hints about which check failed |
| A08 Integrity | Commit the lockfile; no new third-party script/CDN/API host without adding it to the CSP in `security.ts` |
| A09 Logging | Log failures server-side; never log passwords, tokens or keys |
| A10 SSRF | Server code fetches fixed hosts only; client input is `encodeURIComponent`-ed or validated; never accept a caller-supplied spreadsheet id |

## Mobile-first & Laws of UX
Design for **375px first**, then scale up (thumb-reachable primary action, drawers full-width, tables collapse to cards below 768px, no horizontal scroll). Apply the Laws of UX listed under *UI / UX standard* to every new or changed screen and name the law in the PR/feature.md.

## Claude-native workflow (skills in `.claude/skills/`)
Start every feature, fix or refactor with `/dev-workflow` (brainstorm -> plan -> analysis -> implement -> verify -> validate -> git -> release).
| Skill | Use it when | Writes |
|---|---|---|
| `dev-workflow` | starting any change | gates + `docs/features/<slug>/feature.md` |
| `feature-checklist` | creating/validating a feature | `docs/features/<slug>/feature.md` (from `feature.md` template) |
| `code-review-checklist` | before every PR | `docs/reviews/<branch>.md` (from `code-review.md`) |
| `owasp-audit` | auth/endpoint/dependency/header change, pre-release | `docs/audits/<date>-audit.md` (from `audit.md`) |
| `release` | commit, PR, version, deploy, rollback | tag + release notes |

Gate commands: `npm run verify` (tests + build) · `npm test` · `npm run smoke -- <url>` (post-deploy auth/header checks). Never mark work done while a gate is red; report real output.

## Git workflow (required)

- **Never commit directly to `master`** (the default branch; it was `main` until 2026-10-28). Create a branch first. This is mandatory for every change, including agent/cloud sessions:
  - New feature → `feat/<feat-name>` (e.g. `feat/add-itinerary`)
  - Bug fix → `fix/<fix-name>` (e.g. `fix/mobile-overflow`)
  - Use short kebab-case names. `chore/<name>` and `docs/<name>` are only for changes with no feature or fix.
  - **Agent sessions:** an auto-generated session branch (e.g. `claude/*`, `ccr-*`) is never the branch to push or open a PR from. Create `feat/*` or `fix/*` from the latest `master` and push that instead.
- Commit only when asked. Keep commits focused, with a clear imperative message.
- Push the branch to `origin` and merge via pull request.
- Run `npm run verify` (tests + build) before committing and make sure it passes. Commit messages follow Conventional Commits (`feat(auth): ...`), matching the branch type.
- Releases, versioning and rollback: see the `release` skill.
- **Always update `CHANGELOG.md` before every commit**: add an entry at the top with the date and time (`date "+%Y-%m-%d %H:%M"`) and a short list of what changed.
- **Update `README.md` when needed** (new features, routes, env vars, scripts, sheet columns or project structure change) and include it in the same commit.
