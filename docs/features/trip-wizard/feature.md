# Trip wizard + day-first builder

Inspired by the workflow of travel-planner apps (destination → dates → review → day tabs → add place); no assets, copy or branding reused.

## Roadmap
| Phase | Status | Deliverable |
|---|---|---|
| 1 Foundation | done | `tripDraft.ts` shared rules + tests, `_trips` start/end dates |
| 2 Wizard | done | `TripWizard.tsx` on `/add` |
| 3 Builder | done | `TripBuilder.tsx` Add place sheet on the state trip page |
| 4 Polish | partly | Draft autosave done; plain-country trips and day rename/delete still to do |

## Laws of UX applied
| Law | Where |
|---|---|
| Hick | One decision per wizard step; price/description behind "More details" |
| Miller | Days as chips, one day at a time |
| Fitts | Full-width bottom Back/Next, 44px chips, bottom sheet on phones |
| Doherty | Live day count; default time continues from the previous place |
| Jakob | Stepper, date pickers and bottom sheet follow common patterns |

## Security
Writes still go through `submitItinerary` (`POST /api/itinerary`, already in `PROTECTED_API`); dates validated server-side (ISO, max 60 days); text through the existing `parseActivity`/`sheetText` path; honeypot kept; no new host.

## Known gaps
- Add place sheet has no place search: `/api/geocode` is a city geocoder, not a POI search.
- Plain-country trips (`/[country]/itinerary`) have no Add place button yet.
- Day rename/delete and empty-day ("ideas") buckets are not built.
- Not yet exercised against a real spreadsheet (no credentials in the build environment).
