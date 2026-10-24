# Feature: Calendar date picker

Status: implemented on `feat/calendar-picker` · Replaces: native `<input type="date">` in the add/edit forms

## 1. Brainstorm
| Option | Pros | Cons |
|---|---|---|
| **A. Custom `CalendarPicker.tsx` (chosen)** | Matches `AnalogTimePicker`; no new dependency; full control of 44px targets and keyboard grid | ~250 lines to own |
| B. Date-picker library via `preact/compat` | Mature a11y | Bundle size, theming, compat layer |
| C. Restyle the native input | Tiny diff | Inconsistent per OS, can't match the time picker |

Decision (owner confirmed 2026-10-25): A, applied to both date fields.

## 2. Plan
| Phase | Task | Effort | Risk |
|---|---|---|---|
| 1 | Pure helpers `src/utils/calendar.ts` + tests | S | Timezone shifts → all math in UTC |
| 2 | `CalendarPicker.tsx` (portal popover, Motion, roving focus) | M | Focus loss on month change |
| 3 | Swap into `AddItineraryForm` (day date) and `ActivityFields` (activity date) | S | Legacy non-ISO sheet dates |

## 3. Analysis
**Acceptance criteria**
- AC-1 Given an empty date field, when I tap it, a month grid opens on today's month with today ringed and focused.
- AC-2 When I tap a day, the field shows it (e.g. "Wed, 2 Dec 2026"), the form value is `YYYY-MM-DD`, and the popover closes.
- AC-3 Keyboard: arrows (day/week), Home/End (week), PageUp/PageDown (month, Shift = year), Enter/Space select, Escape closes without changing the value; focus returns to the field.
- AC-4 A legacy sheet value like "October 17, 2026" opens on that date and is unchanged unless a new date is picked.
- AC-5 With `min`/`max`, days outside are disabled and month buttons can't leave the range.
- AC-6 At 375px: no horizontal scroll, day targets ≥ 44px, popover inside the viewport.
- AC-7 `prefers-reduced-motion` skips the entrance and month-slide animations.

**Data impact:** none. Same `YYYY-MM-DD` string as the native input; the server still validates with `parseActivity`.

**OWASP**
| Risk | Relevance | Mitigation |
|---|---|---|
| A03 Injection | Client-only control; value goes to the existing API | Server validation (`parseActivity`) and `sheetText()` unchanged; no `set:html` |
| A08 Integrity | No new dependency, script or host | Uses existing `motion` + `preact` |

**Laws of UX**
| Law | Where |
|---|---|
| Fitts's Law | 44px day cells, nav and footer buttons |
| Hick's Law | One month at a time; tap commits (no extra OK step) |
| Jakob's Law | Sunday-first grid, familiar month header with ‹ › |
| Doherty Threshold | 180ms month slide, instant selection |

## 4. Implementation
- [x] `src/utils/calendar.ts`
- [x] `src/components/CalendarPicker.tsx`
- [x] `AddItineraryForm.tsx` day date
- [x] `ActivityFields.tsx` activity date (used by add + edit panels)
- [x] README structure, CHANGELOG
- [x] Refactor: shared `PickerPopover`, `useDismiss`, `FormField`, `prefersReducedMotion()`, `dateForKey`, `anchorPosition` (re-validated: both pickers select / outside press / Escape / OK / Cancel at 375px, light + dark)

## 5. Verify
- [x] `npm run verify` green
- [x] No new dependencies; Motion already bundled
- [x] No `any`, `@ts-ignore`, `console.log`
- [ ] Lighthouse: waived (no route or asset changes; component only renders on admin pages)

## 6. Validation
| AC | How | Result |
|---|---|---|
| AC-1 | Browser 375px: open empty field | ✅ Oct 2026, 25 ringed + focused |
| AC-2 | Desktop: next month, click 14 | ✅ `2027-01-14`, closed |
| AC-3 | Browser: → ↓ PageDown End Enter sent with no pauses | ✅ `2026-12-05`, focus back on field; Escape keeps value |
| AC-4 | Value "October 17, 2026" | ✅ shows "Sat, 17 Oct 2026", 17 selected, value unchanged |
| AC-5 | `min=2026-10-10` | ✅ 13 days disabled, previous-month disabled |
| AC-6 | 375px | ✅ scrollWidth 375, cell 43.7px wide × 44px tall, popover right edge 348 |
| AC-7 | Code path guarded by `matchMedia` | ✅ review |
| helpers | `tests/calendar.test.ts` (UTC+8, UTC+14, UTC−7) + `tests/popover.test.ts` | ✅ 15/15 |
