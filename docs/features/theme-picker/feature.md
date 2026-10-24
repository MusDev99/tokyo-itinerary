# Feature: Theme picker redesign + selection sound

Status: implemented (working tree on `feat/calendar-picker`) · Replaces: quarter-circle season wheel in `ThemeSwitcher.tsx`

## 1. Brainstorm
| Option | Pros | Cons |
|---|---|---|
| **A. Compact panel above the FAB (chosen)** | Labels visible, grouped, small footprint, same on all sizes | One more surface style to keep consistent |
| B. Bottom sheet on mobile | Largest targets | Covers more of the page, needs a backdrop |
| C. Icon strip beside the FAB | Smallest | No labels; 7 icons in a row is tight at 375px |

Sound: on by default with a remembered mute switch (owner confirmed 2026-10-25).

## 3. Analysis
**Acceptance criteria**
- AC-1 Tapping the theme button opens a panel above it; no quarter-circle is drawn; nothing overflows at 375px.
- AC-2 The panel shows Seasons (4) and Weather (3) tiles with icons and names; the current theme is highlighted and focused.
- AC-3 Picking a tile applies the theme instantly, saves it, and plays that theme's chime when sound is on.
- AC-4 The Sound switch mutes/unmutes, is remembered, and plays the current chime when switched on.
- AC-5 Outside tap, Escape and the button close the panel; Escape returns focus to the button.
- AC-6 Arrow keys / Home / End move between tiles; Enter picks.
- AC-7 Reduced motion: no panel / tile / icon animation (sound unaffected).

**OWASP:** client-only; no new endpoint, host or script. Web Audio needs no CSP change (A05/A08 n/a).

**Laws of UX**
| Law | Decision |
|---|---|
| Fitts's Law | FAB stays in the bottom-right thumb zone; 64px tiles; 44px sound switch |
| Hick's Law | Visible labels instead of hover-only captions |
| Miller's Law | Two chunks: Seasons / Weather |
| Jakob's Law | Familiar FAB → popover menu |
| Doherty Threshold | Theme + chime respond immediately; panel stays open to compare |

## 6. Validation
| AC | How | Result |
|---|---|---|
| AC-1 | 375px home | ✅ panel 304px (51→355), scrollWidth 375 |
| AC-2 | Screenshot light + Starry Night | ✅ 7 tiles 65×64, current highlighted, focus on current |
| AC-3 | Click night/rain/spring/autumn with oscillator counter | ✅ 2/3/2/2 notes, `theme` saved, panel stays open |
| AC-4 | Toggle switch, click winter | ✅ 0 notes muted, `theme-sound=off`, switch back on |
| AC-5 | Escape / outside pointerdown | ✅ closed, focus on theme button |
| AC-6 | Autumn → ArrowRight → ArrowDown | ✅ Haze |
| AC-7 | Guarded by `prefersReducedMotion()` | ✅ review |
| unit | `tests/seasonSound.test.ts` | ✅ 3/3 |
