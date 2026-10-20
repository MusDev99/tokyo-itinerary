# Changelog

All notable changes to this project are recorded here, newest first.
Each entry has a date and time (Malaysia time, UTC+8) and a short description of what changed.

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
