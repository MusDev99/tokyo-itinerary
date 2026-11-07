# Operations runbook

For whoever keeps PlanTravel running. Everything here is a checklist you can follow without reading the code.

## 🧭 What runs where

| Piece | Where | Notes |
|---|---|---|
| Website and API | Vercel (Astro SSR) | One deployment per git push; `master` is production |
| Data | One Google Spreadsheet | Trip tabs, plus hidden `_trips`, `_pocket`, `_users`, `_audit` |
| Sign-in | Google OAuth | Only people listed in `_users` with status `active` can edit |
| Logs | Vercel project logs | One JSON object per line (see "Logs") |
| Uptime | `GET /api/health` | Point an uptime monitor at it |

## 🌐 Environments

Never test against the production spreadsheet.

| | Production | Staging |
|---|---|---|
| Domain | your real domain | a **fixed** staging domain (for example `staging.<domain>`) assigned to a Vercel branch/alias |
| Spreadsheet | production sheet | a **separate copy** of the sheet (File > Make a copy), shared with the same service account |
| `GOOGLE_SHEET_ID` | production id | staging id |
| OAuth | production client | same client with the staging redirect URI added, or a second client |
| `SITE_URL` | `https://<domain>` | `https://staging.<domain>` |
| Vercel env scope | Production only | Preview only (set every variable for **both** scopes, with staging values under Preview) |

Why a fixed staging domain: Google OAuth needs exact redirect URIs (`https://<host>/api/auth/google/callback`), and the random preview URLs of each pull request cannot be listed. Pull-request previews are good for looking at the public site; test sign-in and edits on staging.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_SHEET_ID` | yes | The spreadsheet id (or its URL) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | yes | Service account key (whole JSON). The sheet must be shared with its email as **Editor** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` | all three, or editing is off (503) | Google sign-in and the session cookie signature (`AUTH_SECRET` at least 16 random characters) |
| `SITE_URL` | production | Public origin, used for OAuth redirects and calendar links |
| `ADMIN_WHATSAPP` | recommended | Number people are sent to when their email is not registered |
| `HEALTH_TOKEN` | optional | Lets a monitor read the detailed health checks (header `x-health-token`) |
| `PUBLIC_SOFT_NAV` | optional | `0` turns off soft navigation (emergency switch) |
| `PUBLIC_COMPANY_NAME`, `PUBLIC_CONTACT_EMAIL`, `PUBLIC_GOVERNING_LAW` | recommended | Who operates the service, how to reach them, and the governing-law clause; shown on `/privacy` and `/terms`. The clause appears only when set |
| `PUBLIC_LEGAL_REVIEWED` | before launch | `1` once a lawyer has reviewed `/privacy` and `/terms`. Until then both pages show a "Draft: not yet reviewed" notice |

## 👥 People and access

The access list is the hidden `_users` tab. Columns: `google_id, email, name, picture_url, status, created_at, last_login`.

| Task | Steps | Takes effect |
|---|---|---|
| **Onboard** an agent | Add a row with their Google `email` and `status` = `active`. Leave the rest empty (filled in on first sign-in). Tell them to sign in with that Google account | Immediately |
| **Offboard** | Set `status` to `disabled` (do not delete the row: it keeps the history). Their next edit or Pocket view is refused | Within about 1 minute (the check is cached for a minute) |
| Someone cannot sign in | Check the email spelling in `_users`, that `status` is `active`, and that they use that exact Google account. The login page shows only a generic message on purpose | |
| Monthly review | Read `_users`; disable anyone who left. Read the last month of `_audit` for anything unexpected | |

Every edit is recorded in `_audit` (who, action, trip, short target). Notes, booking codes and links are never written there.

## 🔑 Rotating secrets

Do this on a schedule (yearly) and immediately if one may have leaked. After each change, redeploy and run `npm run smoke -- https://<domain>`.

| Secret | How | Side effect |
|---|---|---|
| `AUTH_SECRET` | Generate a new one (`openssl rand -base64 32`), set it in Vercel, redeploy | **Everyone is signed out** and signs in again |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console > APIs & Services > Credentials: add a new secret to the OAuth client, set it in Vercel, redeploy, then delete the old one | None |
| Service account key | IAM > Service accounts > Keys: create a new JSON key, put it in `GOOGLE_SERVICE_ACCOUNT_JSON`, redeploy, then delete the old key | None |
| `HEALTH_TOKEN` | New value in Vercel and in the monitor | Monitor details stop until updated |

Never paste a secret into chat, an issue or a commit. If one was committed, treat it as leaked and rotate it.

## 📟 Monitoring

