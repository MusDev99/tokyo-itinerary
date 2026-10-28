# Feature: Prepare tab, smart trip checklist (AI assistant phase 1)

**Status:** ✅ verified · **Branch:** `feat/trip-checklist`

## 1. 🧠 Brainstorm
**Problem:** travellers prepare from memory; the itinerary already knows the dates, currency, season and activities, so it can tell them what to do and when.

| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. AI-generated list | Very personal | Needs an API key (none yet), cost, slow, can make things up | later |
| B. Rule-based from trip data | Free, instant, offline, predictable | Less personal | ✅ phase 1 |

Owner decisions (2026-10-28): ticks saved **per device**; AI later with a **daily limit** if a free API key is available; AI for everyone with cached results; start with phase 1.

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | Rule-based checklist, per-device ticks, due badges, custom items | ✅ |
| 2 | (optional) shared ticks via a hidden sheet tab | ⬜ |
| 3 | AI tips per day: free-tier key, daily cap, results cached in a hidden `_tips` tab | ⬜ needs key |
| 4 | AI day reordering (preview → Apply via `submitItinerary()`) | ⬜ |
| 5 | AI personal suggestions from travel-style chips | ⬜ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | A trip with dates/currency/season/activities gets a grouped, personalised list | unit `personalised from the trip data` |
| AC-2 | Ids are unique and stable, so ticks survive reloads | unit + e2e reload (1/33 kept) |
| AC-3 | Items with lead time show Overdue / Nd left; the 5 most urgent on top | unit `due status` + screenshot |
| AC-4 | Ticks and custom items persist on this device only; bad storage never crashes | unit `parsed defensively` + e2e |
| AC-5 | 375px: no horizontal scroll, rows ≥ 44px, keyboard Space ticks and keeps focus | e2e |
| AC-6 | Country with states redirects `/[country]/prepare` to the first state | curl 302 |

### OWASP
| Risk | Mitigation |
|---|---|
| A01 | Read-only page, no new endpoint, nothing written to the sheet |
| A03 | Trip text rendered as text (no HTML); custom items trimmed/capped (120 chars, 50 items) and only ever shown back to the same device |
| A04 | Storage parsed defensively (`parseSaved`), size-capped |
| A05/A08 | No new dependencies, hosts or CSP changes |

### Laws of UX
| Law | Applied |
|---|---|
| Miller | 6 labelled groups; only 5 urgent items on top |
| Hick | Groups collapse (first two open) |
| Goal-gradient | "N/M ready" + progress bar |
| Fitts | Whole row is the tap target (≥ 44px; 60px on mobile) |
| Serial position | Most urgent first |
| Jakob | Standard checkboxes, familiar to-do pattern |

### Out of scope
AI, shared ticks, notifications/reminders.

## 6. ✅ Validation
- [x] `npm run verify` green (53 tests)
- [x] Chromium 375px + 1280px: tick, add custom, reload keeps 1/33, keyboard Space keeps focus, no overflow, no errors
- [ ] Real trip data on the Vercel preview
