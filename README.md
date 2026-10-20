# 🌍 Multi-Country Travel Itinerary & Budget Analytics

A modern, interactive **multi-country travel itinerary planner and financial analytics dashboard** built with **Astro**, **Preact**, **TypeScript**, and **Tailwind CSS**.

Designed around the **[Laws of UX](https://lawsofux.com/)**, it uses **Google Sheets as the Single Source of Truth** via a Service Account, where **one worksheet tab represents one country** and the **tab name defines the country name**, paired with live **multi-currency exchange conversion** and **spending analytics**.

---

## ✨ Key Features

### 1. Google Sheets as Single Source of Truth
- **Tabs = Countries and States**: Add a destination by creating a worksheet tab. A plain tab (e.g., `Japan`) is a country; a tab named `Country - State` (e.g., `Japan - Tokyo`, `Japan - Osaka`) becomes a state/city of that country. Routes: `/[country]`, `/[country]/itinerary` (all states), `/[country]/[state]`.
- **Travel tools** (`/[country]/[state]/tools`): prayer times for every trip date in the destination's local time with the local calculation method per country (AlAdhan API) plus Qibla direction, driven by the trip's confirmed location. No API keys needed.
- **Trip locations**: each trip's real place (lat/lng, timezone) is confirmed when adding a trip and stored in a hidden `_trips` worksheet (columns `tab, place, admin1, country, country_code, lat, lng, timezone`) — don't delete it.
- **Add & edit from the website**: `/add` creates a new tab and day-by-day activities (date + day title, then activities) straight into the sheet; activities can be edited/deleted, and trips renamed/deleted, with a confirmation modal before any delete. The service account needs **Editor** access to the sheet.
- **Zero-Dependency Service Account Client**: Authenticates with Google Sheets API v4 using an `RS256` OAuth 2.0 JWT signed via Node's built-in `node:crypto` (`src/utils/googleSheets.ts`)—no heavy SDKs or local `.json` data files required.
- **Live Sync & Refresh**: Every page load (and the in-app **Refresh from Google Sheets** button via `/api/sheets-sync`) reads directly from Google Sheets with built-in request deduplication and rate-limit retry backoff.

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
- **Animated Seasons**: Seven [Motion](https://motion.dev/)-animated themes (autumn, winter, spring, summer, rain, haze, starry night) chosen from a wheel-style picker, with translucent glass cards. Honors `prefers-reduced-motion`.
- **Mobile-first navigation**: slide-in drawer with collapsible country cards, 44px touch targets and a compact activity card.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Astro v5](https://astro.build/) |
| **UI Components** | [Preact](https://preactjs.com/) + TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
| **Animation** | [Motion](https://motion.dev/) |
| **Data Source** | Google Sheets API v4 (Service Account JWT — Single Source of Truth) |
| **Currency API** | [Frankfurter API](https://www.frankfurter.app/) & [Open Exchange Rates API](https://open.er-api.com/) |
| **PDF Generation** | `html2canvas` + `jspdf` |

---

## 📁 Project Structure

```text
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
│   │   ├── ThemeSwitcher.tsx          # Wheel-style season picker
│   │   ├── MobileNav.tsx              # Mobile slide-in navigation drawer
│   │   ├── AddItineraryForm.tsx       # Two-tab add form (trip, then days & activities)
│   │   ├── AnalogTimePicker.tsx       # Analog clock time picker
│   │   ├── ConfirmDialog.tsx          # Confirmation modal for destructive actions
│   │   ├── TripActions.tsx            # Add activities / rename / delete trip
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
│   │   ├── [country]/
│   │   │   ├── index.astro            # Country overview, schedule summary & analytics
│   │   │   ├── [state]/index.astro    # Single `Country - State` trip timeline
│   │   │   ├── [state]/tools.astro    # Travel tools (location + prayer times) for a state
│   │   │   ├── tools.astro            # Travel tools for a plain country tab
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

> **Alternative:** Instead of `GOOGLE_SERVICE_ACCOUNT_JSON`, you can set `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` separately.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local development server with live Google Sheets fetching |
| `npm run build` | Build production bundle (`dist/`) |
| `npm run preview` | Preview production build locally |
| `npm run sheets:pull` | Verify Google Sheets connection and print discovered country tabs |
