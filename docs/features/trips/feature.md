# Trips with titles (multi-city, per year), copy and suggestions

Four PRs; this file tracks them.

| PR | Scope | Status |
|---|---|---|
| 1 | Dock on country view, glass dock, portal ⋯ menus | PR #40 |
| 2 | Trips read model: `city` column, `_trips` registry, `buildCountries` from trips, `/trips/<slug>` pages, legacy redirects | this branch |
| 3 | Create and edit trips: title, stops, city on each place, rename title | this branch (stacked on PR 2) |
| 4 | "Start from": copy a trip (whole or picked days) and suggestions mined from the sheet | next |

## Model (decided with the product owner)
- One tab per trip + a `city` on each row; title, stable slug, primary country and stops live in the `_trips` registry (K:Q). URLs `/trips/<slug>`.
- Old `Country - State` tabs are derived trips (`country-state`), so nothing has to be migrated; old links 301.
- Any signed-in editor may create, copy and edit; `created_by` is recorded; opening any trip stays public. No roles.

## PR 2 checks (dev fixture)
`/trips/airtravel-japan-2025` (Tokyo days 1-4, Osaka 5-7, badges), `/trips/fuji-weekend-2026`, `/japan` lists four trips, `/japan/tokyo[/pocket]` 301, `/korea` redirects to its trip, old and new calendar feeds 200, sitemap lists `/trips/...`.

## Known gaps in PR 2
- A trip is listed under one (primary) country.
- Titled trips can be read and added to, but not yet created, renamed or deleted from the UI (PR 3). Place per trip is still one (the first city's) for Pocket tools.
- `buildCountries` is exercised through the pure helpers (`tests/trips.test.ts`) and the browser, not a unit test, because `countries.ts` imports modules without file extensions.

## PR 3 notes
- `POST /api/trips` creates tab + registry row + dates + place (rollback with `deleteTrip` if a later step fails); `PATCH /api/trips` edits title / stops (slug and tab never change).
- Not yet in the UI: editing a trip's cities or dates after creation (the API accepts `stops`); delete works for every trip through the existing delete action.
- Wizard payload checked in a browser (intercepted request): title, country, first city, stops `[{Tokyo 3d},{Osaka 4d}]`, dates, place.
