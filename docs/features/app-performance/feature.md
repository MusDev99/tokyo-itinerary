# App performance, feedback and declutter

Measured on the dev server with `SHEETS_FIXTURE=1`, Pixel 5 emulation, CPU x4 (`node scripts/perf-check.mjs`):

| | Before | After |
|---|---|---|
| Tab tap → content (Itinerary / Pocket / Analysis / Overview) | 1653 / 1292 / 1850 / 1130 ms | 503 / 444 / 305 / 440 ms |
| JS transferred on first load (dev, unminified; compare only) | 24.2 MB | 8.7 MB |
| Production chunks | Analytics 198 KB, PDF 403 KB at page time | Analytics ~25 KB; chart.js 172 KB and jspdf 389 KB on demand |
| Document loads per tab switch | 1 | 0 |

## Roadmap (all done in one branch)
| Phase | Done |
|---|---|
| 0 Measure | Dev fixture, `perf-check.mjs` |
| 1 Server | Parallel Pocket reads, shared cached `_trips` rows, geocode timeout + cache |
| 2 Bundles | Lazy chart.js / jspdf, `client:idle` islands |
| 3 Paint | Solid cards below lg, no extra blurs, `content-visibility`, memoised timeline |
| 4 Background | Motion Full / Lite / Off, pause under overlays |
| 5 Soft navigation | `ClientRouter`, persisted background, themed swaps, finishing progress bar |
| 6 Feedback | Pressed states, optimistic Pocket, soft refresh after writes, wizard steps |
| 7 Declutter | Compact trip header, flat itinerary/Pocket/Overview/Analysis |

## Deviations from the plan
- Editor pages stay `private, no-store` (not `no-cache`): Back after sign-out must never show an editor page (A01); soft navigation does not need the HTTP cache.
- The service worker keeps network-first for full loads: router fetches bypass it, so stale-while-revalidate would only affect first loads and risk showing old itineraries.
- Not done: moving PDF / calendar exports into a ⋯ menu, a server-rendered skeleton for every island (the islands already render on the server; Pocket and the chart have skeletons).

## Laws of UX
Doherty (feedback < 400 ms: pressed states, skeleton at 50 ms, optimistic saves), Goal-Gradient (progress bars that finish), Hick (search behind an icon, ⋯ menus, Lite by default), Miller (4 tabs, chunks of ≤ 5), Law of Common Region (one surface per screen, rows with dividers), Fitts (floating Add place in thumb reach, 44px targets), Jakob (bottom dock, kebab menu, FAB).

## Known gaps
- Measured on a fixture, not a real sheet: please smoke-test the preview (soft navigation with sign-in, Pocket, the 100+ list).
- Desktop keeps the glass blur; only phones/tablets use the solid surfaces.
