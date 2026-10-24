# Feature: Editor auth guard + OWASP hardening

**Status:** ✅ verified · **Branch:** `ccr-842b3a88-ddan6t` (convention: `feat/auth-guard`) · **Target version:** 0.1.0

## 1. 🧠 Brainstorm
**Problem** — `POST/PATCH/DELETE /api/itinerary`, `/api/place` and `/api/sheets-sync` were open: anyone could add, rename or delete a whole trip (and read the service-account email + sheet id from `GET /api/sheets-sync`). Sheet cells were also written with `USER_ENTERED` (formula injection) and rendered unchecked (`javascript:` links).

| Option | Pros | Cons | Effort | Pick |
|---|---|---|---|---|
| A. Vercel password protection | no code | paid plan, hides the whole public site | S | |
| B. Editor password + signed cookie; viewing stays public | no deps, works on Vercel + Netlify, keeps the public trip pages | one shared secret | M | ✅ |
| C. OAuth login | per-user identity | heavier, more config | L | later |

**Decision** — B. Reading stays public (it's the product); anything that changes the sheet needs an editor session.

## 2. 🗺️ Roadmap
| Phase | Task | Effort | Status |
|---|---|---|---|
| 1 | Middleware guard, `/login`, `/api/logout`, origin (CSRF) check | M | ✅ |
| 1 | Security headers (CSP in prod), generic API errors | S | ✅ |
| 1 | Formula-injection + URL-scheme hardening | S | ✅ |
| 1 | `.gitignore`, `npm audit fix` | S | ✅ |
| 2 | Upgrade `astro` 5 -> 7, `@astrojs/vercel` 11, `jspdf` 4 (critical advisories, breaking) | M | ⬜ |
| 2 | SEO: meta description, OG, canonical, robots.txt, sitemap | M | ⬜ |
| 3 | Per-user OAuth, distributed rate limit | L | ⬜ |

## 3. 🔬 Feature analysis
### 3.1 Acceptance criteria
| ID | Given / When / Then | Test |
|---|---|---|
| AC-1 | No session: `POST/PATCH/DELETE /api/itinerary`, `POST /api/place`, any `/api/sheets-sync` -> 401 | curl + smoke |
| AC-2 | No session: `/add` -> 302 `/login?next=/add` | curl + smoke |
| AC-3 | Public pages and `GET` APIs (geocode, prayer-times, currency) keep working without a session | build + curl |
| AC-4 | Valid session + foreign `Origin` on a write -> 403 | curl |
| AC-5 | Wrong password -> 401 generic; 6th attempt in 10 min -> 429 | curl |
| AC-6 | Login sets `HttpOnly; SameSite=Lax` cookie (`Secure` in prod); `next` only same-site | curl + unit |
| AC-7 | Production without `EDITOR_PASSWORD`/`AUTH_SECRET` -> writes return 503 (fail closed), site still readable | code path + smoke |
| AC-8 | A 401 in the UI sends the editor to `/login?next=<current page>` | `authClient.ts` |
| AC-9 | Cells starting with `= + - @` are stored as text; non-http(s) map/image URLs dropped; YouTube links converted to `youtube-nocookie` embeds only | unit |
| AC-10 | API 500s never echo internal messages (only `UserError`); `/api/sheets-sync` no longer accepts a caller-supplied `spreadsheetId` | code review |

### 3.2 Data impact
None. New env vars `EDITOR_PASSWORD`, `AUTH_SECRET`. Existing text beginning with `=`/`+`/`-`/`@` is read as before; only new writes are neutralised.

### 3.3 Threat model — OWASP Top 10 (2021)
| Risk | Relevant? | Mitigation / evidence |
|---|---|---|
| A01 | ✅ | `src/middleware.ts` gates writes + `/add` + `/api/sheets-sync`; open-redirect-safe `next` |
| A02 | ✅ | HMAC-SHA256 signed expiring token (8h), `Secure`/`HttpOnly` cookie, HSTS in prod |
| A03 | ✅ | `sheetText()`, `safeHttpUrl()`, `youtubeEmbedUrl()`; existing field validation kept |
| A04 | ✅ | fail closed; read-only public site is a deliberate design |
| A05 | ✅ | CSP (prod), nosniff, frame-deny, Referrer-Policy, Permissions-Policy; generic errors via `clientError()` |
| A06 | ⚠️ | `npm audit fix` 32 -> 9; remaining need breaking majors (see roadmap) |
| A07 | ✅ | constant-time compare, throttle, generic message |
| A08 | ✅ | same-origin check on cookie-authenticated writes; CDN origins listed in CSP |
| A09 | ✅ | `clientError()` logs server-side |
| A10 | ✅ | outbound fetches go to fixed hosts; `base` and coordinates are encoded/validated |

### 3.4 Laws of UX
| Law | Applied how |
|---|---|
| Hick | one password field, one button |
| Fitts | 44px full-width controls (`touch-target`) |
| Jakob | standard login form with `autocomplete` |
| Peak-End | returns the editor to the page they were on |
| Postel | forgiving input, strict storage |

### 3.5 Mobile-first (375px)
`max-w-md w-full` card (`mx-auto` + `w-full` per CLAUDE.md), no horizontal scroll.

### 3.6 Out of scope
Per-user identity, MFA, password reset, hiding edit buttons for signed-out visitors (they redirect to sign-in on click).

## 4. 🔨 Implementation checklist
- [x] Smallest diff; Web Crypto only, no new dependency
- [x] Auth on every write route
- [x] Generic errors
- [x] Env vars in `.env.example`
- [x] No new `any` (existing `catch (err: any)` untouched; tracked in audit F-08)

## 5. 📏 Verification gates
- [x] **Performance** — one HMAC per protected request; no extra sheet calls
- [x] **SEO** — `<Layout noindex>` on `/login` and `/add`; public-page meta gap recorded in audit F-07
- [x] **Quality** — `npm run verify` green (7 tests + build)
- [x] **Constraints** — CLAUDE.md updated

## 6. ✅ Validation
| AC | Evidence | Result |
|---|---|---|
| AC-1/2 | `astro dev` with env set: 401/401/401/302 as expected | ✅ |
| AC-3 | build passes; `GET /api/geocode` answers with the security headers and no session requirement | ✅ |
| AC-4 | foreign Origin -> 403 | ✅ |
| AC-5 | statuses `401 401 401 401 401 429 429` | ✅ |
| AC-6 | `Set-Cookie: tk_session=...; HttpOnly; SameSite=Lax`; `next=https://evil.test` -> `/add` | ✅ |
| AC-7 | code path reviewed; production behaviour covered by smoke script | ⚠️ not run against a real prod build |
| AC-8 | by inspection | ⚠️ not exercised in a browser |
| AC-9 | `tests/auth.test.ts` | ✅ |
| AC-10 | review | ✅ |

- [x] Unit tests added and passing
- [ ] Browser pass of add/edit/delete as a signed-in editor (needs Google Sheets credentials; not run)
- [ ] Vercel preview + `npm run smoke -- <url>`

## 7. 🌿 Git & 🚀 release
- [x] Conventional commits · CHANGELOG + README + CLAUDE.md updated
- [ ] Release: **set `EDITOR_PASSWORD` and `AUTH_SECRET` in Vercel (Production and Preview)** — until then editing returns 503 by design
- Rollback: Vercel -> Deployments -> Instant Rollback.
