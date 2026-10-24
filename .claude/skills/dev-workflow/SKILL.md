---
name: dev-workflow
description: AI-driven development pipeline for this repo (brainstorm, plan, feature analysis, implement, verify, validate, git, release). Use at the START of any feature, fix or refactor, and whenever asked how to approach a change. Orchestrates feature-checklist, code-review-checklist, owasp-audit and release.
---
# 🧭 AI-driven development workflow — PlanTravel itinerary planner (Astro 5 SSR + Preact + Google Sheets)

Every change walks the 8 gates below. Do not skip a gate; leave the artifact. Stop and ask the owner at 🛑.
Keep chat output concise: tables, emoji status, roadmaps (owner preference).

| # | Gate | What you do | Artifact | Exit criteria |
|---|---|---|---|---|
| 1 | 🧠 Brainstorm | Frame the problem, list 2-4 options in a comparison table, recommend one | `feature.md` §1 | Decision + rationale written 🛑 owner confirms if scope/UX changes |
| 2 | 🗺️ Plan | Roadmap table: phases, tasks, effort, risk | `feature.md` §2 | Smallest shippable slice first |
| 3 | 🔬 Feature analysis | Acceptance criteria (Given/When/Then), data impact, OWASP threat table, Laws-of-UX table, 375px notes | `feature.md` §3 | Every AC has an ID; every relevant OWASP row has a mitigation |
| 4 | 🔨 Implement | Smallest diff that satisfies the ACs; reuse before adding; follow CLAUDE.md | code + `feature.md` §4 ticks | `npm run build` compiles |
| 5 | 📏 Verify | Performance, SEO, quality, constraints (see below) | `feature.md` §5 | All gates ticked or waived with a reason |
| 6 | ✅ Validate | Unit tests for new logic + walk the feature.md checklist in a real browser (375px and desktop) | `feature.md` §6 table | Every AC maps to a passing test or manual step |
| 7 | 🌿 Git | Branch, focused commits, CHANGELOG/README, PR | commits + PR body | `npm run verify` green before commit |
| 8 | 🚀 Release | Version bump, tag, deploy preview, smoke test, rollback plan | `release` skill | Smoke test green on the preview, then production |

## Gate 5 detail — verify
**Performance**
- Sheets reads are cached/deduped in `googleSheets.ts`; any new read must go through it (no per-request fan-out).
- Heavy libs (`chart.js`, `jspdf`, `html2canvas`) must stay client-only and lazily loaded; compare the `dist/client/_astro` chunk sizes in the build output before/after.
- Images: `loading="lazy"`, explicit width/height to avoid layout shift. Interaction budget: Doherty < 400ms.

**SEO / discoverability**
- Public pages need a unique `<title>` (<= 60 chars), meta description (<= 160), canonical URL and Open Graph tags; one `h1`; `lang` set; images with `alt`.
- Known gap: `Layout.astro` has only a title today. Add description/OG/canonical, `robots.txt` and a sitemap before promoting the site.
- Admin screens (`/login`, `/add`) use `<Layout noindex>`.

**Quality**
- `npm run verify`
- No `any`, `@ts-ignore`, stray `console.log`, secrets, commented-out code or TODOs without an owner.
- Lighthouse (mobile) when UI changed: `npx lighthouse http://localhost:4321/ --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --chrome-flags="--headless"`. Targets: performance >= 90, accessibility >= 95, best-practices >= 95.

**Constraints** (re-read `CLAUDE.md`, tick each that applies)
- OWASP: new endpoint/action is authenticated, input validated server-side, errors are generic, output encoded.
- Laws of UX applied and noted in the PR; touch targets >= 44px; no horizontal scroll at 375px.
- Data rules: - Writes only through `submitItinerary()` / the helpers in `googleSheets.ts`; text cells go through `sheetText()` (formula injection) and sheet URLs through `safeHttpUrl()`/`youtubeEmbedUrl()`. - API errors use `clientError()`; only `UserError` messages reach the browser.
- Docs updated in the same change (README, CLAUDE.md if a rule changed).

## Gate 6 detail — validate
`tests/*.test.ts` run with `node --test` (Node 22+, no extra deps). Cover pure utils first: `auth`, `security`, `analytics`, `dates`, `prayer`, `seasons`. API routes and UI go through the manual matrix in feature.md.
- Add a failing test first for every bug fix; keep tests deterministic (inject time/randomness).
- Browser pass: empty, error, loading, keyboard-only, 375px and desktop. Delete only the test rows you created in the sheet.

## Gate 7/8 — see the `release` skill
Branch naming, commit style, versioning and rollback live there so this file stays short.

## When something fails
Fix the root cause, re-run the failed gate and every gate after it. Never weaken a test, skip a check or disable a rule to get green. Report failures with the real output.
