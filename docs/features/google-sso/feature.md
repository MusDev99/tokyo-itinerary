# Feature: Google SSO for create / update / delete

Status: implemented on `feat/google-sso` · Replaces: shared `EDITOR_PASSWORD` (see `docs/features/auth-guard`)

## Goal
Everyone can view itineraries. Only registered people can add, edit, delete or rename — identified by their Google account, not a shared secret.

## Decisions
| Topic | Decision |
|---|---|
| User table | Hidden `_users` worksheet in the existing spreadsheet |
| Registration | Admin adds the email (`status` = `active`); first login fills `google_id`, name, picture |
| Roles | One role: every active user can edit everything |
| Old password | Removed |
| Guests | Read-only pages, no edit controls, "Sign in to edit" |
| Audit | Hidden `_audit` worksheet |
| OAuth | Authorization Code + PKCE, dependency-free (`fetch` + Web Crypto) |
| Local dev | Needs Google credentials too (fail closed everywhere) |

## Acceptance criteria
- AC-1 Guest: `POST/PATCH/DELETE /api/itinerary`, `POST /api/place`, `/api/sheets-sync`, `/add` are refused (401 / redirect to `/login`). Reading stays public.
- AC-2 Registered + active user can sign in with Google and use every write action.
- AC-3 Unregistered or disabled Google account gets no session and sees the WhatsApp request button.
- AC-4 A different Google account cannot sign in as a pre-registered email once `google_id` is linked.
- AC-5 State mismatch, expired/consumed OAuth cookie, wrong audience/issuer/nonce or bad ID-token signature are rejected.
- AC-6 Disabling a user's row revokes writes within ~1 minute.
- AC-7 Every sign-in and change appears in `_audit` with the editor's email.
- AC-8 Without Google env vars writes return 503 in all environments.

## Laws of UX
Jakob's (avatar menu top-right, familiar "Continue with Google"), Hick's (guests see fewer actions), Fitts's (44px targets), Von Restorff (one primary sign-in button).

## Security (OWASP)
A01 server-side check on every write (cookie + active user); A02 HMAC-signed `HttpOnly` `SameSite=Lax` sessions; A07 PKCE/state/nonce, ID-token verification, `sub` binding, throttle; A09 failures logged without tokens; A10 only fixed Google hosts are fetched.

## Verification
`npm run verify` (17 unit tests + build) · `npm run smoke -- <url>` · manual Google round trip with a registered and an unregistered account.

## Release checklist
- [ ] Create the Google OAuth Web client; add localhost and production redirect URIs
- [ ] Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, `SITE_URL`, `ADMIN_WHATSAPP` in Vercel (Production **and** Preview) and in `.env`
- [ ] Run `npm run sheets:setup -- <your-email>` (creates `_users`/`_audit` and adds you as active)
- [ ] Remove `EDITOR_PASSWORD` from the environments
