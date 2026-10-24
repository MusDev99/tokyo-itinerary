# CLAUDE.md

Multi-country travel itinerary planner (Astro 7 SSR on Vercel + Preact + Tailwind 3 via PostCSS). Google Sheets is the single source of truth. See `GEMINI.md` and `README.md` for the full feature tour.

## Commands

```bash
npm run dev      # dev server (http://localhost:4321)
npm run build    # production build (use this to type/compile check)
npm run preview  # preview the build
npm test         # unit tests (node --test, Node 22+)
npm run verify   # tests + build (run before every commit)
npm run smoke -- <url>   # post-deploy auth/header checks
```

## Architecture

- **Data**: `src/utils/googleSheets.ts` reads/writes the spreadsheet with a service account (needs **Editor** access to write). `src/utils/countries.ts` turns tabs into countries/states.
- **Tabs**: tab name `Country - State` (e.g. `Japan - Tokyo`) = a state of a country; a plain tab (e.g. `japan`) = a country with no states.
- **Routes**: `/[country]`, `/[country]/itinerary` (all states merged), `/[country]/[state]`, `/add`, `/api/itinerary` (POST/PATCH/DELETE), `/api/sheets-sync`.
- **Auth**: viewing is public; any write needs Google sign-in by an `active` user in the hidden `_users` tab (`GOOGLE_CLIENT_ID/SECRET` + `AUTH_SECRET`, signed cookie), enforced by `src/middleware.ts` which also sets `Astro.locals.user`; `/login`, `/api/auth/google[/callback]`, `/api/logout`. Core in `src/utils/auth.ts`, user table helpers in `src/utils/userTable.ts` + `users.ts` (dependency-free, unit-tested). Edits are logged to the hidden `_audit` tab. Edit controls render only when `Astro.locals.user` is set.
- **Writes** all go through `submitItinerary()` in `src/pages/api/itinerary.ts` (the seam for a future email-approval flow).
- Sheet columns are defined once in `SHEET_HEADERS` / `COLUMN_ALIASES` (`googleSheets.ts`); rows have a uuid `id` column used for edit/delete.

## Conventions

- Mobile-first: every page must work at 375px with no horizontal scroll. Containers that use `mx-auto` need `w-full` (they sit in a flex column).
- Match existing component style (Tailwind utility classes).
- Reuse the shared building blocks before writing new ones: `FormField` (label + error), `PickerPopover` (field-style popovers), `useDismiss` (outside press / Escape), `prefersReducedMotion()` (`utils/motion.ts`).
- **UI/UX: follow the [Laws of UX](https://lawsofux.com/)** for every new or changed screen (e.g. Hick's Law: progressive disclosure; Miller's Law: chunk content; Fitts's Law: touch targets of at least 44px; Jakob's Law: familiar patterns; Doherty Threshold: feedback under 400ms). Note the law applied in a short code comment where it drives a decision.
- **Animation: use [Motion](https://motion.dev/)** (the `motion` package) for animations and transitions instead of ad-hoc CSS/JS animation libraries. Keep animations subtle and purposeful, and respect `prefers-reduced-motion`.
- Never commit secrets: `credentials/` and `.env` stay out of git.

## Security — OWASP Top 10 (2021), mandatory
| Risk | Rule in this repo |
|---|---|
| A01 Access control | Reading is public; anything that changes the sheet (`POST/PATCH/DELETE /api/itinerary`, `/api/place`, all of `/api/sheets-sync`, `/add`) needs a signed-in, still-`active` user, enforced in `src/middleware.ts`. A **new write route must be added to `PROTECTED_API`/`PROTECTED_PAGES`**. Redirect targets go through `safeNext()` |
| A02 Crypto | Secrets only in env (`AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_*`). Sessions are HMAC-signed, `HttpOnly`, `SameSite=Lax`, `Secure` in prod. Never hand-roll other crypto |
| A03 Injection | Validate + trim on the server (`parseActivity`); text written to the sheet goes through `sheetText()` (formula injection); URLs read from the sheet through `safeHttpUrl()` / `youtubeEmbedUrl()`; no `set:html` / `dangerouslySetInnerHTML` |
| A04 Design | Fail closed: without `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `AUTH_SECRET` writes return 503 in every environment (the public site keeps working) |
| A05 Misconfiguration | Headers/CSP live in `src/utils/security.ts` (applied by the middleware; CSP is production-only). API errors go through `clientError()`: only `UserError` text reaches the browser |
| A06 Components | `npm audit --omit=dev` before each release; `npm audit fix`, never `--force` without a test pass |
| A07 Auth | OAuth Authorization Code + PKCE, `state` and `nonce` checked, ID-token signature/`iss`/`aud`/`exp` verified, Google `sub` bound to the user row on first login, throttle, one generic message. Do not add hints about which check failed |
| A08 Integrity | Commit the lockfile; no new third-party script/CDN/API host without adding it to the CSP in `security.ts` |
| A09 Logging | Log failures server-side; never log passwords, tokens or keys |
| A10 SSRF | Server code fetches fixed hosts only; client input is `encodeURIComponent`-ed or validated; never accept a caller-supplied spreadsheet id |

## Mobile-first & Laws of UX
Design for **375px first**, then scale up (thumb-reachable primary action, drawers full-width, tables collapse to cards below 768px, no horizontal scroll). Apply the Laws of UX listed under *UI / UX standard* to every new or changed screen and name the law in the PR/feature.md.

## Claude-native workflow (skills in `.claude/skills/`)
Start every feature, fix or refactor with `/dev-workflow` (brainstorm -> plan -> analysis -> implement -> verify -> validate -> git -> release).
| Skill | Use it when | Writes |
|---|---|---|
| `dev-workflow` | starting any change | gates + `docs/features/<slug>/feature.md` |
| `feature-checklist` | creating/validating a feature | `docs/features/<slug>/feature.md` (from `feature.md` template) |
| `code-review-checklist` | before every PR | `docs/reviews/<branch>.md` (from `code-review.md`) |
| `owasp-audit` | auth/endpoint/dependency/header change, pre-release | `docs/audits/<date>-audit.md` (from `audit.md`) |
| `release` | commit, PR, version, deploy, rollback | tag + release notes |

Gate commands: `npm run verify` (tests + build) · `npm test` · `npm run smoke -- <url>` (post-deploy auth/header checks). Never mark work done while a gate is red; report real output.

## Git workflow (required)

- **Never commit directly to `main`.** Create a branch first:
  - New feature → `feat/<feat-name>` (e.g. `feat/add-itinerary`)
  - Bug fix → `fix/<bug-name>` (e.g. `fix/mobile-overflow`)
  - Use short kebab-case names.
- Commit only when asked. Keep commits focused, with a clear imperative message.
- Push the branch to `origin` and merge via pull request.
- Run `npm run verify` (tests + build) before committing and make sure it passes. Commit messages follow Conventional Commits (`feat(auth): ...`); `chore/*` and `docs/*` branches are fine too; an agent session may be given a fixed branch: use it.
- Releases, versioning and rollback: see the `release` skill.
- **Always update `CHANGELOG.md` before every commit**: add an entry at the top with the date and time (`date "+%Y-%m-%d %H:%M"`) and a short list of what changed.
- **Update `README.md` when needed** (new features, routes, env vars, scripts, sheet columns or project structure change) and include it in the same commit.
