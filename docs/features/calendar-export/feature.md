# Feature: Add to calendar + day route in Google Maps

Status: implemented on `feat/calendar-export-maps-route`

## 1. 🧠 Brainstorm
| Option | Calendar | Pros | Cons |
|---|---|---|---|
| A | `.ics` built in the browser, download only | Offline, no server code | One-off copy: sheet edits never reach the calendar |
| **B (chosen)** | Public read-only `GET …/calendar.ics`, **Subscribe** (`webcal://`, Google `cid=`) + **Download** | Subscribed calendars refresh when the sheet changes; same file downloads | Small endpoint (same public data as the pages) |
| C | One Google Calendar link per activity | Simplest | 58 taps for Tokyo; Google only |

Route: the day header's "📍 N Stops" pill becomes **🗺️ Route** to Google Maps directions through the day's stops (plain Maps URL, no API key, no new host).
Decision: B + route link (owner confirmed 2026-10-28).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk |
|---|---|---|---|
| 1 | Pure `utils/ics.ts` + `utils/mapsRoute.ts` with tests | S | Timezones / DST → convert with `Intl`, tested across zones |
| 2 | `/[country]/[state]/calendar.ics` + `/[country]/calendar.ics` | S | Sheet reads → cached helpers only |
| 3 | `CalendarExport` menu beside the PDF button; route pill in `Timeline` | S | Header row width at 375px |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A trip feed has one VEVENT per activity with a readable time (`HH:MM`, `H:MM AM/PM`, `11.00 AM`) | unit + curl (Tokyo 58/58) |
| AC-2 | With a saved place (Tools tab) times are converted from its IANA zone to UTC; without one they are floating | unit (Tokyo, Makassar, New York DST) |
| AC-3 | An event lasts until the next activity that day (≤ 3h), else 1h | unit |
| AC-4 | UIDs are stable (row id, else a hash) so a subscribed calendar updates instead of duplicating | unit |
| AC-5 | Output is valid RFC 5545: CRLF, escaped TEXT, lines folded ≤ 75 octets without splitting UTF-8 | unit + structural check of the live feed |
| AC-6 | Unknown country/state → 404; `?download` → `attachment` | curl |
| AC-7 | "Add to calendar" offers Apple/Outlook (webcal), Google Calendar (subscribe) and Download; arrow keys move, Escape closes and refocuses | browser |
| AC-8 | Day header "🗺️ Route" opens Maps directions through the stops in order (dupes merged, ≤ 11 stops); fits 375px | unit + browser |

**Data impact:** read-only; no new sheet columns.

### OWASP
| Risk | Mitigation |
|---|---|
| A01 | Read-only GET of data that is already public on the trip pages; no write route added |
| A03 | Every TEXT value escaped (`escapeText`); feed filename built from slugs; Maps params via `URLSearchParams` |
| A05 | Generic 404 text; no internals in responses |
| A08 | No new dependency, script or fetched host (Google Maps / Calendar are plain links) |
| A10 | Server fetches nothing new; place lookup uses the existing cached `getPlace` |

### Laws of UX
| Law | Applied |
|---|---|
| Hick | One "Add to calendar" button, three labelled choices behind it |
| Von Restorff | PDF stays the single primary action; calendar is the outlined secondary |
| Proximity | Export actions side by side; route lives on the stop count it routes |
| Jakob | Familiar dropdown (opens downward) and a Maps hand-off |
| Fitts | 48px+ menu rows; route pill has a 48px hit area |

### Known limitation
Times are read in the trip's timezone. A departure from another city (e.g. the KUL flight on a Tokyo trip) shows an hour off; the sheet has no per-activity timezone.

## 4. 🔨 Implementation
- [x] `utils/ics.ts`, `utils/mapsRoute.ts`, `parseClockTime` moved to `utils/calendar.ts` (shared with the time picker; now also reads `11.00 AM`)
- [x] `utils/tripCalendar.ts` + both `calendar.ics.ts` routes
- [x] `CalendarExport.tsx`; `Timeline` route pill; `region` passed through `TabsNew`

## 5. 📏 Verify
- [x] `npm run verify`
- [x] Sheets reads through cached `getAllCountriesWithSheets` / `getPlace`; feed `Cache-Control: public, max-age=300`
- [x] No new dependencies / CSP hosts; components load `client:visible` like the PDF button
- [ ] Lighthouse: waived (no new page; two small islands)

## 6. ✅ Validation
| AC | Result |
|---|---|
| AC-1 | ✅ 58/58 Tokyo activities (after adding `11.00 AM`) |
| AC-2–5 | ✅ unit tests in UTC+8 / UTC−7 / UTC+14; live feed: CRLF, ≤ 75 octets, balanced, required props, unique UIDs |
| AC-6 | ✅ `/japan`, `/indonesia`, `/indonesia/bali`, `?download` attachment; `/nope`, `/japan/nope` 404 |
| AC-7 | ✅ 375 / 1440px: three 54px rows, correct hrefs, ArrowDown, Escape refocus, opens below on screen, buttons 52px aligned on desktop |
| AC-8 | ✅ 375px header row fits (328 ≤ 337px); origin keeps "Kuala Lumpur International Airport Terminal 2" unqualified |
| — | [ ] Subscribe from a real phone / Google Calendar on the deployed site (needs a public https URL) |
