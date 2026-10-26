# Feature: ambient background sound per theme

**Status:** ✅ verified · **Branch:** `feat/ambient-sound`

## 1. 🧠 Brainstorm
**Problem:** the theme only played a short chime on click; the owner wants the season/weather to be heard in the background.

| Option | Pros | Cons | Pick |
|---|---|---|---|
| A. Audio files (mp3 loops) | Realistic | MBs to download (roaming, offline cache), new asset pipeline | |
| B. Web Audio synthesis (filtered noise, oscillators, random events) | 0 bytes, no CSP change, works offline, tiny CPU | Stylised rather than recorded | ✅ |

## 2. 🗺️ Roadmap
| Phase | Task | Status |
|---|---|---|
| 1 | 7 scenes, start on first gesture, crossfade, mute, pause when hidden | ✅ |
| 2 (later) | Volume slider; keep sound across page navigations (Astro `ClientRouter` + `transition:persist`) | ⬜ |

## 3. 🔬 Analysis
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | Nothing plays before the first user gesture | e2e: no AudioContext before tap |
| AC-2 | After the first tap the current theme's soundscape loops | e2e: running, level > 0 |
| AC-3 | Picking a theme crossfades to its scene | e2e: rain/night levels |
| AC-4 | Sound off fades to silence; on resumes; choice remembered | e2e + `readSoundOn` unit |
| AC-5 | Hidden tab suspends audio; visible resumes | e2e: suspended / running |
| AC-6 | Every theme has a quiet continuous layer, comfortable frequencies | unit `every theme has a quiet, continuous ambient scene` |

**OWASP:** no new endpoints, hosts, storage beyond the existing `theme-sound` key; A05/A08 unchanged (no CSP change).

### Laws of UX
| Law | Applied |
|---|---|
| Jakob | Audio only after a gesture (no autoplay surprise); mute where the theme is chosen |
| Peak-End / Aesthetic-usability | Soft 1.5s fades in/out, quiet master level (no harsh starts) |
| Doherty | Theme change answers instantly with a crossfade |
| Tesler | Volume and mixing are tuned for the user; one on/off switch |

### Known limit
The site is multi-page: each navigation starts a new page, and browsers need a fresh tap before audio resumes. Phase 2 (persisting the island across navigations) would make it continuous.

## 6. ✅ Validation
| Check | Result |
|---|---|
| `npm run verify` | ✅ |
| Chromium: before tap silent, after tap running (RMS 0.011), rain 0.033, night 0.018, mute 0, hidden suspended, ~1ms main thread / 3s, no errors | ✅ |
| Real-device listen (phone speaker volume) | ⬜ on the Vercel preview |
