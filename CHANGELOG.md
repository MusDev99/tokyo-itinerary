# Changelog

All notable changes to this project are recorded here, newest first.
Each entry has a date and time (Malaysia time, UTC+8) and a short description of what changed.

## 2026-10-31 22:02 — Timeline in time order + today's activity highlighted

- **Fix:** a day's activities are now listed by time (9:30 before 22:00), not by sheet row order; unreadable times stay last in sheet order, and an activity dated the next day (red-eye) comes after the night before. Applies everywhere the itinerary is used (timeline, PDF, calendar feed, Today card).
- **Today's day on the timeline:** the activity that's on now gets a green ring, dot and **Now** badge and opens automatically; the following one is marked **Next**. Check-ins from the Today card show as **✓ Done** (dimmed) or **Skipped** (struck through), and the "running late" shift is respected. Refreshes every 30s, uses the phone's own clock.
- Dev `?today=` preview now lives in one helper (`components/deviceClock.ts`).

## 2026-10-31 12:47 — Live day: check-ins and "running late"

- **Today card is now interactive:** ✓ Done on what's on now, ⏭ Skip on what's next, and a "N of M done" progress bar.
- **Running late?** +15 / +30 / +60 min pushes back everything still left today (old time struck through, new time shown); "On time" resets it. The route button now covers only what's left.
- **Undo** for 5 seconds after every action.
- Saved on this device per trip day (`localStorage`, parsed defensively), works offline, no sign-in or backend.
- Product backlog with the next ideas in `docs/product/backlog.md`. Tests: live-day cases in `tests/today.test.ts`.

## 2026-10-30 12:30 — Chore: shared code-review skill

- **Agents:** `.agents/skills/code-review/SKILL.md`, the same 7-area review checklist (intent, readability, tests, security, performance, style, docs) used in every repo, with findings by severity. `code-review-checklist` stays as the repo-specific layer.

## 2026-10-28 23:40 — Chore: default branch is now `master`

- **CI:** runs on pushes to `master` (it only listened to `main`, so merges to the renamed default branch skipped the tests and audit). Pull requests are unchanged.
- CLAUDE.md, the release skill and the code-review checklist now name `master` as the base branch.
## 2026-10-28 23:34 — "Today" mode

- **Home page:** during a trip, a **Today** card comes first: the day and trip, what's on **now**, the **next** activity with "in N min", **Directions** (its own Maps link) and today's **Route**, plus up to three later activities. After the last one: "That's everything planned for today" with a link to tomorrow. Uses the phone's own date and time and refreshes every 30s.
- **Trip pages** open on today's day tab during the trip (`?day=N` links still win).
- Dev only: `?today=2026-10-18T10:30` previews any date on the home and trip pages.
- Shared helpers: `formatTime12` moved to `utils/calendar.ts`, `placeSearchUrl` in `utils/mapsRoute.ts`. Tests: `tests/today.test.ts`.

## 2026-10-28 23:04 — Add to calendar + day route in Google Maps

- **Add to calendar:** next to "Download PDF Itinerary", a menu to subscribe to the trip in Apple / Outlook (`webcal://`) or Google Calendar, so it updates itself when the sheet changes, or to download a `.ics` file. New public read-only feeds `/[country]/[state]/calendar.ics` and `/[country]/calendar.ics` (whole country).
- Times use the trip's saved timezone (Tools tab), converted to UTC; without one they are floating local times. Each event runs until the next activity (max 3h, last one 1h); stable UIDs so subscribed calendars update instead of duplicating.
- **Day route:** the "📍 N Stops" pill in each day header is now **🗺️ Route**, opening Google Maps directions through the day's stops in order (duplicates merged, up to 11 stops). Short names are searched near the trip ("Senso-ji, Tokyo"); specific ones are left as they are.
- Sheet times written as `11.00 AM` are now understood (calendar export and time picker).
- No new dependencies or hosts. Tests: `tests/ics.test.ts`.
- Known limitation: a departure from another city shows in the trip's timezone (no per-activity timezone in the sheet).

