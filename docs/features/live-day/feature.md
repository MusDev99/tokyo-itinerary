# Feature: Live day (check-ins + "running late")

Status: implemented on `feat/live-day` · Extends: [Today mode](../today-mode/feature.md) · Backlog item #1 in [docs/product/backlog.md](../../product/backlog.md)

## 1. 🧠 Brainstorm
| Option | Pros | Cons |
|---|---|---|
| **A. Device-only check-ins and delay on the Today card (chosen)** | Instant, offline, no sign-in, no backend | Not shared with companions (backlog #5 later) |
| B. Write check-ins to the sheet | Shared, audited | Needs editor sign-in mid-trip; network on the go |
| C. Free time input for the delay | Precise | Slower on a phone; more decisions (Hick) |

Decision: A with 3 delay presets (owner chose "Live day" 2026-10-31).

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Risk |
|---|---|---|---|
| 1 | `pickToday` takes a `LiveState`; `parseLive`, `itemKey`, `liveKey`, `formatMinutes` + tests | S | Item identity without row ids → `time|title` key |
| 2 | Today card: progress, ✓ Done, ⏭ Skip, +15/+30/+60, On time, Undo | S | Row fits at 375px |
| Later | Show check-ins on the trip timeline; share with companions (#5) | — | — |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Marking the current activity Done removes it from Now and advances progress | unit + browser |
| AC-2 | Skipping the next activity jumps to the following one | unit + browser |
| AC-3 | +N min pushes back every activity still left today; done/skipped keep their time; old time shown struck through | unit + browser |
| AC-4 | Every action can be undone for 5s | browser |
| AC-5 | State survives reload, is per device and per trip day, bad storage never crashes | unit (`parseLive`) + browser |
| AC-6 | When everything is checked in: "All done for today" + tomorrow | unit |
| AC-7 | 375px: 44px targets, no horizontal scroll, running-late chips on one row | browser |

**Data impact:** none on the sheet; `localStorage` key `live:<trip>:<date>` (delay ≤ 6h, ≤ 200 statuses).

### OWASP
| Risk | Mitigation |
|---|---|
| A03 | Stored values validated on read (`parseLive`); everything rendered as text |
| A04 | Bad or blocked storage falls back to an empty state |
| A01/A08/A10 | No endpoint, dependency, host or fetch added |

### Laws of UX
| Law | Applied |
|---|---|
| Fitts | 44px Done / Skip / delay chips beside what they act on |
| Hick | Three delay presets instead of a time input; Skip is the quiet third action |
| Goal-Gradient | "N of M done" bar |
| Doherty | Instant local updates; Undo toast |
| Forgiveness (error recovery) | 5s Undo on every action |

## 4. 🔨 Implementation
- [x] `utils/today.ts` live state; `TodayCard.tsx` actions; route covers what's left only

## 5. 📏 Verify
- [x] `npm run verify`
- [x] No new requests, dependencies or CSP hosts

## 6. ✅ Validation
| AC | Result |
|---|---|
| AC-1–4 | ✅ 375px preview Oct 18 10:30: Done → 1 of 9; Undo → 0 of 9; Skip → next Akatsuka; +30 → `01:30 PM 02:00 PM` |
| AC-5 | ✅ reload keeps 1 of 9 and +30; unit tests for bad JSON / clamping |
| AC-6 | ✅ unit |
| AC-7 | ✅ all controls 44px, scrollWidth 375, chips on one row (label above on phones, inline on desktop) |
| — | [ ] On a real trip day, on a phone |
