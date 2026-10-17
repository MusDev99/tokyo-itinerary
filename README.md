# 🌍 Multi-Country Travel Itinerary & Budget Analytics

A modern, interactive **multi-country travel itinerary planner and financial analytics dashboard** built with **Astro**, **Preact**, **TypeScript**, and **Tailwind CSS**.

Designed around the **[Laws of UX](https://lawsofux.com/)**, it uses **Google Sheets as the Single Source of Truth** via a Service Account, where **one worksheet tab represents one country** and the **tab name defines the country name**, paired with live **multi-currency exchange conversion** and **spending analytics**.

---

## ✨ Key Features

### 1. Google Sheets as Single Source of Truth
- **1 Tab = 1 Country**: Add a new destination simply by creating a new worksheet tab in your Google Spreadsheet (e.g., `Japan`, `Kazakhstan`, `Australia`, `China`, `Turkey`). The **tab name defines the country name** and automatically generates its URL slug (`/[country]` and `/[country]/itinerary`).
- **Zero-Dependency Service Account Client**: Authenticates with Google Sheets API v4 using an `RS256` OAuth 2.0 JWT signed via Node's built-in `node:crypto` (`src/utils/googleSheets.ts`)—no heavy SDKs or local `.json` data files required.
- **Live Sync & Refresh**: Every page load (and the in-app **Refresh from Google Sheets** button via `/api/sheets-sync`) reads directly from Google Sheets with built-in request deduplication and rate-limit retry backoff.

### 2. Comprehensive Trip Analytics & Currency Exchange
- **Global & Per-Country Analytics (`AnalyticsDashboard.tsx`)**:
  - Total trip cost, daily average burn rate, cost per activity, and paid vs. free activity ratios.
  - **6-Category Spending Breakdown**: Automatically classifies activities into `Transport`, `Food`, `Lodging`, `Attraction`, `Shopping`, and `Other` using explicit `category` cells or keyword heuristics.
  - **Daily Spending Profile & Peak Spend Alerts**: Visualizes highest-cost days and top individual expenses.
- **Live Multi-Currency Exchange (`CurrencyExchangeGraph.tsx` & `/api/currency-exchange`)**:
  - Instant conversion across major and regional currencies (`USD`, `EUR`, `GBP`, `SGD`, `MYR`, `JPY`, `KZT`, `AUD`, `CNY`, `TRY`, etc.).
  - Interactive historical exchange rate trend chart with 30-day high/low/average statistics powered by Frankfurter & Open ER-API.

### 3. UX-First Interface ([Laws of UX](https://lawsofux.com/))
- **Hick's Law & Progressive Disclosure**: Clean, scannable timeline cards that tuck secondary notes, maps, and media behind expandable sections.
- **Miller's Law**: Chunked KPI summary cards (max 4–5 metrics per group) and categorized filter pills.
- **Fitts's Law**: Touch-friendly interactive targets ($\ge 44\text{px}$), sticky day navigation pills, and quick action buttons.
- **Doherty Threshold**: Instant client-side filtering, search, currency switching, and skeleton loaders.
- **PDF Export**: Download printable country itineraries directly from the browser (`PDFDownload.tsx`).
- **Seasonal & Dark/Light Themes**: Dynamic seasonal background effects (`spring`, `summer`, `autumn`, `winter`) and dark mode persistence.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Astro v5](https://astro.build/) |
| **UI Components** | [Preact](https://preactjs.com/) + TypeScript |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) |
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
│   │   ├── ThemeSwitcher.tsx          # Light/Dark & seasonal theme selector
│   │   ├── Timeline.tsx               # Daily activity timeline container
│   │   └── TimelineItem.tsx           # Individual activity card (progressive disclosure)
│   ├── layouts/
│   │   └── Layout.astro               # Base HTML layout & theme initialization
│   ├── pages/
│   │   ├── index.astro                # Global portfolio dashboard & cross-country comparison
│   │   ├── 404.astro                  # Custom 404 page
│   │   ├── [country]/
│   │   │   ├── index.astro            # Country overview, schedule summary & analytics
│   │   │   └── itinerary.astro        # Interactive day-by-day country itinerary & PDF export
│   │   └── api/
│   │       ├── currency-exchange.ts   # Live & historical FX rate endpoint
│   │       └── sheets-sync.ts         # Google Sheets status & live refresh API endpoint
│   ├── styles/
│   │   ├── global.css                 # Global styles & design tokens
│   │   └── {spring,summer,autumn,winter}-bg.css
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
- **Each worksheet tab = 1 country** (e.g., `japan`, `kazakhstan`, `australia`, `china`, `turkey`).
- **Tab name = Country name** (automatically formatted and mapped to `/<slug>` and `/<slug>/itinerary`).
- Row 1 of each tab uses the following **15 columns** (`A1:O1`):

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
