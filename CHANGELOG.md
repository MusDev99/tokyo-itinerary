# Changelog

All notable changes to this project are recorded here, newest first.
Each entry has a date and time (Malaysia time, UTC+8) and a short description of what changed.

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