## 2026-10-28 22:02 — Fix: responsive Prepare checklist and trip edit/delete placement

- **Prepare page, desktop:** uses the same width as the other trip tabs, so the trip header no longer squashes the title onto four lines or jumps when switching tabs. The checklist gets a sticky summary column (progress, "Do these soon", My items) beside the groups, two group columns from 1280px, and every group open.
- **Prepare page, phone/tablet:** the "N/M ready" count and progress bar stay pinned under the header while scrolling the long list; tablets show the groups in two columns; groups are separate cards from tablet up.
- **Edit / delete trip buttons:** now sit right after the trip name (they were floating mid-card on desktop) inside one quiet grouped control; on phones they stay top-right beside the title.
- New `useMediaQuery` hook.
- Laws of UX: Jakob (consistent tab width), Goal-Gradient (progress always visible), Proximity and Common Region (actions beside the title; grouped summary), Fitts (44px targets kept), Hick (collapsed groups on phones).

## 2026-10-28 21:27 — Prepare tab: smart trip checklist (phase 1, no AI)

- **Feature:** new **✅ Prepare** tab per trip (`/[country]/[state]/prepare`, `/[country]/prepare`) with a checklist built from the trip's own data: documents, money (trip currency + planned spend), phone & apps, packing (season + activity rules: onsen, temples/mosques, hikes, beaches, snow, theme parks, Shinkansen), prayer & food, and booking reminders for paid stays, tickets and transport (max 8). Japan extras: IC card, type A plugs, coin pouch, Visit Japan Web.
- **Timing:** items with a lead time count down to the first trip day ("Overdue", "3d left"); the 5 most urgent show on top in **Do these soon**.
- **Per device:** ticks and your own extra items are saved in this browser (no sign-in, works offline); the progress bar fills as you get ready (Motion, reduced-motion aware).
- **Offline:** the Prepare pages are in the sitemap, so the service worker saves them for offline reading.
- **Tests:** `tests/checklist.test.ts` (personalisation, stable ids, due dates, defensive storage parsing, progress).

## 2026-10-26 19:12 — Ambient background sound per theme (replaces the one-shot chime)

- **Feature:** each season/weather theme now has a looping soundscape instead of a short chime on click: 🍂 autumn wind + leaf rustles, ❄️ soft winter wind + glassy sparkles, 🌸 spring breeze + birds, ☀️ summer waves, 🌧️ rain + drops, 🌫️ hazy drone, 🌙 night crickets + pad.
- **How it plays:** starts on the first tap or key press (browsers block audio before a gesture), crossfades (1.5s) when you pick another theme, pauses while the tab is hidden, and the existing **Sound on/off** switch (remembered) fades it out or back in.
- **Light:** synthesised with Web Audio (noise + oscillators): no audio files, no new hosts, no CSP change; ~1ms main-thread per 3s while playing.
- **Tests:** `tests/seasonSound.test.ts` covers scene volumes and frequencies, noise generators and event spacing.

## 2026-10-26 11:55 — Fix: tab switching took ~1.3s; background animations on the main thread

Measured on a 375px phone profile with 4x CPU slowdown and ~300ms Google latency:

| Metric | Before | After |
|---|---|---|
| Tab click → next page painted (median) | 1,320 ms | 416 ms |
| Back button | 473 ms | 228 ms |
| Google API calls (warm-up + 6 tab clicks) | 19 | 4 |
| Main-thread work per page load | 732 ms | 512 ms |
| Idle style recalcs per 2s (autumn/winter/spring) | 120 | 0 |

