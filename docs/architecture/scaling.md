# Scaling: limits, how reads and writes behave, and when to move off Google Sheets

Google Sheets is the single source of truth today. It is a good fit for a pilot and a small agency. This page says what the limits are, what the app already does about them, and what would trigger a move to a real database.

## 📏 Limits (and what happens at each)

| Limit | Value | Where it comes from | What the app does |
|---|---|---|---|
| Sheets read quota | about 60 requests per minute (the service account is one user) | Google | Bounded retries, shared "slow down" gate, serves cached data (see below) |
| Places per trip | 1,999 | The sheet is read up to row 2000 (`A1:Z2000`) | A save that would pass it is **refused with a clear message** instead of saving rows nobody could see |
| Trips (worksheet tabs) | hundreds work; cost grows with tabs | One full read = 1 + ⌈tabs / 25⌉ + 1 requests | Chunked reads (25 tabs, 4 at a time) |
| Registry rows in `_trips` | 1,000 | Read range `A1:Q1000` | Documented; add a guard before reaching it |
| Pocket items per trip | 100 | `MAX_POCKET_ITEMS` | Refused with a message |
| Trip length | 60 days | `MAX_TRIP_DAYS` | Validated in the wizard and API |
| Copy / wizard batch | 300 / 150 activities | API validation | Refused with a message |

## 🔁 How reads and writes spend the quota

| Action | Sheets requests | Notes |
|---|---|---|
| Page view with fresh cache (30 s) | 0 | Served from memory |
| Page view with stale cache (to 10 min) | 0 for the viewer | Refreshed in the background |
| Cold full read, 100 trips | 6 (meta, 4 batches, `_trips`) | About 10 per minute at most |
| **Add / edit / delete a place** | 4 (list tabs, header, write, re-read **that one tab**) | Before this change every write cleared the whole cache, so the next viewer paid a full read (6+) |
| New trip, rename, delete trip, trip settings | Full clear, next view does a full read | Rare |

Rough capacity with the 60 per minute budget: about 15 place edits per minute sustained while everyone else browses from cache. A busy team of 10 agents stays well inside it.

## 🛡️ Protection when Google says 429

1. Retry waits honour `Retry-After`, grow 1 s, 2 s, 4 s, 8 s with jitter, and stop at a **10 s budget** (it used to sleep 16 s, 32 s, 48 s: a page could hang for 96 s).
2. A 429 closes a shared **quota gate** for the wait it asked for. While it is closed, readers that already have data serve it immediately and make **no** Sheets calls, so a crowd does not retry together.
3. With no data at all (cold start), a page waits at most the budget, then shows the "can't reach your trip sheet" state with Try again.
4. Counters (`sheetsStats`: calls, rate-limited, retries, last read time, targeted refreshes, errors) feed the health check.

## 🚦 When to move to a database

Move when **any** of these holds for a week:

| Signal | Threshold |
|---|---|
| Rate-limited responses | more than 20 per day, or any user-visible slow page caused by one |
| Full read time (`lastReadMs`) | above 5 s |
| Trips | above 300, or any trip above 1,500 places |
| Concurrent editors | more than 10 at peak |
| Need | per-client access control, search across trips, reporting, or an SLA |

## 🧭 Migration plan (GCP)

Recommended target: **Firestore** (a document per trip, a sub-collection of activities, native update timestamps for the conflict check) or **Cloud SQL (PostgreSQL)** if you want SQL reporting. Pick Firestore first: it matches the data shape and needs no server to run.

The seam already exists: every read goes through `getAllCountriesWithSheets()` and the storage helpers in `googleSheets.ts`; every write goes through `submitItinerary()` and the exported functions (`appendActivities`, `updateActivity`, `deleteActivity`, `saveTripMeta`, pocket helpers, user table).

| Phase | Work | Safe to stop after |
|---|---|---|
| 1 | Define a `TripStore` interface from those functions; Sheets implements it (no behaviour change) | Yes |
| 2 | Firestore implementation + one-off import from the sheet (idempotent) | Yes |
| 3 | **Dual-write**: write to both, read from Sheets; compare counts and revisions nightly | Yes |
| 4 | Read from Firestore, keep writing to Sheets as a mirror; the sheet becomes a nightly export and a human-friendly backup | Yes |
| 5 | Stop dual-write; Sheets stays as export only | Final |

Conflict detection (`revision.ts`) maps to a stored `updated_at` / version field, and the 409 flow in the UI does not change.
