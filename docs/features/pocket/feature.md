# Pocket tab

Workflow inspired by travel-planner "pocket" screens (type chooser, short form, "put it in"); no assets, copy or branding reused.

## Roadmap
| Phase | Status | Deliverable |
|---|---|---|
| 1 Data | done | `src/utils/pocket.ts` (pure, tested), `_pocket` helpers in `googleSheets.ts` |
| 2 API | done | `/api/pocket` GET/POST/PATCH/DELETE, protected for every verb |
| 3 Tab | done | `tripTabs` = Overview, Analysis, Itinerary, Pocket; `/tools` and `/prepare` redirect (301) |
| 4 UI | done | `PocketHome`, `PocketSheet` |
| 5 Itinerary | done | `DayBookings` on the day, read-only |
| 6 Polish | partly | See known gaps |

## Decisions
| Topic | Choice |
|---|---|
| Tabs | Pocket replaces Tools + Prepare (Miller: 4 tabs) |
| Storage | Hidden `_pocket` worksheet, written RAW (no formula evaluation) |
| Privacy | Signed-in editors only; items load client-side from the API, never in HTML |
| Files | None: sheet cells hold text. Attach an https link (Drive, Photos) |
| Itinerary | Cards merged on the client by date; no duplicate sheet rows |
| Offline | The `/pocket` page is cached (it holds no private data) so checklist and tools read offline; bookings need a connection (`/api` is never cached) |

## Laws of UX
| Law | Where |
|---|---|
| Hick | Bookings first, other sections collapsible; seat/gate/notes behind "More details" |
| Miller | 4 tabs, 4 type tiles |
| Fitts | Full-width primary button, 44px tiles/chips, bottom sheet on phones |
| Doherty | Optimistic to-do tick; sheet closes and list refreshes on save |
| Jakob | Familiar sheet + chooser pattern |

## OWASP
A01 every `/api/pocket` verb needs an active editor (middleware `PROTECT_READS`); trip tab must exist · A03 `parsePocketItem` caps/validates, https links only, no `set:html` · A04 503 without auth env · A09 audit stores kind + title only · A10 links are only rendered as `rel="noopener noreferrer"` anchors.
Anyone with edit access to the spreadsheet can read `_pocket`: do not store passport numbers.

## Known gaps
- No photo/PDF upload (needs a storage service and CSP change).
- No per-item "Only me" visibility (all editors see all items).
- Hub countries (several states) show no booking cards on the merged itinerary.
- Not exercised against a real spreadsheet yet (no credentials in the build environment).
