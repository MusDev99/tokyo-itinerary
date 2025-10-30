# Project Overview: Tokyo Trip Itinerary

This project is a modern, interactive itinerary planner for a Tokyo trip, built with Astro and Preact. It features a responsive and visually appealing UI powered by Tailwind CSS and is developed with TypeScript for type safety. The application allows users to view daily activities in a timeline format, search/filter items, and potentially download a PDF of the itinerary.

## Core Features

*   **Interactive Timeline**: Displays daily activities with location, price, notes, and optional images/YouTube links.
*   **Responsive Design**: Ensures usability across various devices.
*   **Modern UI**: Clean interface with smooth animations.
*   **Component-Based Architecture**: Utilizes reusable components for maintainability.
*   **TypeScript Support**: Enhances development experience with type safety.
*   **PDF Download**: Functionality to download the itinerary as a PDF.
*   **Search & Filter**: Components for searching and filtering itinerary items.
*   **Theme Switching**: Allows users to change the application's theme.
*   **Seasonal Backgrounds**: Dynamic backgrounds based on seasons.
*   **Japanese Dictionary**: A dedicated page for a Japanese dictionary.

## File Structure

### `src/pages/`
These are the main routes/pages of the application.
*   `404.astro`: The custom 404 "Not Found" error page.
*   `dictionary.astro`: Displays a Japanese dictionary, likely utilizing `jp_dictionary.json`.
*   `index.astro`: The homepage, serving as the main entry point for the itinerary display.
*   `japan.astro`: A page potentially offering general information about Japan or another view related to the trip.

### `src/components/`
Contains reusable UI components built with Preact (`.tsx`) or Astro (`.astro`).
*   `AnalyticsDashboard.tsx`: Likely displays analytics or summary data related to the itinerary.
*   `Banner.tsx`: A prominent display area, possibly for announcements or featured content.
*   `Countdown.tsx`: A countdown timer component.
*   `Footer.astro`: The site-wide footer, containing navigation links, company info, and social links.
*   `Header.astro`: The site-wide header, including navigation, theme switcher, and potentially user profile/notifications.
*   `PDFDownload.tsx`: Component responsible for initiating the PDF download of the itinerary.
*   `SearchFilter.tsx`: Provides search and filtering capabilities for itinerary items.
*   `SkeletonLoader.tsx`: A placeholder component displayed while content is loading.
*   `TabsNew.tsx`: A tabbed interface component for organizing content (e.g., by day).
*   `TechStack.tsx`: Displays the technologies used in the project.
*   `ThemeSwitcher.tsx`: Allows users to toggle between different themes (e.g., light/dark, seasonal).
*   `Timeline.tsx`: The main container for displaying the daily itinerary items.
*   `TimelineItem.tsx`: Represents a single event or activity within the `Timeline`.

### `src/layouts/`
Defines the overall structure and common elements for pages.
*   `Layout.astro`: The primary layout component that wraps most pages, typically including the `Header`, `Footer`, and handling global styling.

### `src/data/`
Stores static data used throughout the application.
*   `itineraryData.json`: The core data file containing the Tokyo trip itinerary, structured according to the `DayItinerary` and `TimelineItem` types defined in `itinerary.ts`.
*   `jp_dictionary.json`: A JSON file containing Japanese dictionary entries, used by the `dictionary.astro` page.

### `src/styles/`
Contains global and theme-specific CSS files.
*   `autumn-bg.css`, `spring-bg.css`, `summer-bg.css`, `winter-bg.css`: These files suggest dynamic background styling that changes based on the season or selected theme.
*   `global.css`: Contains global CSS rules and Tailwind CSS imports.

### `src/types/`
Defines TypeScript interfaces for data structures.
*   `itinerary.ts`: Defines the interfaces for the itinerary data:
    *   `Location`: `{ name: string; mapsUrl: string; }`
    *   `Price`: `{ amount: number; currency: string; notes?: string; }`
    *   `TimelineItem`: `{ time: string; title: string; description: string; location: Location; price: Price; note: string; images?: string; youtubeUrl?: string; }`
    *   `DayItinerary`: `{ day: number; title: string; date: string; items: TimelineItem[]; }`

## Key Technologies

*   **Astro**: The web framework for content-driven websites.
*   **Preact**: A fast, lightweight alternative to React, used for interactive UI components.
*   **TypeScript**: For type-safe code and improved developer experience.
*   **Tailwind CSS**: A utility-first CSS framework for rapid UI development.
*   **html2canvas & jspdf**: Libraries used for generating PDF documents from HTML content.
*   **react-icons**: A library providing popular icon sets.

## Development Commands

*   `npm install`: Installs project dependencies.
*   `npm run dev`: Starts the local development server.
*   `npm run build`: Builds the production-ready site.
*   `npm run preview`: Previews the built production site locally.
*   `npm run astro ...`: Runs Astro CLI commands.