- **Server cache:** Sheets reads (trips and trip locations) are stale-while-revalidate: fresh 30s, then served instantly for up to 10 min while one background read refreshes them (was a 3s cache, so almost every click waited on 2–3 sequential Google calls). Writes clear the cache, and a generation counter stops an older in-flight read from re-caching stale rows. Edits made directly in Google Sheets appear within ~30s; **Refresh from Google Sheets** still forces a live read.
- **Prefetch + browser cache:** the Overview / Itinerary / Tools tabs are prefetched when visible (guests). Guest pages are now `private, max-age=30` (was `no-store`), so the prefetched page is used on tap and Back is instant; editors keep `no-store`, and HTML pages send `Vary: Cookie` so a cached guest copy is never shown after signing in.
- **60fps background:** leaves, snow, petals and shooting stars were animated in JavaScript every frame (several animations per element, plus `repeatDelay`). They now run on the compositor via `compositorFrames()` (one wrapper per motion), and the blanket `will-change` on static shapes is gone.
- **CI:** `setup-node` now uses `check-latest: true`; the runner's cached Node 22.23.3 was below Astro 7's minimum (22.23.4), so the build step failed.
- **Tests:** `tests/perf-cache.test.ts` (cache timing, Cache-Control per role, transform folding).

## 2026-10-26 08:43 — Fix: `npm ci` failed (lockfile out of sync)

- **Fix:** `package-lock.json` was missing the optional `@emnapi/core` and `@emnapi/runtime` packages after the Astro 7 upgrade, so `npm ci` refused to install ("package.json and package-lock.json are not in sync"). Regenerated with `npm install`; no dependency versions changed and `npm audit --omit=dev` stays at 0.
## 2026-10-26 08:27 — PWA: install to home screen + offline read access

- **Installable:** `manifest.webmanifest`, 192/512 and maskable icons, an Apple touch icon and theme color, so Android and desktop offer *Install* and iOS can *Add to Home Screen*.
- **Offline reading:** the new `public/sw.js` service worker saves every trip page listed in `/sitemap.xml` (re-saved at most every 6h) plus the whole client bundle, so itineraries, timelines and analytics open with no signal. Pages are network-first with a 3s timeout (fresh data when online, saved copy on slow or no network). Currency and prayer-times API responses are kept for offline use.
- **Offline UX:** an "Offline · saved copy" pill (Motion, honors reduced motion) links to the new `/offline` page, which lists the pages saved on this device.
- **Safety:** writes, `/api/*`, `/login` and `/add` are never cached. Signing out deletes the saved pages (shared devices). Data Saver skips the pre-download. No new dependencies or CSP hosts.
- **Process:** branch rule tightened in `CLAUDE.md` and the `release` skill: features go on `feat/<feat-name>` and fixes on `fix/<fix-name>`, agent sessions included (no pushing from auto-generated session branches).
- **Build:** the `scripts/pwa-assets.mjs` integration writes `/sw-assets.json`. **Tests:** `tests/sw.test.ts` (caching strategy, sitemap parsing, cacheable responses).

## 2026-10-25 07:54 — Fix: dependency audit (Astro 7 upgrade)

