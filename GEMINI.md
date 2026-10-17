# Project Overview: Multi-Country Travel Itinerary & Analytics

This project is a modern, interactive **multi-country travel itinerary planner and budget analytics web application** built with **Astro** and **Preact**. It features a responsive UI designed around the **[Laws of UX](https://lawsofux.com/)**, powered by **Tailwind CSS** and **TypeScript**, using **Google Sheets as the Single Source of Truth** via a Service Account and live **multi-currency exchange rate conversion**.

## Core Features

*   **Google Sheets Single Source of Truth**: All itinerary data is fetched directly from Google Sheets using a zero-dependency OAuth 2.0 Service Account (`RS256` JWT via `node:crypto`) client (`src/utils/googleSheets.ts`). There are no local `src/data/*.json` files.
*   **1 Tab = 1 Country Routing**: Automatically discovers countries from Google Sheets worksheet tabs (`src/utils/countries.ts`), where each worksheet tab represents one country and the **tab name defines the country name**, generating per-country overview (`/[country]`) and daily timeline (`/[country]/itinerary`) routes alongside a global portfolio homepage (`/`).
*   **Comprehensive Trip Analytics**: Multi-country and single-country financial breakdowns (`AnalyticsDashboard.tsx`, `src/utils/analytics.ts`), including 6-category activity classification (`Transport`, `Food`, `Lodging`, `Attraction`, `Shopping`, `Other`), daily burn rates, peak spend alerts, and paid vs. free activity ratios.
*   **Live & Historical Currency Exchange**: Real-time currency conversion and 30-day historical trend visualization (`CurrencyExchangeGraph.tsx`, `/api/currency-exchange.ts`) using public currency APIs (Frankfurter & Open ER-API).
*   **Laws of UX Interface Design**: Built applying Hick's Law (progressive disclosure on timeline items), Miller's Law (chunked KPI cards & category filters), Fitts's Law ($\ge 44\text{px}$ touch targets & sticky navigation), Jakob's Law, Von Restorff Effect, and Doherty Threshold.
*   **Interactive Timeline & Search/Filter**: Displays daily activities with expandable details, locations, Google Maps links, converted prices, notes, images, and YouTube embeds, with instant search and category filtering.
*   **PDF Export**: Generates downloadable PDF itineraries directly in the browser (`PDFDownload.tsx`).
*   **Theme Switching & Seasonal Backgrounds**: Supports dark/light modes and seasonal background themes (`spring`, `summer`, `autumn`, `winter`).

## File Structure

### `src/pages/`
Main routes and API endpoints of the application:
*   `index.astro`: Global travel portfolio dashboard comparing budgets, daily burn rates, and category spending across all countries discovered from Google Sheets.
*   `404.astro`: Custom 404 "Not Found" error page.
*   `[country]/index.astro`: Dynamic country overview page featuring daily schedule summary, country analytics dashboard, and live currency exchange graph.
*   `[country]/itinerary.astro`: Dynamic country day-by-day interactive timeline page with search, category filters, collapsible analytics, and PDF download.
*   `api/currency-exchange.ts`: API endpoint providing live exchange rates and 30-day historical time-series data with fallback support.
*   `api/sheets-sync.ts`: Server endpoint for checking Google Sheets connection status and triggering live cache refreshes from Google Sheets.

### `src/components/`
Reusable UI components built with Preact (`.tsx`) or Astro (`.astro`):
*   `AnalyticsDashboard.tsx`: Interactive financial analytics dashboard supporting both single-country and multi-country comparison modes with live currency conversion.
*   `Banner.tsx`: Prominent trip status banner.
*   `Countdown.tsx`: Trip countdown timer widget.
*   `CountrySubNav.astro`: Sticky sub-navigation bar for switching between a country's Overview and Itinerary Timeline views.
*   `CurrencyExchangeGraph.tsx`: Interactive SVG historical exchange rate chart and quick currency calculator.
*   `Footer.astro`: Site-wide footer.
*   `GoogleSheetsSyncBanner.tsx`: Interactive UI panel to inspect Google Sheets connection status and trigger live refreshes.
*   `Header.astro`: Site-wide sticky header featuring dynamic country navigation pills discovered from Google Sheets tabs.
*   `PDFDownload.tsx`: Client-side PDF generator for country itineraries.
*   `SearchFilter.tsx`: Search and category filtering component for itinerary items.
*   `SkeletonLoader.tsx`: Placeholder component displayed while async content loads.
*   `TabsNew.tsx`: Day-by-day navigation and container component coordinating filters, currency selection, and timeline rendering.
*   `TechStack.tsx`: Displays the technologies and architecture used in the project.
*   `ThemeSwitcher.tsx`: Toggles light/dark mode and seasonal themes.
*   `Timeline.tsx`: Container rendering a day's sequence of activities.
*   `TimelineItem.tsx`: Individual activity card implementing progressive disclosure for notes, locations, and media.

### `src/utils/`
Core business logic, data loaders, and API clients:
*   `countries.ts`: Discovers and loads country itineraries (`CountryMetadata`, `getAllCountriesWithSheets()`, `getActiveItinerariesMap()`) directly from Google Sheets worksheet tabs with in-memory deduplication and last-known-good caching.
*   `googleSheets.ts`: Zero-dependency Google Sheets API v4 client using Service Account JWT authentication (`credentials/keys.json` or `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY`). Handles reading the 15-column itinerary schema (`A1:O1`), batch fetching all country tabs, rate-limit retries, and CLI verification.
*   `analytics.ts`: Computes trip analytics (`computeCountryAnalytics()`, `computeGlobalAnalytics()`) and classifies activities into 6 standard categories (`classifyItem()`).
*   `currency.ts`: Currency metadata, symbols, formatting, and rate conversion utilities.
*   `url.ts`: Path helpers for resolving base URLs.

### `src/layouts/`
*   `Layout.astro`: Primary page layout wrapping pages with `Header`, `Footer`, meta tags, and theme initialization scripts.

### `src/styles/`
*   `autumn-bg.css`, `spring-bg.css`, `summer-bg.css`, `winter-bg.css`: Seasonal background animations and styles.
*   `global.css`: Global CSS rules, typography, and Tailwind CSS imports.

### `src/types/`
TypeScript interfaces in `src/types/itinerary.ts`:
*   `ActivityCategory`: `'Transport' | 'Food' | 'Lodging' | 'Attraction' | 'Shopping' | 'Other'`
*   `Location`: `{ name: string; mapsUrl?: string | null; }`
*   `Price`: `{ amount: number; currency: string; notes?: string; }`
*   `TimelineItem`: `{ time: string; title: string; description: string; location?: Location | null; price?: Price; note?: string; images?: string | string[] | null; youtubeUrl?: string | null; category?: ActivityCategory; }`
*   `DayItinerary`: `{ day: number; title: string; date: string; items: TimelineItem[]; }`

## Key Technologies

*   **Astro**: Web framework for fast, content-driven pages and API routes.
*   **Preact**: Lightweight reactive UI library for interactive islands.
*   **TypeScript**: End-to-end type safety across components, utilities, and API routes.
*   **Tailwind CSS**: Utility-first styling implementing Laws of UX visual hierarchy.
*   **Google Sheets API v4**: Cloud spreadsheet single source of truth authenticated via Node `crypto` RS256 Service Account JWTs.
*   **Frankfurter & Open ER-API**: Public exchange rate APIs for live and historical currency conversion.
*   **html2canvas & jspdf**: Client-side PDF itinerary generation.

## Development Commands

*   `npm install`: Installs project dependencies.
*   `npm run dev`: Starts the local development server.
*   `npm run build`: Builds the production-ready site.
*   `npm run preview`: Previews the built production site locally.
*   `npm run sheets:pull`: Verifies Google Sheets connectivity and lists all country tabs and activity counts.