| What | Setup |
|---|---|
| Uptime | Monitor `GET https://<domain>/api/health` every 1 to 5 minutes. Alert when the HTTP status is not 200 (503 means the trip sheet cannot be read) |
| Degraded | With `x-health-token`, the body lists the checks. Alert (low priority) when `status` is `degraded` for more than 15 minutes |
| Smoke test | After every deploy: `npm run smoke -- https://<domain>` must be all green |

`status` meanings: `ok` all good; `degraded` still serving, but rate limiting, a slow sheet, a failed recent read behind cached data, or editing not configured; `down` the trip sheet cannot be read.

## 🪵 Logs

Each line is JSON: `ts, level, event, requestId, ...`. Secrets, tokens, cookies and long key-like text are scrubbed before writing. The error page shows a **Reference** (the request id); search the logs for it to see everything that request did. Every response also has an `x-request-id` header.

| Event | Level | Meaning |
|---|---|---|
| `request` | warn / error | A request took over 3 s or returned 5xx (method, path, status, ms; no query string, no user) |
| `api_error` | error | An API failed unexpectedly (the person saw a generic message) |
| `sheets_rate_limited` | warn | Google answered 429/503 and we are retrying |
| `targeted_refresh_failed` | warn | The one-tab cache refresh failed; the cache was cleared instead (self-heals) |
| `auth_*` | error | Sign-in problems (`auth_token_exchange_failed`, `auth_id_token_rejected`, `auth_sign_in_failed`, `auth_user_table_check_failed`) |
| `sheets_credentials_invalid` / `_unreadable` | error | The service account key is missing or malformed |
| `audit_write_failed`, `user_row_update_failed`, `users_tab_create_failed` | error | The hidden tabs could not be written |
| `*_read_failed` | error | A page could not read the sheet (served its fallback) |

## 🚨 Incidents

| Symptom | Check | Do |
|---|---|---|
| Site shows "We can't reach your trip sheet" | `/api/health` (503?), logs for `sheets_*`, Google Workspace status | If 429: wait, it clears in about a minute (cached data is served meanwhile). If 403: the sheet is no longer shared with the service account email as Editor. If credentials events: fix `GOOGLE_SERVICE_ACCOUNT_JSON` |
| Pages slow, `degraded`, `sheets_rate_limited` in logs | Count of rate-limited events, number of people editing at once | Usually self-heals. If it persists daily, follow the migration signals in `docs/architecture/scaling.md` |
| Nobody can sign in | `auth_*` events; `/login?error=` code | Check `GOOGLE_CLIENT_ID/SECRET`, the redirect URI `https://<domain>/api/auth/google/callback`, and `SITE_URL`. A rotated `AUTH_SECRET` signs everyone out (expected) |
| Editing says "disabled" (503) | `/api/health` check "editing configured" | One of `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET` is missing in this environment |
| A bad release | Smoke test fails or errors after deploy | **Rollback** (below) first, investigate second |
| "Changed by someone else" prompts keep appearing | Two people editing the same place, or a script writing to the sheet | Normal protection. Ask them to reload; a person editing the sheet by hand also triggers it |
| A trip, place or booking was deleted by mistake | `_audit` shows who and when | Restore from the sheet's version history (below). Deleting a place can also be undone right away from the toast |

### ⏪ Rollback

1. Vercel > Deployments > pick the last good deployment > **Promote to Production** (instant, no rebuild).
2. Then revert the bad merge on `master` with a pull request (`git revert -m 1 <merge commit>`).
3. Data written by newer versions stays valid: new sheet columns and hidden tabs are additive and are ignored by older versions.

### ♻️ Restoring data

Google Sheets keeps version history: **File > Version history > See version history**, pick a time before the mistake, then copy the rows or the deleted tab back (or restore the whole version). Pocket items live in `_pocket`, trip settings in `_trips`.

Until automatic backups exist, make a manual copy before risky work and weekly: **File > Make a copy**, named with the date, in a folder only admins can open.

## ✅ Pre-launch checklist

| | Item |
|---|---|
| ☐ | Staging environment with its own spreadsheet; the preview checklist in the release notes passed there |
| ☐ | Production env vars set and `npm run smoke -- https://<domain>` is all green |
| ☐ | Uptime monitor on `/api/health` with an alert to a person who will see it |
| ☐ | `_users` contains exactly the people who should edit, nobody else |
| ☐ | A weekly sheet copy is scheduled (calendar reminder) and one restore was practised |
| ☐ | `npm audit --omit=dev` shows 0 vulnerabilities; Dependabot enabled |
| ☐ | `/privacy` and `/terms` reviewed by a lawyer for your business and country, company name and contact set, then `PUBLIC_LEGAL_REVIEWED=1` (the "Draft" notice disappears) |
| ☐ | Owner and backup contact for incidents written down: ______________________ |
