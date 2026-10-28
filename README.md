# 🌍 Multi-Country Travel Itinerary & Budget Analytics

A modern, interactive **multi-country travel itinerary planner and financial analytics dashboard** built with **Astro**, **Preact**, **TypeScript**, and **Tailwind CSS**.

Designed around the **[Laws of UX](https://lawsofux.com/)**, it uses **Google Sheets as the Single Source of Truth** via a Service Account, where **one worksheet tab represents one country** and the **tab name defines the country name**, paired with live **multi-currency exchange conversion** and **spending analytics**.

---

## ✨ Key Features

### 1. Google Sheets as Single Source of Truth
- **Tabs = Countries and States**: Add a destination by creating a worksheet tab. A plain tab (e.g., `Japan`) is a country; a tab named `Country - State` (e.g., `Japan - Tokyo`, `Japan - Osaka`) becomes a state/city of that country. Routes: `/[country]`, `/[country]/itinerary` (all states), `/[country]/[state]`.
- **Prepare checklist** (`/[country]/[state]/prepare`, or `/[country]/prepare` for a plain country tab): a 4th trip tab with a checklist built from the trip itself (`src/utils/checklist.ts`): documents, money (trip currency + planned spend), phone & apps, packing (season + activities such as onsen, temples, hikes, beaches), prayer & food, and booking reminders for paid stays, tickets and transport. Items with a lead time show "Overdue / 3d left", and the 5 most urgent sit on top. Ticks and your own extra items are saved **on this device** (no sign-in, works offline).
- **Travel tools** (`/[country]/[state]/tools`): prayer times for every trip date in the destination's local time with the local calculation method per country (AlAdhan API) plus Qibla direction, driven by the trip's confirmed location. No API keys needed.
- **Trip locations**: each trip's real place (lat/lng, timezone) is confirmed when adding a trip and stored in a hidden `_trips` worksheet (columns `tab, place, admin1, country, country_code, lat, lng, timezone`) — don't delete it.
- **Inline add / manage**: on a trip page, "Add new activity" opens the add form in place; rename and delete are icon buttons in the trip card. Activities in a day are collapsed to time + title with an Expand / Collapse all control.
- **Add & edit from the website**: `/add` creates a new tab and day-by-day activities (date + day title, then activities) straight into the sheet; activities can be edited/deleted, and trips renamed/deleted, with a confirmation modal before any delete. The service account needs **Editor** access to the sheet.
- **Zero-Dependency Service Account Client**: Authenticates with Google Sheets API v4 using an `RS256` OAuth 2.0 JWT signed via Node's built-in `node:crypto` (`src/utils/googleSheets.ts`)—no heavy SDKs or local `.json` data files required.
- **Live Sync & Refresh**: Sheets reads are kept in server memory with stale-while-revalidate (`src/utils/swr.ts`): fresh for 30s, then served instantly for up to 10 min while one background read refreshes them, so switching tabs never waits on Google. Every write from the app clears the cache (editors see their change on the next render), and the in-app **Refresh from Google Sheets** button (`/api/sheets-sync`) forces a live read. Edits made directly in Google Sheets show up within about 30s. Built-in request deduplication and rate-limit retry backoff.
- **Fast tab switching**: the Overview / Itinerary / Tools tabs are prefetched as soon as they're visible (guests), and guest pages are `private, max-age=30` so the prefetched page is reused on tap and Back is instant. Editors' pages stay `no-store`.

### 2. Comprehensive Trip Analytics & Currency Exchange
- **Global & Per-Country Analytics (`AnalyticsDashboard.tsx`)**: three tabs — Overview (category doughnut, biggest expenses, daily stacked spend), Currency and paginated Expenses.
  - Total trip cost, daily average burn rate, cost per activity, and paid vs. free activity ratios.
  - **6-Category Spending Breakdown**: Automatically classifies activities into `Transport`, `Food`, `Lodging`, `Attraction`, `Shopping`, and `Other` using explicit `category` cells or keyword heuristics.
  - **Daily Spending Profile & Peak Spend Alerts**: Visualizes highest-cost days and top individual expenses.
- **Live Multi-Currency Exchange (`CurrencyExchangeGraph.tsx` & `/api/currency-exchange`)**:
  - Instant conversion for **MYR, USD and every currency used by a country with an itinerary** (no fixed list; the hub grows with your trips).
  - Interactive historical exchange rate trend chart with 30-day high/low/average statistics powered by Frankfurter & Open ER-API.

### 3. UX-First Interface ([Laws of UX](https://lawsofux.com/))
- **Hick's Law & Progressive Disclosure**: Clean, scannable timeline cards that tuck secondary notes, maps, and media behind expandable sections.
- **Miller's Law**: Chunked KPI summary cards (max 4–5 metrics per group) and categorized filter pills.
- **Fitts's Law**: Touch-friendly interactive targets ($\ge 44\text{px}$), sticky day navigation pills, and quick action buttons.
- **Doherty Threshold**: Instant client-side filtering, search, currency switching, and skeleton loaders.
- **PDF Export**: Download printable country itineraries directly from the browser (`PDFDownload.tsx`).
- **Animated Seasons**: Seven [Motion](https://motion.dev/)-animated themes (autumn, winter, spring, summer, rain, haze, starry night) chosen from a compact panel above the floating theme button (grouped into Seasons and Weather, with labels), each with its own **looping ambient soundscape** (autumn wind and leaves, winter wind and sparkles, spring birds, summer waves, rain, hazy drone, night crickets), synthesised with Web Audio (no audio files, no CSP change). It starts on the first tap (browsers block audio before a gesture), crossfades when the theme changes, pauses while the tab is hidden, and the Sound on/off switch in the theme panel is remembered. Translucent glass cards. Honors `prefers-reduced-motion`.
- **Mobile-first navigation**: slide-in drawer with collapsible country cards, 44px touch targets and a compact activity card.
- **📲 Installable PWA with offline reading**: add PlanTravel to the home screen (Android/desktop install prompt, iOS *Share → Add to Home Screen*). A service worker (`public/sw.js`, production only) saves every trip page from `/sitemap.xml` plus the whole client bundle (`/sw-assets.json`, generated at build), so itineraries, timelines and analytics read with no signal. Pages are network-first with a 3s timeout, so fresh data wins when online. Offline, a pill links to `/offline`, which lists saved pages. Editing, sign-in and `/add` always need a connection; signing out deletes the saved pages. Data Saver skips the pre-download.

---

### 4. Security (OWASP Top 10) & editor access
- **Viewing is public; editing needs Google sign-in by a registered user.** `POST/PATCH/DELETE /api/itinerary`, `POST /api/place`, `/api/sheets-sync` and the `/add` page require a session (`/login` → Google, 7-day signed `HttpOnly` cookie) **and** an `active` row in the hidden `_users` worksheet. Guests see a read-only site with no edit controls. Without the Google env vars editing is **disabled (503)**, never open.
- **First-time setup:** `npm run sheets:setup -- you@gmail.com` creates the hidden `_users` and `_audit` tabs and registers you as the first active editor (omit the email to just create the tabs). Show hidden tabs in Google Sheets via the *All sheets* menu.
- **Registering editors:** add a row to the hidden `_users` tab with the person's Google `email` and `status` = `active` (columns: `google_id, email, name, picture_url, status, created_at, last_login`). Their first sign-in fills `google_id`, name and profile picture; set `status` to `disabled` to revoke (takes effect within ~1 minute). Unregistered people see an **Ask the admin on WhatsApp** button (`ADMIN_WHATSAPP`).
- **Audit trail:** every sign-in and change is appended to the hidden `_audit` tab (`time, email, action, tab, target`).
- **Google setup:** Google Cloud Console → OAuth consent screen → Credentials → *Web application*; add the redirect URIs `http://localhost:4321/api/auth/google/callback` and `https://<your-domain>/api/auth/google/callback`. While the consent screen is in *Testing*, only listed test users can sign in.
- Hardening: security headers + production CSP, same-origin check on writes (CSRF), OAuth with PKCE + state + nonce and verified ID-token signature, sign-in throttle, open-redirect-safe `next`, spreadsheet formula-injection guard, http(s)-only map/image links, YouTube-only video embeds, generic API errors.
- Process: audit in `docs/audits/`, feature checklist in `docs/features/`, tests in `tests/` (`npm test`), post-deploy `npm run smoke -- <url>`.

### 5. AI-driven development workflow (Claude skills)
`.claude/skills/` ships a repeatable pipeline: **brainstorm -> plan -> feature analysis -> implement -> verify (performance, SEO, quality, constraints) -> validate (tests + `feature.md` checklist) -> git -> release**.
| Skill | Purpose |
|---|---|
| `dev-workflow` | the 8 gates and what each must produce |
| `feature-checklist` | `feature.md` template for every feature |
| `code-review-checklist` | `code-review.md` report before merge |
| `owasp-audit` | `audit.md` security audit |
| `release` | git strategy, SemVer, deploy preview, smoke test, rollback |

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Astro v7](https://astro.build/) |
| **UI Components** | [Preact](https://preactjs.com/) + TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Animation** | [Motion](https://motion.dev/) |
| **Data Source** | Google Sheets API v4 (Service Account JWT — Single Source of Truth) |
| **Currency API** | [Frankfurter API](https://www.frankfurter.app/) & [Open Exchange Rates API](https://open.er-api.com/) |
| **PDF Generation** | `html2canvas` + `jspdf` |

---

## 📁 Project Structure

```text
├── .claude/skills/                    # AI-driven dev workflow: dev-workflow, feature-checklist, code-review-checklist, owasp-audit, release
├── docs/                              # features/ (feature.md), reviews/, audits/ (audit.md)
├── tests/                             # node:test unit tests (auth, users, calendar, popover, season sound, service worker, caching + animation perf)
├── scripts/smoke.mjs                  # post-deploy auth/header smoke test
├── scripts/pwa-assets.mjs             # build hook: writes /sw-assets.json (client bundle list for offline)
├── public/
│   ├── sw.js                          # Service worker: offline read access
│   ├── manifest.webmanifest           # PWA manifest (name, colors, icons)
│   └── icons/                         # PWA + Apple touch icons (from logo.svg)
├── credentials/
│   └── keys.json                      # Local Google Service Account key (gitignored)
├── src/
│   ├── components/
│   │   ├── AnalyticsDashboard.tsx     # Multi-country & single-country financial analytics
│   │   ├── Banner.tsx                 # Dynamic trip status banner
│   │   ├── Countdown.tsx              # Next trip countdown widget
│   │   ├── CountrySubNav.astro        # Sub-navigation between Overview & Timeline
│   │   ├── CurrencyExchangeGraph.tsx  # Historical exchange rate chart & converter
│   │   ├── Footer.astro               # Site-wide footer
│   │   ├── Header.astro               # Dynamic country switcher & theme controls
│   │   ├── PDFDownload.tsx            # Client-side PDF itinerary generator
│   │   ├── SearchFilter.tsx           # Search & category filter bar
│   │   ├── SkeletonLoader.tsx         # Loading state placeholders
│   │   ├── TabsNew.tsx                # Day-by-day tabbed itinerary viewer
│   │   ├── TechStack.tsx              # Technology stack showcase modal/drawer
│   │   ├── SeasonBackground.tsx       # Motion-animated season scenes
│   │   ├── ThemeSwitcher.tsx          # Floating theme button + Seasons/Weather panel
│   │   ├── MobileNav.tsx              # Mobile slide-in navigation drawer
│   │   ├── OfflineStatus.tsx          # Registers the service worker + offline pill
│   │   ├── TripChecklist.tsx          # Prepare tab: per-device checklist with progress
│   │   ├── AddItineraryForm.tsx       # Two-tab add form (trip, then days & activities)
│   │   ├── AnalogTimePicker.tsx       # Analog clock time picker
│   │   ├── CalendarPicker.tsx         # Month-grid date picker (keyboard + touch)
│   │   ├── PickerPopover.tsx          # Shared trigger + popover for the date/time pickers
│   │   ├── FormField.tsx              # Label + control + error layout for forms
│   │   ├── useDismiss.ts              # Close-on-outside-press / Escape hook
│   │   ├── useMediaQuery.ts           # Live matchMedia hook
│   │   ├── ConfirmDialog.tsx          # Confirmation modal for destructive actions
│   │   ├── TripActions.tsx            # Add activities / rename / delete trip
│   │   ├── AddActivityPanel.tsx       # Inline "Add new activity" panel on a trip page
│   │   ├── BackButton.tsx             # Universal header back button
│   │   ├── TravelTools.tsx            # Travel tools tab (location + prayer times)
│   │   ├── LocationPicker.tsx         # Search & pick a trip's real place
│   │   ├── PrayerTimesCard.tsx        # Prayer times per trip date + Qibla compass
│   │   ├── Timeline.tsx               # Daily activity timeline container
│   │   └── TimelineItem.tsx           # Individual activity card (progressive disclosure)
│   ├── layouts/
│   │   └── Layout.astro               # Base HTML layout & theme initialization
│   ├── pages/
│   │   ├── index.astro                # Global portfolio dashboard & cross-country comparison
│   │   ├── 404.astro                  # Custom 404 page
│   │   ├── offline.astro              # Offline fallback: lists pages saved on this device
│   │   ├── [country]/
│   │   │   ├── index.astro            # Country overview, schedule summary & analytics
│   │   │   ├── [state]/index.astro    # Single `Country - State` trip timeline
│   │   │   ├── [state]/tools.astro    # Travel tools (location + prayer times) for a state
│   │   │   ├── tools.astro            # Travel tools for a plain country tab
│   │   │   ├── prepare.astro          # Prepare checklist (state pages: [state]/prepare.astro)
│   │   │   └── itinerary.astro        # Interactive day-by-day country itinerary & PDF export
│   │   ├── add.astro                  # Add-itinerary form (days & activities)
│   │   └── api/
│   │       ├── currency-exchange.ts   # Live & historical FX rate endpoint
│   │       ├── itinerary.ts           # Create / edit / delete / rename trips (writes to Google Sheets)
│   │       ├── geocode.ts             # Place search (Open-Meteo geocoding)
│   │       ├── place.ts               # Confirm/change a trip's saved location
│   │       ├── prayer-times.ts        # Prayer times + Qibla (AlAdhan)
│   │       └── sheets-sync.ts         # Google Sheets status & live refresh API endpoint
│   ├── styles/
│   │   ├── global.css                 # Global styles & design tokens
│   ├── types/
│   │   └── itinerary.ts               # TypeScript interfaces (DayItinerary, TimelineItem, etc.)
│   └── utils/
│       ├── analytics.ts               # Category classification & financial aggregation engine
│       ├── countries.ts               # Dynamic country loader from Google Sheets tabs
│       ├── currency.ts                # Currency formatting & conversion helpers
│       ├── googleSheets.ts            # Google Sheets v4 Service Account client & CLI verifier
│       └── url.ts                     # Base URL path helper
├── .env.example                       # Environment variable template
├── astro.config.mjs                   # Astro configuration
└── package.json
```

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your Google Sheet ID:

```dotenv
# Google Spreadsheet ID (from https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit)
GOOGLE_SHEET_ID=your_google_spreadsheet_id_here

# Optional: Path to local Service Account JSON file (defaults to ./credentials/keys.json)
GOOGLE_CREDENTIALS_PATH=./credentials/keys.json
```

### 3. Run Development Server

```bash
npm run dev
```

Open `http://localhost:4321` in your browser.

---

## 📊 Google Sheets Schema (Single Source of Truth)

### Step 1: Share Your Google Sheet
Share your target Google Spreadsheet with your Service Account email (found in `credentials/keys.json` under `client_email`, e.g., `google-sheet-sync@mus-project-2024.iam.gserviceaccount.com`).

### Step 2: Worksheet Tabs & Column Headers
- **Each worksheet tab = 1 country, or 1 `Country - State`** (e.g., `japan`, `Japan - Tokyo`, `Japan - Osaka`).
- **Tab name** is mapped to `/<country>` and `/<country>/<state>`.
- Row 1 of each tab uses the following **16 columns** (`A1:P1`; the website adds missing ones such as `id` automatically):

| Column | Header | Example | Description |
| :--- | :--- | :--- | :--- |
| `A` | `day` | `1` | Day number (integer) |
| `B` | `date` | `2025-05-09` | Date in `YYYY-MM-DD` format |
| `C` | `day_title` | `Arrival in Sydney` | Title for the day |
| `D` | `time` | `09:30` | Activity time (`HH:MM`) |
| `E` | `title` | `Sydney Opera House` | Activity title |
| `F` | `description` | `Guided tour of the sails` | Activity description |
| `G` | `category` | `Attraction` | Optional: `Transport`, `Food`, `Lodging`, `Attraction`, `Shopping`, `Other` |
| `H` | `location_name` | `Bennelong Point` | Location display name |
| `I` | `maps_url` | `https://maps.google.com/...` | Google Maps URL |
| `J` | `price_amount` | `45` | Numeric cost |
| `K` | `price_currency` | `AUD` | ISO 4217 currency code (`JPY`, `AUD`, `KZT`, `CNY`, `TRY`, `MYR`, `USD`) |
| `L` | `price_notes` | `Per adult` | Optional price note |
| `M` | `note` | `Book 2 weeks ahead` | Optional tip or reminder |
| `N` | `images` | `/images/sydney.jpg` | Optional comma-separated image paths/URLs |
| `O` | `youtube_url` | `https://youtube.com/...` | Optional YouTube video link |
| `P` | `id` | `3f2a…` | Row id written by the website (used for edit/delete) |

---

## ☁️ Deploying to Vercel

Because `credentials/keys.json` is gitignored for security, configure the following **Environment Variables** in your **Vercel Project → Settings → Environment Variables**:

| Variable Name | Value |
| :--- | :--- |
| `GOOGLE_SHEET_ID` | Your Google Spreadsheet ID |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Paste the **entire contents** of `credentials/keys.json` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth Web client used for editor sign-in. **Required for editing** |
| `SITE_URL` | Public site origin (OAuth redirect base), e.g. `https://trips.example.com` |
| `ADMIN_WHATSAPP` | Admin WhatsApp number (digits with country code) for access requests |
| `AUTH_SECRET` | Random signing key for the session cookie (>= 16 chars, e.g. `openssl rand -base64 32`) |

> Set the variables for **Production and Preview**. After deploying run `npm run smoke -- https://<your-url>`: every line should be ✅ (writes refused without a session, security headers present). Netlify works the same way with the Astro Netlify adapter.

> **Alternative:** Instead of `GOOGLE_SERVICE_ACCOUNT_JSON`, you can set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` separately.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local development server with live Google Sheets fetching |
| `npm run build` | Build production bundle (`dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run sheets:setup` | Create the hidden `_users` / `_audit` tabs (optionally `-- you@gmail.com` to add the first editor) |
| `npm run sheets:pull` | Verify Google Sheets connection and print discovered country tabs |
| `npm test` | Unit tests (`node --test`, Node 22+) |
| `npm run verify` | Tests + production build (run before every commit) |
| `npm run smoke -- <url>` | Post-deploy security smoke test |