- **Security:** `npm audit --omit=dev` goes from 7 high + 1 critical to **0**. Upgraded `astro` 5 → 7.4.2, `@astrojs/vercel` 8 → 11 and `@astrojs/preact` 4 → 6; pinned patched `path-to-regexp` 6.3.0 and `zod` 4.6.7 inside `@vercel/*` with same-major npm `overrides`.
- **Tailwind:** removed `@astrojs/tailwind` (Astro ≤ 5 only). Tailwind 3 now runs through the existing `postcss.config.mjs`, so no Tailwind 4 migration was needed; the built CSS has the same selectors.
- **Astro 7 compiler:** an HTML comment can no longer start a `? : (...)` branch; moved it inside the element on the country page.
- **CI:** the audit job is now blocking and fails on high or critical production advisories (it was advisory and critical-only).
- **Known:** 3 moderate advisories remain in dev-only build tooling (Tailwind 3's PostCSS deps); tracked in `docs/audits`.
- **Requires Node ≥ 22.23** (Astro 7); CI already uses Node 22.
## 2026-10-25 08:00 — Remove the unused Japanese dictionary component

- Deleted `src/components/JapaneseDictionary.tsx` (no page imported it).

## 2026-10-25 07:55 — Remove "Google Sheets" wording from the UI

- **Home:** removed the "Synced live from Google Sheets · N tabs" footer line (and the "Set GOOGLE_SHEET_ID" fallback).
- **Plain trip language instead of sheet/tab wording:** add page intro and new-trip hint, rename and delete-trip dialogs, delete-activity dialog, footer CTA, and the empty states on country, state and itinerary pages (no more raw tab names).
- **Error messages:** "Trip tab not found." → "Trip not found."; the last-tab delete error now reads "This is the only trip, so it can't be deleted."
- Code comments, internal names and the editors-only `/api/sheets-sync` diagnostics are unchanged.

## 2026-10-25 07:50 — Remove the rate cards from the Currency tab

- **Currency tab:** removed the "1 MYR equals" grid of rate cards. The converter and the rate history chart stay; the chart keeps its own currency selector, and picking a "To" currency in the converter still updates the chart.

## 2026-10-25 07:45 — Theme picker redesign + selection sound

- **Removed the quarter-circle wheel:** it covered page content and only showed names on hover. The floating button (bottom-right, same place) now opens a compact 304px panel just above it.
- **Grouped, labelled tiles:** Seasons (Autumn, Winter, Spring, Summer) and Weather (Rain, Haze, Starry Night) as 64px tiles with icon + name; the current theme is highlighted. The panel stays open after a pick so themes can be compared, and closes on outside tap, Escape or the button.
- **Sound:** each theme plays a short, quiet chime (leaves, bells, birdsong, arpeggio, raindrops, pad, night bell), synthesised with the Web Audio API, so there are no audio files and no CSP change. A "Sound on/off" switch in the panel is remembered (`theme-sound` in localStorage).
- **Keyboard:** focus starts on the current theme; arrows move across the grid, Home/End jump, Enter picks, Escape closes and returns focus.
- **Laws of UX:** Fitts (thumb zone, 64px tiles, 44px switch), Hick + Miller (two labelled groups instead of seven unlabelled icons), Jakob (familiar popover menu from a FAB), Doherty (theme and sound respond instantly).
- **Tests:** `tests/seasonSound.test.ts` (every theme has a chime under 1s in a comfortable range, grouping, default sound on).

## 2026-10-25 07:40 — Reusable picker, dismiss and form-field building blocks

- **Refactor (no behaviour change):** the date and time pickers now share `PickerPopover.tsx` (`usePickerPopover`, `PickerTrigger`, `PickerPopover`, `pickerButton`) for the trigger, placement, entrance animation and close handling. Placement math lives in `utils/popover.ts` (`anchorPosition`).
- **`useDismiss` hook:** one implementation of close-on-outside-press + Escape, used by both pickers, the user menu and the activity "⋯" menu.
- **`prefersReducedMotion()`** (`utils/motion.ts`) replaces 17 copies of the inline `matchMedia` check.
- **`FormField`:** shared label / required-or-optional / error layout, used by the activity fields and the add form (country, state, day date, day title).
- **Calendar:** keyboard moves are a pure, tested helper (`dateForKey`).
- **Small fixes picked up:** the time picker now fits screens narrower than 288px, and its Cancel button returns focus to the field.
- **Tests:** `tests/popover.test.ts` and keyboard navigation cases in `tests/calendar.test.ts` (32 tests total).

## 2026-10-25 07:25 — Calendar date picker

- **New `CalendarPicker`:** the Day date on `/add` and the Date field when editing an activity now open a month-grid calendar instead of the browser's native date input, styled like the analog time picker. Tap a day to pick it; Today and Cancel buttons; today is ringed, the selected day filled.
- **Keyboard:** arrows move by day/week, Home/End go to the start/end of the week, PageUp/PageDown change month (Shift for a year), Enter/Space pick the date, Escape closes it and focus goes back to the field.
- **Mobile:** 44px day targets, fits 375px with no horizontal scroll; opens above the field when there's no room below. Motion entrance and month slide, skipped for reduced motion.
- **Data unchanged:** still writes `YYYY-MM-DD`; legacy sheet dates such as "October 17, 2026" display correctly and are only rewritten if a new date is picked. Optional `min`/`max` bounds.
- **Tests:** `tests/calendar.test.ts` covers the date helpers (leap years, month clamping, grid layout, timezone safety).

## 2026-10-24 20:27 — Fix: sign out failed with "Cross-site POST form submissions are forbidden"

- **Fix:** on Vercel, Astro's built-in form-POST origin check rebuilt the request URL as `http://` while the browser's `Origin` was `https://`, so every sign-out was rejected. The built-in check is switched off (`security.checkOrigin: false` in `astro.config.mjs`) because CSRF is already enforced by our own `isSameOrigin()` (Sec-Fetch-Site, then the Origin host) in the middleware for every write API and in `/api/logout`. Cross-site requests are still refused with 403.

## 2026-10-24 19:24 — Fix: Google sign-in routes were never committed (404 in production)

- **Fix:** `src/pages/api/auth/google/` (`/api/auth/google` and `/api/auth/google/callback`) was silently excluded from git by a global ignore rule for any path named `google`, so production returned 404 and sign-in could not start. The files are now committed and `.gitignore` explicitly un-ignores that folder so the rule on any machine can't hide it again.

## 2026-10-24 18:42 — Google SSO for editing (replaces the shared password)

- **Breaking (deploy):** `EDITOR_PASSWORD` is gone. Editing now needs Google sign-in by a registered user; set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `SITE_URL` and `ADMIN_WHATSAPP` (see `.env.example`) and add editors to the hidden `_users` tab. Without them editing returns 503 in every environment (viewing is unaffected).
- **Public viewing unchanged:** guests see every itinerary but no edit controls; a "Sign in to edit" link appears instead.
- **Sign-in:** Google Authorization Code + PKCE with state, nonce and ID-token signature checks, no new dependencies. The first login links the Google id and stores the profile picture on the user row; a different Google account can't take over a registered email.
- **User table:** hidden `_users` worksheet (`google_id, email, name, picture_url, status, created_at, last_login`). Only `active` rows can edit; disabling a row revokes access within about a minute.
- **Not registered?** The login page shows an "Ask the admin on WhatsApp" button with a pre-filled request containing their email.
- **Audit trail:** hidden `_audit` worksheet records sign-ins and every create, update, delete, rename and location change with the editor's email.
- **UI:** avatar + sign-out menu in the header (Sign in button for guests), guest/editor-aware mobile drawer, footer CTA, home button, trip card, activity menus and Travel tools confirmation.
- **Setup script:** `npm run sheets:setup -- you@gmail.com` creates the hidden `_users` and `_audit` tabs (with headers) and registers the first editor, so the table no longer waits for a first sign-in attempt. Failures creating the tab are now logged.
- **Tests:** session, OAuth state, PKCE, ID-token claims and signature, user table, audit and WhatsApp link tests.

## 2026-10-24 18:03 — State labels in the daily schedule

- **Daily schedule:** on a country's combined itinerary (`/[country]/itinerary`) each day is labelled with its state or city (e.g. 📍 Bali, 📍 Jakarta) in the day tabs and the day header. Single-place pages are unchanged.

## 2026-10-24 15:51 — Collapsible schedule, back button, inline add activity

- **Daily schedule:** activities start collapsed showing only time and title; tap to open, plus an Expand / Collapse button next to the day's cost chip (state resets per day).
- **Back button:** universal icon button at the left of the header (hidden on the home page); uses browser history when the previous page is on this site, otherwise goes up one level.
- **Trip card:** rename and delete are icon-only buttons inside the main trip card (the separate action bar is gone).
- **Add new activity:** the labelled button on a trip page now opens the add form inline, fixed to that trip, instead of navigating to `/add`; the page refreshes after saving.
- **Footer:** "Built with" moved into the credits line (links to Astro, TypeScript, Tailwind CSS, Preact, Motion); back-to-top is an icon button clear of the season button.

## 2026-10-24 13:21 — SEO, CI, jspdf 4

- **SEO:** every page now has a meta description, canonical URL and Open Graph/Twitter tags (`<Layout description>`); new `/robots.txt` (hides `/add`, `/login`, `/api`) and `/sitemap.xml` built from the sheet.
- **CI:** GitHub Actions runs `npm run verify` on PRs and an advisory `npm audit`.
- **Dependencies:** `jspdf` 3 -> 4.2.1 (critical advisory). Astro 7 is blocked by `@astrojs/tailwind` (needs a Tailwind 4 migration); tracked in the audit.

## 2026-10-24 13:16 — Security: editor auth guard + OWASP hardening, AI dev workflow

- **Breaking (deploy):** editing now requires `EDITOR_PASSWORD` + `AUTH_SECRET` (see `.env.example`). Without them production writes return 503. Viewing stays public.
- **Auth:** `src/middleware.ts` guards `POST/PATCH/DELETE /api/itinerary`, `POST /api/place`, all of `/api/sheets-sync` and `/add`; new `/login` and `/api/logout`; signed `HttpOnly` cookie, same-origin check on writes, login throttle, open-redirect-safe `next`. The UI sends a signed-out editor to `/login` and back.
- **Hardening:** security headers (+ CSP in production), generic API errors, spreadsheet formula-injection guard, http(s)-only map/image links, YouTube-only embeds, `/api/sheets-sync` no longer accepts a caller-supplied spreadsheet id, `noindex` on admin pages.
- **Dependencies:** `npm audit fix` (32 -> 9 vulnerabilities; astro/jspdf/@astrojs/vercel majors tracked in `docs/audits/2026-10-24-audit.md`).
- **Repo:** added `.gitignore`, `tests/` (`npm test`), `npm run verify`, `npm run smoke`.
- **AI workflow:** `.claude/skills/` (dev-workflow, feature-checklist, code-review-checklist, owasp-audit, release) and `docs/` templates; CLAUDE.md now carries OWASP, Laws of UX, mobile-first and git/release rules.

## 2026-10-20 23:28 — Fix: analytics crash on page load

- **Fix:** the home and country pages logged "[object Object] is not a valid HTML tag name" because the new Chart.js charts were rendered on the server. Charts now render only in the browser (`ClientOnly` wrapper in `AnalyticsDashboard.tsx` and `CurrencyExchangeGraph.tsx`).

## 2026-10-20 23:26 — Simpler analytics, paginated expenses, dynamic currency hub

- **Analytics view:** simplified to three tabs (Overview, Currency, Expenses). Overview now has a total with per-day average, a doughnut with the total in the centre, a "biggest expenses" bar chart and a daily stacked bar chart split by category with an average line. Charts use `react-chartjs-2` and follow the current season colours.
- **Expenses:** pagination (10/25/50 rows, previous/next and compact page numbers), "Showing 1–10 of N", sort by trip order or highest cost, and a country filter on the global view.
- **Currency hub:** no hardcoded currency list. MYR and USD are always available; every other currency appears only when a country with an itinerary uses it. The home-currency picker, converter and rate chart all use this list, and currency names and symbols come from `Intl`.
- **Rate history chart:** now shows the period average line and how far today's rate is above or below it.

## 2026-10-20 23:26 — Dashboard redesign

- **Home page:** simplified to a "Your trips" hero with a single "New itinerary" button, one tappable card per country (dates, days, activities, cost, place chips) with an Upcoming / Happening now / Completed status, a collapsed "Spending & currency" section, wishlist chips and a quiet sync note.
- **Header:** the desktop country menu now starts at 1280px (it overflowed at 1024px); narrower screens use the mobile drawer.

## 2026-10-20 23:11 — Travel tools: prayer times

- **Travel tools tab:** new third tab beside Overview and Itinerary (`/[country]/[state]/tools`, or `/[country]/tools` for plain country tabs), also linked from the header menu and the mobile drawer.
- **Prayer times:** a card for every trip date (Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak) in the destination's local time, using the local calculation method per country (JAKIM, Kemenag, MUIS, Diyanet, … else Muslim World League), with today highlighted and an animated Qibla compass. Data from the free AlAdhan API via `GET /api/prayer-times`.
- **Legacy trips:** trips without a saved location show an auto-detected place marked "Not confirmed", with Confirm and "Wrong place?" actions.
- **Itinerary card:** redesigned the main trip card on mobile (flag + title row, full-width description, compact stat tiles with a date range).
- **Routing:** the state page moved to `[country]/[state]/index.astro`; `tools` is now a reserved slug.

## 2026-10-20 23:11 — Trip locations

- **Confirmed location:** new trips now pick the real place (searched via the free Open-Meteo geocoding API) in tab 1 of the add form; tab 2 stays locked until a location is chosen. Existing trips skip this step.
- **Place storage:** the chosen place (name, country code, lat/lng, timezone) is saved in a hidden `_trips` worksheet; renaming or deleting a trip updates it.
- **New APIs:** `GET /api/geocode?q=` (place search) and `POST /api/place` (confirm or change a trip's location).

## 2026-10-20 22:50 — Mobile polish, add-itinerary days, logo

- **Add itinerary (days):** tab 2 is now "Days & Activities". Each day needs a date and a day title before its activities unlock; activities are added per day, with "Add another day". Rows are saved with the day's date and `day_title`.
- **Mobile activity card:** time and price on one row, category as a small label, Edit/Delete moved into a "⋯" menu, tip as a light side-line, full-width 44px map and video buttons, tighter paddings.
- **Trip actions:** "Add activities" is the full-width primary button; Rename and Delete sit side by side below it (Delete is outlined red).
- **Mobile navigation:** new slide-in drawer (`MobileNav.tsx`) with collapsible country cards listing Overview, timelines and states, plus an "Add new itinerary" button; the ＋ button was removed from the header bar.
- **Branding:** new PlanTravel logo (`public/logo.svg`, pin + paper plane, 3 colours) used in the header; header text renamed to PlanTravel; glass header background.
- **PDF:** removed the hardcoded "One week exploration in Autumn" subtitle (now "N-day itinerary").
- **Docs:** added this changelog.

## 2026-10-20 22:17 — Seasons, add-itinerary flow, country/state

- **Seasons:** Motion-animated backgrounds for 7 seasons (autumn, winter, spring, a sunnier summer, rain, haze, starry night); wheel-style season picker; translucent glass cards; dark theme for starry night.
- **Footer:** redesigned with a call-to-action card, destination chips and Motion hover/scroll animations.
- **Add itinerary:** two-tab form (country & state, then activities) with an analog clock time picker; locked second tab until the trip is valid.
- **Edit / delete:** inline activity editing, trip rename and delete, and a confirmation modal before every delete.
- **Country → state:** worksheet tabs named `Country - State` (e.g. `Japan - Tokyo`) are grouped by country, with new `/[country]/[state]` pages.
- **Google Sheets write API:** `/api/itinerary` (create, append, edit, delete, rename) and write helpers; the service account now needs Editor access.
- **Docs:** added `CLAUDE.md` (project rules, git workflow, UI/UX and animation rules).

## 2026-10-17 22:47 — Mobile responsiveness

- Fixed horizontal overflow on the itinerary page (containers using `mx-auto` in a flex column now have `w-full`); 404 page header moved inside the layout.

## 2026-10-17 21:59 — Live Google Sheets

- Enabled the Vercel SSR adapter for live Google Sheets sync.

## 2026-10-17 20:48 — Multi-country redesign

- Redesigned the UI and refactored the planner to be dynamic per country, driven by Google Sheets tabs.
