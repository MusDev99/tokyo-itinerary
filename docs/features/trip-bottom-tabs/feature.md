# Feature: Trip bottom tab bar (Overview | Analysis | Itinerary | Tools | Prepare)

Status: implemented on `feat/trip-bottom-tabs`

## 1. 🧠 Brainstorm (owner decisions 2026-11-02)
| Question | Options | Decision |
|---|---|---|
| Overview for a trip | New trip summary page · drop it (4 tabs) | **New page** `/[country]/[state]/overview`; Itinerary keeps `/[country]/[state]` so `?day=N`, Today-card and calendar links keep working |
| Analysis | Own page · jump to the collapsible section | **Own page**; charts leave the itinerary page |
| Screens | Phones/tablets only · every size | **Below 1024px**; desktop keeps the header tabs |

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk |
|---|---|---|---|
| 1 | `utils/tripTabs.ts` (one definition) + tests | S | Hub vs trip rules |
| 2 | `TripBottomNav` via `CountrySubNav` (every trip page gets it) | S | Overlap with the theme button / offline pill / footer |
| 3 | Overview + Analysis pages; analytics moved off trip itinerary/overview | M | Plain countries vs hubs |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | On a trip page below 1024px a fixed bar shows Overview, Analysis, Itinerary, Tools, Prepare; the current one is marked | unit + browser |
| AC-2 | Home, a country hub and its merged itinerary have no bar | browser |
| AC-3 | Desktop: no bar, the header shows the same five tabs | browser 1024 / 1440 |
| AC-4 | Footer, theme button and offline pill stay clear of the bar | browser |
| AC-5 | Overview: Today card (on a trip day), 7 day cards → `?day=N`, PDF + calendar | browser |
| AC-6 | Analysis: dashboard open; `/[country]/analysis` on a hub redirects to the hub | browser |
| AC-7 | Trip without activities: only Overview and Tools | unit |

### OWASP
Read-only pages over the same public data; no endpoint, host or dependency. New pages are public like the other trip tabs (not in `NO_STORE`).

### Laws of UX
| Law | Applied |
|---|---|
| Jakob | Bottom tab bar like other travel/map apps; same tabs on every trip page |
| Fitts | 64px-tall full-width targets in the thumb zone |
| Miller | Five labelled tabs |
| Hick | One job per tab; analytics no longer stacked under the timeline |
| Serial Position | Overview: today first, then days, then exports |

## 6. ✅ Validation
| AC | Result |
|---|---|
| AC-1 | ✅ 375px `/japan/tokyo`: 5 tabs 75×64px, Itinerary current, header tabs hidden, scrollWidth 375 |
| AC-2 | ✅ `/`, `/japan`, `/japan/itinerary`, `/china`, `/indonesia`: no bar |
| AC-3 | ✅ 1024 / 1280 / 1440 / 1920: bar hidden; tabs in one row under the trip details; title 1 line, stats 1 row, same card height at every width |
| AC-8 | ✅ Handoff exactly at 1024: 640 / 768 / 1023 bar only, 1024+ header tabs only (never both) |
| AC-4 | ✅ body padding 64px; theme button 11px above the bar |
| AC-5 | ✅ 7 day cards → `/japan/tokyo?day=N`, PDF + calendar; Today card on Oct 18 preview |
| AC-6 | ✅ dashboard with Overview/Currency/Expenses + charts; `/japan/analysis` → `/japan` |
| AC-7 | ✅ unit |
| — | [ ] Plain country trip in the browser (no plain country in the current sheet) |
