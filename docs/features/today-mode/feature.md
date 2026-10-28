# Feature: "Today" mode

Status: implemented on `feat/today-mode` (stacked on `feat/calendar-export-maps-route`: reuses its route and time helpers)

## 1. 🧠 Brainstorm
| Option | Pros | Cons |
|---|---|---|
| **A. Today card on the home page + trip pages open on today's tab (chosen)** | Zero new routes; shows only when useful; one tap to directions | Card decides on the client (the server may be in another timezone) |
| B. Dedicated `/today` route | Bookmarkable | Another page to find; duplicates the timeline |
| C. Highlight "now" inside the timeline only | Small | Still several taps to reach it during the trip |

Decision: A (owner approved the feature 2026-10-28).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk |
|---|---|---|---|
| 1 | Pure `utils/today.ts` + tests (injected clock) | S | Ordering / unreadable times |
| 2 | `TodayCard` on `/`; server sends only trips within ±1 day of its date | S | Server UTC vs traveller timezone → client decides |
| 3 | `TabsNew` opens today's day (`?day=` still wins) | S | — |
| Later | "Now / Next" highlight inside the timeline; offline (PWA) card | — | — |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Given a trip day dated today (device clock), the home page shows Today · Day N, the day title and trip | unit + browser |
| AC-2 | The activity that started and is still in its slot (until the next one, ≤ 3h) is "Now"; the next one shows "in N min" | unit |
| AC-3 | Next activity has **Directions** (its own Maps link, else a search near the trip) and **Route** (whole day) | browser |
| AC-4 | Up to 3 later activities are listed (Miller's Law) | unit + browser |
| AC-5 | After the last activity starts: "That's everything planned for today" + link to tomorrow (if any) | unit + browser |
| AC-6 | No trip day today → no card and no empty gap | unit + browser |
| AC-7 | Trip pages open on today's day tab; `?day=N` still wins | browser |
| AC-8 | Updates every 30s and when the tab becomes visible | code review |

**Data impact:** none (read-only; the home page sends a slimmed copy of nearby trips only).

### OWASP
| Risk | Mitigation |
|---|---|
| A01 | Read-only; same public data as the trip pages |
| A03 | Rendered as text; Maps links are sheet URLs already filtered by `safeHttpUrl()` or built with `encodeURIComponent` |
| A05 | `?today=` clock override only in `import.meta.env.DEV` (stripped from production builds) |
| A08 | No new dependency or host |

### Laws of UX
| Law | Applied |
|---|---|
| Serial Position / Von Restorff | During a trip the card comes first, with a distinct green border |
| Fitts | 44px Directions / Route / Full day; side by side, full width on phones |
| Miller | Now, Next, 3 later: nothing more |
| Hick | Two actions only (Directions, Route) |
| Jakob | Trip pages open on today, like a calendar's "today" |
| Doherty | Instant client computation, no request |

## 4. 🔨 Implementation
- [x] `utils/today.ts` (`pickToday`, `todayIndex`, `localNow`, `formatUntil`)
- [x] `TodayCard.tsx`; home page wiring outside the spacing group
- [x] `TabsNew` opens today's tab
- [x] `formatTime12` moved to `utils/calendar.ts` (keeps the time picker out of the home bundle); `placeSearchUrl` + `RouteStop` in `utils/mapsRoute.ts`

## 5. 📏 Verify
- [x] `npm run verify`
- [x] No new Sheets reads (uses the cached `getAllCountriesWithSheets` already on the page)
- [x] Motion entrance respects reduced motion; no animation loop (30s timer only updates state)

## 6. ✅ Validation
| AC | Result |
|---|---|
| AC-1–5 | ✅ unit (8 tests) + 375px preview Oct 18 10:30 (Now Momiji-dani, Next 11:00 in 30 min, 3 later) and 23:45 (done + tomorrow Day 3) |
| AC-6 | ✅ real date Oct 28: no card, hero at 103px (no gap) |
| AC-7 | ✅ Oct 19 → Day 3; `&day=5` → Day 5; real date → Day 1 |
| AC-3 | ✅ links are 44px; Directions uses the activity's Maps link; Route through today's stops |
| — | [ ] On a real trip day, on a phone (production) |
