# Changelog

All notable changes to this project are recorded here, newest first.
Each entry has a date and time (Malaysia time, UTC+8) and a short description of what changed.

## 2026-11-07 05:54 — Fix: no "Google Sheet" wording for visitors, and the guest note is gone

- **Welcome page:** removed "Guests can read every trip. Signing in lets you add and edit; your name and email go to the Users sheet." (and its "Everyone can read every trip" variant). The chip "Synced to Google Sheets" now says "Saved automatically"; the line "keep it all in your Google Sheet" (page and search description) says "keep it all in one place"; step 1 no longer says every trip is open to read; step 2 says costs and times are "saved with the trip".
- **Other screens:** "We can't reach your trip sheet" is now "We can't load your trips right now" (hint: contact your administrator); the Pocket note says "Everyone who can edit trips can read this"; the suggestions picker says "trips already planned".
- Developer and operator documents still describe the spreadsheet as the data store; only visitor-facing text changed.

## 2026-11-07 05:39 — Feat: share a trip (WhatsApp) and a client page

- **Share button** on every trip (an icon in the trip header, a labelled button on the client page): **WhatsApp** (opens a chat with a ready message: bold trip title, cities, dates, days and the link), **More apps** (the phone's own share sheet, shown only where the browser has one) and **Copy link**. Dates read "1–7 Mar 2025".
- **Client page** `/trips/<slug>/share`: what you send a traveller. Clean and read-only (no editing controls, no tab bar, brand only), trip title and summary, days/places/cities, every day in time order with category, tappable map link, description and highlighted tips, plus Share, PDF and Add-to-calendar buttons. **Costs are hidden until the reader ticks "Show costs"** (works without JavaScript and prints as shown). Prints cleanly. `noindex`, so search engines skip it.
- **WhatsApp preview card:** pages can set a preview image (`Layout` `image`): the client page uses a new branded 1200x630 card (`public/og-share.png`) with the trip's summary as the description.
- The web page is built from the same model as the PDF, so numbers and order always match. Smoke test also checks the share page (served, noindex, preview image, no edit controls). Tests: `share.test.ts`.
- Honest limit: the page is **as public as every other trip page** (there is no per-trip privacy yet).

## 2026-11-07 05:34 — Fix: master did not build (major dependency bumps reverted)

- **The production build on `master` was broken.** Dependabot major bumps had been merged: **Tailwind 3 to 4** (needs a different PostCSS plugin and a rewritten config; the build failed with "use `@tailwindcss/postcss`"), plus Preact 10 to 11 and `@types/react` / `@types/react-dom` 18 to 19. Reverted those four to their previous ranges (Tailwind 3.4, Preact 10, React types 18); the minor and patch updates stay. Tests 203 pass, build OK, `npm audit --omit=dev` 0 vulnerabilities.
- **So it cannot happen again:** Dependabot no longer proposes major versions (they are manual migrations), and a new `Verify` workflow runs the tests and the production build on every pull request and on `master`.

## 2026-11-07 05:27 — Feat: a proper trip PDF

- **Redesigned, branded PDF.** Cover with the PlanTravel logo, trip title, cities, dates and four facts (days, places, cities, estimated cost); an **at-a-glance table** (day, date, city, highlights, places, cost); **what it costs** (total, and a bar breakdown by kind of spending); then every day as a **timeline** in time order: time, place, category, location as a tappable Google Maps link, cost, description and tips in a highlighted box. Running header and footer on every page with "Page X of Y" and a link back to the trip.
- **Fixed old problems:** the title and file name were hard-coded to "Tokyo 2025", the currency to JPY, costs from different currencies were added together, and an empty trip crashed it. Now it uses the trip's own title, cities and dates, shows each currency separately ("1,800 JPY + 30 MYR"), builds fine when empty, and downloads as `<trip-title>-itinerary.pdf`.
- **Japanese text works.** The old code fetched a font from a CDN but never registered it. Now a subset of Noto Sans JP (OFL, about 1.3 MB compressed, JIS X 0208) is served from our own origin and loaded only when the trip has Japanese/Chinese/Korean text; without it those characters are dropped instead of printing boxes. Emoji are removed for print.
- New `tripPdf.ts` (tested model) and `pdfRender.ts` (drawing, runs in Node too); the button uses the shared `Button` with a busy state and toasts. Tests: `tripPdf.test.ts`.

## 2026-11-07 05:16 — Chore: operations (health check, structured logs, runbook, dependencies)

- **`GET /api/health`** for uptime monitors: `ok` / `degraded` / `down` (503 only when the trip sheet cannot be read), answered from the warm cache so polling costs no Sheets quota. Anonymous callers get status and version only; `x-health-token` = `HEALTH_TOKEN` adds the individual checks and counters.
- **Structured logs:** one JSON line per event with the request id attached automatically; tokens, cookies, `Authorization`, private keys, JWTs and long key-like text are scrubbed (a JSON parse error that quotes part of the service-account key used to be logged as is). The middleware adds an `x-request-id` header to every response and logs only failures and requests over 3 s. The error page shows the id as a **Reference**.
- **Runbook** `docs/operations/runbook.md`: environments (separate staging sheet), env vars, onboarding and offboarding people, rotating each secret, monitoring, log events, incident table, rollback, restoring data, pre-launch checklist.
- **Dependencies:** `npm audit --omit=dev` is now **0 vulnerabilities** (patched `glob` and `minimatch` forced for the build-time `@vercel/nft` and `sucrase` chains, `@astrojs/vercel` 11.0.20); weekly **Dependabot** (grouped minor and patch updates).
- **Smoke test** also checks the request id, `/api/health`, `/api/suggestions`, and that `POST/PATCH /api/trips`, `/api/trips/copy` and `/api/pocket` are closed to guests.
- Tests: `ops.test.ts` (log scrubbing, request ids, health decisions).

## 2026-11-07 05:08 — Perf: scale (cheaper writes, bounded retries, row limit)

- **An edit no longer makes everybody re-read the whole sheet.** Adding, editing or deleting a place now re-reads just that trip's tab and patches the cache (4 Sheets requests, other tabs untouched), where before the cache was cleared and the next viewer waited for a full read of every trip (6+ requests at 100 trips). Verified against a fake Sheets API: 0 full reads after a write, other trips untouched, content correct.
- **Rate limits no longer hang pages.** Retries honour `Retry-After`, use jittered exponential waits and stop at a 10 second budget (they used to sleep 16 s, 32 s, 48 s: up to 96 s). A 429 closes a shared gate; while it is closed, readers serve the last good data with no Sheets calls. A cold start with Google throttling now answers in about 9 s with "can't reach your trip sheet" instead of hanging.
- **No more invisible rows.** The sheet is read up to row 2000; a save that would pass it is refused with "This trip has room for only N more places" instead of silently saving rows nobody can see (limit 1,999 places per trip).
- Counters (`sheetsStats`) for the coming health check. New `docs/architecture/scaling.md`: limits, quota math, signals for moving to a database and a phased Firestore migration plan.
- Tests: `scale.test.ts` (retry delays, gate, per-tab cache patch, row limit).

## 2026-11-07 04:34 — Feat: no more silent overwrites when two people edit

- **Edit conflicts are detected.** Before, the last save silently won. Now each place, Pocket item and trip's settings carries a short fingerprint of what you were looking at; if it changed meanwhile (another agent, or a direct edit in Google Sheets) the save is refused with **409** and you choose **Reload latest** or **Save mine anyway**. Deleting a place someone else changed asks "Delete it anyway?"; a Pocket tick or removal that clashes reloads the list with a message.
- Content-based (no new sheet column): `utils/revision.ts` + `liveRevision`; notes/images edited elsewhere do not count as a conflict.
- New `ConflictNotice` in the UI kit. Tests: `revision.test.ts`, and `conflicts.test.ts` proves the reader and the writer compute the same fingerprint (canonical and alias headers, serial dates, padded cells).

## 2026-11-06 12:30 — Release 0.3.0: titled multi-city trips, copy and suggestions, consistent UI

- **Release notes:** `docs/releases/v0.3.0.md`. Version bumped to 0.3.0 (minor: new features, backward compatible, no new env vars).
- Includes #40 to #44 (trips redesign: titled multi-city trips at `/trips/<slug>`, create/edit, copy a trip, suggestions, dock on country view) and #45 to #48 (UI tokens, UI kit, loading and Undo, edit-trip sheet, 500 page, tap targets).
- `npm audit --omit=dev`: 4 moderate findings in the build-time chain `@astrojs/vercel` > `@vercel/nft` > `glob` / `minimatch`; fix needs a breaking upgrade, deferred.
- Tag `v0.3.0` after merge (tag pushes are blocked from the cloud session: push it from your machine).

## 2026-11-06 12:15 — Feat: UX polish (edit trip, error and empty states, tap targets)

- **Edit a trip after creating it:** the pencil opens one sheet with the **title, dates and cities** (days per city, the last city takes the rest, live preview). `PATCH /api/trips` now accepts `dates`; changing them re-lays the existing cities on the new range. Places already in the itinerary are never moved or deleted. This closes the "no UI to edit cities/dates" gap.
- **Error page that cannot fail with the sheet:** new `500.astro` (no Header, no Sheets read) says what happened, that trips are safe, and offers **Try again** and **Go to home**. Home now tells "no trips yet" (with a button to plan the first one or sign in) apart from "we can't reach your trip sheet" (with Try again).
- **Empty states with one action:** an empty trip, and the empty Pocket sections, use the shared `EmptyState` (icon, one line, next step; guests get a Sign in button).
- **No more `alert()`:** a failed PDF export shows an error toast.
- **Tap targets:** footer links ("How it works", Built-with links) and the world-map pins now have at least 44px tap areas (measured at 375px across home, country, trip tabs, login).
- Tests: `partsFromStops` (cities back to rows, re-laid on a longer trip).

## 2026-11-06 11:55 — Feat: loading states and feedback

- **One loading placeholder, `.skeleton`** (opacity only, off with reduced motion) replaces the five ad-hoc `animate-pulse` blocks (tab skeleton, prayer times, chart, timeline photo, suggestions) and the unused `SkeletonLoader.tsx`. New `ListSkeleton` is shaped like a real list row, so content replaces it without a layout jump (Pocket and the wizard's suggestions use it).
- **Suggestions picker:** skeleton rows on first load; when you change search, city or type the list stays and dims (`aria-busy`) instead of blanking; errors use `InlineError`; request goes through `apiFetch` and cancels stale searches.
- **Undo instead of "can't be undone":** deleting a place or a Pocket item happens at once and a toast offers **Undo** for 6 seconds (it puts the same content back; it gets a new id / a new row at the end of the sheet, shown at the same day and time).
- **Saved confirmations:** place edit, trip created/copied/renamed/deleted now toast (the toast survives the page swap). The wizard subtitle no longer says "Three quick steps".

## 2026-11-06 11:41 — Chore: shared UI kit (Button, InlineError, EmptyState, toast, apiFetch)

- **One `Button`** (primary / soft / danger / ghost, 44px minimum, focus ring, `busy` spinner that blocks a second press) now drives Confirm dialog, Add/Edit place, Pocket sheet and the new-trip wizard buttons. At night the primary button uses dark ink (white on amber failed contrast).
- **One error box, `InlineError`** (announced to screen readers, optional **Retry**), replaces 8 hand-made error boxes; Pocket load and the prayer-times card now share it.
- **`apiFetch()`** replaces about 12 hand-rolled `fetch` + `try/catch` blocks: JSON in/out, 25s timeout, same messages for network/timeout/server errors, only the server's `error` text is shown, signed-out redirects to login. Unit-tested.
- **Toasts** (`toast.success/error/info`, optional Undo action, one `<Toaster>` above the tab dock): Pocket save/remove and saved location now confirm with a toast. `EmptyState` added for the next PRs.
- `tests/apiFetch.test.ts` covers the API helper and the toast store; CLAUDE.md documents the kit.

## 2026-11-06 11:34 — Chore: UI tokens (status colours, smallest text, radius rule)

- **Status colours are tokens:** `danger` / `success` / `warning` (plus `-strong` for text and `-solid` for filled buttons) defined once in `global.css` with a night variant, replacing about 100 raw `red-*`, `emerald-*`, `amber-*` classes across 40 files. Errors, successes and warnings now follow the theme and keep contrast at night.
- **One smallest text size:** `text-micro` (11px) replaces `text-[8px]`, `[9px]`, `[10px]`, `[11px]` (83 uses), so nothing is below 11px.
- **Radius rule** documented (cards `2xl`, controls `xl`, chips `full`); the 4 `rounded-md` became `rounded-lg`.
- `tests/uiTokens.test.ts` fails the build if raw status colours or sub-11px text come back. CLAUDE.md: removed a stale duplicate Routes/Tabs section left by the merge and added the UI-token rule.

## 2026-11-05 13:51 — Feat: copy a trip and start from suggestions

- **Start from, in the new-trip wizard:** ✍️ From scratch · 📋 Copy a trip · 💡 Suggestions. Copy and Suggestions have their own short flows (Trip → When → Review; Places → Where → When → Cities → Review).
- **Copy a trip:** search any trip, tick the days to copy (whole trip by default), choose a new start date. Dates shift by the same offset (gaps between days are kept), prices are optional, notes/images/video are never copied. `POST /api/trips/copy` creates the tab first, writes in chunks of 50, records `copied_from`, and removes the half-made trip if a step fails.
- **Suggestions:** `GET /api/suggestions` (public, read-only) ranks places already in the sheet by how many trips used them, with typical time, median price and category; filter by city and type, pick up to 60, and they are spread across the trip's days.
- `POST /api/trips` accepts optional `activities` (max 150, validated by the shared `parseActivity`). New pure, tested helpers: `tripCopy.ts`, `suggestions.ts`, `parseActivity.ts`.

## 2026-11-05 14:05 — Feat: create and edit titled trips

- **New-trip wizard has four steps:** Where (a **trip title**, country, first city, pinned place) → When → **Cities** → Review. In Cities you add the cities the trip moves through and how many days in each (the first city keeps what is left): "Tokyo 3 Mar–5 Mar · Osaka 6 Mar–9 Mar". The trip is created as a titled trip (own tab, stable slug, stops, `created_by`) through the new `POST /api/trips`; a half-made trip is removed if a later step fails.
- **City on each place:** trips with two or more cities show a **City** row in the Add/Edit place sheet (picking a day picks that day's city); the city is saved in a new optional `city` column that is only added to a tab when first used.
- **Rename is a title change:** the pencil on a trip now edits its title only (`PATCH /api/trips`); the slug and worksheet tab never change, so shared links and Pocket keep working. An old `Country - State` trip gets its registry row on first edit and keeps its address.
- `/api/trips` is protected like every other write route (signed-in, active editor).

## 2026-11-05 13:55 — Feat: trips with titles (read side)

- **A trip is now its own thing, not a city.** One worksheet tab = one trip with a free **title**, a stable **slug** and optional **stops** (cities with day ranges), stored in a registry row of the hidden `_trips` tab (new columns K:Q). Rows may carry optional `city` / `country` columns, so one trip can run through several cities (days 1-4 Tokyo, days 5-7 Osaka) and a country can have several trips in different years ("AirTravel Sdn Bhd Trip at Japan 2025" and a separate "Fuji Weekend 2026" no longer merge).
- **New addresses:** `/trips/<slug>` with `/overview`, `/analysis`, `/pocket` and `/calendar.ics`. `/japan` now lists the country's trips (with their cities); days of a multi-city trip show a "📍 city" badge; the header shows the title and "Tokyo → Osaka · Japan".
- **Nothing breaks:** every existing `Country - State` tab is an automatic trip with slug `country-state`; old `/japan/tokyo[/…]`, `/tools` and `/prepare` links 301 to the new pages, a country that was a single plain tab opens that trip, and the old calendar feed keeps serving (calendar apps subscribe to it). Pocket, place, dates and checklist keep keying by the tab, so nothing is orphaned.
- Adding a place now names the trip's tab (`tab`), so it also works for titled trips. Nav, home, sitemap and the calendar feed read trips. Creating and editing titled trips, copy and suggestions come in the next PRs.
- Dev fixture gains the two Japan trips (multi-city and 2026) to check every screen locally.
## 2026-11-05 13:40 — Fix: country view dock, glass dock, ⋯ menus

- **Country view has the tab dock too:** a country split into cities now shows the floating bottom bar (Overview, Itinerary) on phones and tablets, like every trip; its header tabs stay for desktop.
- **A more transparent dock:** about half transparent with a strong blur, a bright edge and an inner highlight, readable text over the page, and a night-theme version.
- **⋯ menus are never hidden:** the Pocket row menu and the timeline "Actions" menu open in a portal above everything, so the next section can no longer cover "Delete" (the Pocket bug) and a card edge can no longer clip it.

## 2026-11-05 13:10 — Perf: a faster, calmer app (soft navigation, lighter paint, less clutter)

- **Tab taps no longer reload the page.** Soft navigation (Astro `ClientRouter`) keeps the header, tab dock and season background alive and swaps only the content. On a throttled Pixel 5 a tab switch went from about 1.1-1.9 s to about 0.3-0.5 s. `PUBLIC_SOFT_NAV=0` turns it off. Sign-in, sign-out and downloads stay real page loads.
- **Instant feedback and progress:** the loading bar finishes to 100% instead of stalling, tab switches show the trip skeleton at once, every 44px target presses in at once, edits/deletes/adds refresh the page in place (no white flash), Pocket saves and deletes appear immediately (and roll back on error), and creating a trip shows three named steps.
- **Smoother scrolling:** below 1024px cards are solid translucent surfaces instead of live blur (only the header and tab dock keep a blur), long lists skip off-screen cards (`content-visibility`), timeline items no longer re-render every 30 s, and `transition-all` is gone.
- **Motion: Full / Lite / Off** in the profile menu. Phones and weak devices default to Lite (a few slow particles, no blur or glow layers); animation pauses while a sheet, dialog or drawer is open; Off honours reduced motion live.
- **Less JavaScript up front:** chart.js (172 KB) loads with the Currency tab and jspdf (about 390 KB) when you ask for a PDF; background, offline pill, menus and back button hydrate when idle.
- **Faster server:** Pocket pages read the sheet in parallel, trip dates share one cached read, and the place suggestion is capped at 1.5 s and remembered.
- **Less clutter:** the trip header is one compact card (place, country, currency, one summary line; the three stat tiles only on Overview, no description or breadcrumb on phones); the itinerary opens on the day strip with search behind an icon and a flat day body; Add place floats above the dock on phones; Pocket loses its repeated heading, shows rows with a ⋯ menu; Analysis loses its wrapper card; Overview days are a list.
- **Dev tooling:** `SHEETS_FIXTURE=1 npm run dev` serves sample trips (`many` adds 150) without Google credentials, and `node scripts/perf-check.mjs` measures tab switches, JS bytes and scroll frames on a throttled phone.

## 2026-11-05 12:35 — Release 0.1.1: time picker, new trip start, more activity types, 100+ destinations

- **Release notes:** `docs/releases/v0.1.1.md`. Version bumped to 0.1.1.

### Details

- **Time picker:** the hour hand's knob now sits on its number (it covered the "12"), AM/PM and hour/minute buttons are 44px, and the popover no longer jams to the top of a short phone screen over the field you are editing: when it fits neither below nor above it is centred with the page dimmed. A stray `0` / `0:00` from a blank number-formatted cell now reads as "no time" instead of 0:00 (a real `00:00` midnight is kept).
- **New trip starts clean:** the wizard always opens on "Where". An unfinished draft is offered ("Continue your unfinished trip? / Start fresh") instead of silently jumping to the Review step; drafts older than a week are dropped, a prefilled link ignores old drafts, and "Start over" is available on every step.
- **More activity types:** Nature, Culture, Nightlife, Wellness and Adventure join the original six (11 in all), with their own colours in charts, filters and timelines. They match only after the original types, so existing trips keep their categories.
- **100+ destinations:** sheets are read in chunks of 25 tabs (4 at a time) so a large spreadsheet no longer exceeds the request size; the phone drawer, header ("More" menu) and home list have search, a short list with **Show all**, and A-Z sections; about 150 countries now get their flag and default currency automatically.

## 2026-11-04 20:10 — Release 0.1.0: trip wizard, Pocket and a leaner itinerary flow

One release of everything below (newest first), shipped as a single PR.

- **New:** 3-step trip wizard · Pocket tab (bookings, docs, notes, checklist, tools; replaces Tools + Prepare) · one lean sheet to add and edit a place · floating phone tab bar · theme picker inside the profile menu.
- **Fixed:** edit form could not read dates/times stored as numbers; edit date limited to trip days; `--:--` for no time; sheets trapped under the header on phones.
- **Data:** new hidden `_pocket` worksheet; `_trips` gains `start_date` / `end_date` (older sheets upgrade on first save). Backward compatible, no env changes.
- **Docs:** `CLAUDE.md` updated for the four tabs, Pocket, the shared activity sheet and the theme menu.
- **Release notes:** `docs/releases/v0.1.0.md`.
- **Rollback:** revert the merge commit; `_pocket` and the new `_trips` columns are ignored by older code.

## 2026-11-04 20:00 — Change: one lean sheet to add and edit a place

- **Editing an activity now opens the same bottom sheet as Add place** instead of a long inline form. Day chips (trip days only), place, time and type up front; location, price and notes under "More details" (opened automatically when the activity has them).
- **Leaner:** type is one scrolling row, the selected day and type scroll into view, actions stay pinned at the bottom, and Save stays off until something changes.
- Time shows `--:--` when unset and can be cleared with ✕. A new place only pre-fills a time when the day already has activities.

## 2026-11-04 19:40 — Fix: editing an activity (date, time, trip days)

- **Dates and times that came through as numbers** (a day showing "46357", a time showing "0.375", and an empty date in the edit form) are now read correctly. Cells formatted as Number in the sheet store dates as day counts and times as day fractions; they now become real dates and HH:MM, so the edit form is pre-filled.
- **Edit date is limited to the trip:** the date picker only allows days inside the trip (the dates saved by the wizard, else the span of the planned days), and the server rejects other dates.
- **No time set shows `--:--`** instead of a made-up 09:00. A time can be cleared again with "Clear time". Activities without a time sort after the timed ones; the PDF shows `--:--` too.
- The day header shows a readable date.
## 2026-11-04 19:25 — Change: theme picker moved into the profile menu

- The floating sun button is gone. The theme tiles (Seasons and Weather) now open from the **profile avatar** in the header, between your account details and Sign out.
- Guests have no profile, so they get a theme button (current season icon) beside **Sign in** in the same spot.
- The phone screen no longer has a floating button competing with the tab bar and sheets; the theme still applies instantly and is remembered on this device.

## 2026-11-04 19:15 — Feat: floating trip tab bar

- **Modern dock:** the phone tab bar is now a rounded, blurred bar floating above the screen edge, with line icons instead of emoji and a filled pill on the current tab (not colour alone). Taps press in slightly; reduced motion is respected.
- Badge (e.g. "1d") moved onto the icon corner; page padding and the floating buttons were re-spaced so nothing hides behind the dock.
- Night theme: dark text on the amber pill for readable contrast.

## 2026-11-04 19:05 — Fix: Add place and Pocket sheets on phones

- The sheets now render in a portal above the header and bottom tab bar. Before, the Add place sheet was trapped inside a glass card (the page's blur effect), so it floated mid-screen under the header with the page showing through, and its labels were centred.
- Dark backdrop, page scroll locked behind the sheet, and room for the phone's home bar.

## 2026-11-04 18:41 — Feat: Pocket tab

- **One Pocket tab replaces Tools + Prepare** (four trip tabs now). Sections: Bookings & docs, Notes, Checklist, Location & prayer times. Old `/tools` and `/prepare` links redirect.
- **"Put it in Pocket"** sheet for flights (route, times, seat, gate, terminal), stays (check-in/out, address), docs (visa, insurance, booking...) and notes/to-dos. Required fields first, the rest under "More details". Tickets are attached as a link (no upload).
- **Private by design:** items are stored in the hidden `_pocket` worksheet and served only by `/api/pocket`, which needs a signed-in editor for every call. Nothing private is in the page HTML, and the audit log keeps only type + title.
- **Itinerary link:** flights (departure, and arrival when it lands on a later day) and stays (check-in, check-out) appear as read-only cards on their day for signed-in editors, linking back to Pocket. They are not sheet rows, so budget, calendar and PDF are unchanged.
- Renaming a trip moves its Pocket rows; deleting a trip clears them. "pocket", "tools" and "prepare" are now reserved trip names.

## 2026-11-04 18:25 — Feat: trip wizard + day-first "Add place"

- **New `/add` wizard (Where → When → Review):** one decision per screen, a progress bar, a live day count, and a ticket-style review card. Dates are saved with the trip, and an unfinished draft is restored on this device.
- **Add place sheet** on every trip page (bottom sheet on phones): pick the day chip, type the place, optionally a time and type, with price and description behind "More details". It stays open for the next place, continuing from the previous time.
- **Lighter rules:** time and day title are now optional; the old 9-field form and inline panel are gone.
- **Data:** the hidden `_trips` worksheet gains `start_date` and `end_date` (older sheets are upgraded on first save, renames carry the dates). `POST /api/itinerary` accepts `dates` and an empty `activities` list to create a trip.
- Trip-name rules now live once in `src/utils/tripDraft.ts` (shared by browser and API, unit-tested).

## 2026-11-03 21:36 — Fix: Expenses tab on phones

- **No more sideways scroll / clipped amounts:** the expense rows sat in a grid cell that grew to fit long titles, pushing "MYR …" off the right edge. The list now uses a shrinkable column, titles wrap to two lines, and the amount never wraps or leaves the screen.
- **Filters:** search on its own row, category on a full row (its names are long), country and sort share the next one; every field is 44px tall with 16px text on phones (no iOS zoom-in).
- **Readability on dark themes:** category labels are mixed with the theme text colour so the blue "Transport & Transit" is legible at night.
- Analysis tab subtitle updated to match the new Overview.

## 2026-11-03 21:24 — Overview: slim interactive donut + daily history list

- **Donut redesigned:** a slim SVG ring with rounded, gradient slices, a soft shadow and gaps between slices (replaces the flat canvas doughnut). Tap or hover a slice, or a row in the list: the pick grows, the others dim and the centre shows that category (amount, share, items). Tap again to clear. Entrance animation is transform/opacity only and stays still for reduced motion.
- **Daily spending is now a history list** grouped by day, like a bank statement: a "Details / Amount" header, a bar per day (date + day total, tap to collapse), then rows with a round category icon, title, note, the amount in red and the time with the original-currency amount. Free activities and days without spend are left out.
- **Removed:** the "Biggest expenses" chart and the stacked daily bar chart (Chart.js is now used only by the currency tab).
- `src/utils/spendHistory.ts` (donut geometry, day grouping) with unit tests; new `SpendDonut.tsx` and `SpendHistory.tsx`.

## 2026-11-03 21:14 — Removed: season sound (Web Audio)

- The ambient soundscape and the **Sound on / off** switch in the theme panel are gone (it was not working reliably). Themes are visual only; nothing plays and no audio code ships.
- Deleted `src/utils/seasonSound.ts`, its test and the ambient-sound feature doc. A leftover `theme-sound` value in a browser's localStorage is simply ignored.

## 2026-11-03 21:11 — Feature: interactive world map

- **World map** on `/welcome` ("The world so far") and on the home page, above Destinations: one land shape plus a pin per country. Tap a pin to see that country (days, activities, **Open →**); a second tap goes in. Planned trips have a breathing pin, wishlist countries a quiet one.
- Phones pan the map sideways inside its own box so pins stay tappable; the chip list underneath is the 44px alternative and the way in for countries without a pin.
- **Light:** no map library or tiles. The land is `public/world-map.svg` (30 KB, one path, cached by the service worker) painted with a CSS mask, so it follows the season colours. The pulse is transform/opacity only and pauses off screen.
- Pin positions: `PIN_COORDS` in `src/utils/worldMap.ts` (keyed by country slug; add a line for a new country, otherwise it shows as a chip). Pure and tested (`tests/worldMap.test.ts`).
- `npm run` is not needed to use it; `node scripts/build-world-map.mjs` regenerates the SVG (dev dependencies `world-atlas`, `topojson-client`).

## 2026-11-03 21:06 — Feature: animated welcome landing

- **New `/welcome` page** for first-time visitors: a looping product story (ideas drop into Day 1–3, the budget grows, "Day 2 planned", a clock sweeps, "Synced to Google Sheets"), the pitch "Plan the trip. Live the day.", and two clear choices: **Continue with Google** or **Continue as guest**.
- **The world so far:** live trip, day and activity counts from the sheet (counting up) and a chip per destination, so a guest's first tap is a real trip.
- **How it works:** three tabs (Browse, Plan, Go) that play themselves until you touch them; arrow keys, Home and End work.
- **First visit only:** a guest with no cookie opening `/` is sent to `/welcome` once (`pt_welcome`, 1 year). Signed-in users, returning guests, search bots, link previews and prefetches are never redirected. Replay it from the footer ("How it works").
- **Light on rendering:** Motion with transform/opacity only (compositor), the story and tab autoplay pause off screen and in background tabs, the season background is not mounted on this page, reduced motion shows the finished scene with no animation.
- Google button only shows when sign-in is configured. `/welcome` is never cached by the service worker. Smoke test covers the welcome and the first-visit redirect.
- `shouldShowWelcome` / `worldTotals` in `src/utils/welcome.ts` with unit tests; `Layout` gets `seasonBackground`.

## 2026-11-02 19:14 — Feature: loading state between pages and tabs

- A thin top loading bar (Motion, compositor only) starts when you tap a link to another page; the tapped link highlights at once.
- Past 400ms a spinning pill at the top names what is loading ("Loading Analysis…"); the ring spins with Motion and stays still for reduced motion.
- Switching trip tabs (header tabs or bottom bar) swaps the old tab's content for a skeleton after 400ms; other links dim the page.
- New tabs, downloads (`.ics`), API routes and in-page anchors are ignored; Back/Forward restores a clean page.
- `startsPageLoad()` in `src/utils/navLoading.ts` with unit tests.

## 2026-11-02 12:58 — Fix: trip header responsive on desktop

- **Desktop / laptop:** the five trip tabs now sit in a row under the trip details instead of beside them, so the title, description and stats keep the full card width. At 1024px the title no longer wraps and the stats stay on one row; the header looks the same from 1024 to 1920px.
- **Tablets (640–1023px):** the header tabs were showing together with the bottom bar (`sm:flex` beat `max-lg:hidden`); now only the bottom bar shows below 1024px and only the header tabs from 1024px.

## 2026-11-02 12:52 — Trip tabs: bottom tab bar + Overview and Analysis pages

- **Bottom tab bar on trips (phones and tablets):** every trip page has a fixed bar with **Overview | Analysis | Itinerary | Tools | Prepare**, 64px thumb-zone targets, safe-area aware. Desktop keeps the tabs in the trip header (now the same five). Home and country hubs (countries split into states) have no bar.
- **New Overview tab** (`/[country]/[state]/overview`; plain countries use `/[country]`): the Today card for this trip, day cards linking into the timeline, and PDF / calendar export. The itinerary keeps `/[country]/[state]`, so existing links still work.
- **New Analysis tab** (`/[country]/[state]/analysis`, `/[country]/analysis`): the budget & currency dashboard, open. It no longer sits collapsed under the trip itinerary.
- The theme button and offline pill move above the bar; the page gets bottom padding so the footer isn't hidden.
- One tab definition (`utils/tripTabs.ts`, tested) for the header and the bar; shared `DaysOverview`, `TripOverview`, `TripAnalysis` components and a `stateTrip()` helper. New pages are in the sitemap for offline reading.

## 2026-10-31 22:02 — Timeline in time order + today's activity highlighted

- **Fix:** a day's activities are now listed by time (9:30 before 22:00), not by sheet row order; unreadable times stay last in sheet order, and an activity dated the next day (red-eye) comes after the night before. Applies everywhere the itinerary is used (timeline, PDF, calendar feed, Today card).
- **Today's day on the timeline:** the activity that's on now gets a green ring, dot and **Now** badge and opens automatically; the following one is marked **Next**. Check-ins from the Today card show as **✓ Done** (dimmed) or **Skipped** (struck through), and the "running late" shift is respected. Refreshes every 30s, uses the phone's own clock.
- Dev `?today=` preview now lives in one helper (`components/deviceClock.ts`).

## 2026-10-31 15:15 — Branch policy and cleanup workflows

- **`branch-policy.yml`**: fails a PR whose branch name or title breaks [BRANCHING.md](https://github.com/MusDev99/agentic-coding-style/blob/main/BRANCHING.md).
- **`branch-cleanup.yml`**: deletes a PR's branch after it is merged (skips forks, `master`/`main`, stacked bases).
- README: new 🌿 Branches section.

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
