# CLAUDE.md

Multi-country travel itinerary planner (Astro 5 SSR on Vercel + Preact + Tailwind). Google Sheets is the single source of truth. See `GEMINI.md` and `README.md` for the full feature tour.

## Commands

```bash
npm run dev      # dev server (http://localhost:4321)
npm run build    # production build (use this to type/compile check)
npm run preview  # preview the build
```

## Architecture

- **Data**: `src/utils/googleSheets.ts` reads/writes the spreadsheet with a service account (needs **Editor** access to write). `src/utils/countries.ts` turns tabs into countries/states.
- **Tabs**: tab name `Country - State` (e.g. `Japan - Tokyo`) = a state of a country; a plain tab (e.g. `japan`) = a country with no states.
- **Routes**: `/[country]`, `/[country]/itinerary` (all states merged), `/[country]/[state]`, `/add`, `/api/itinerary` (POST/PATCH/DELETE), `/api/sheets-sync`.
- **Writes** all go through `submitItinerary()` in `src/pages/api/itinerary.ts` (the seam for a future email-approval flow).
- Sheet columns are defined once in `SHEET_HEADERS` / `COLUMN_ALIASES` (`googleSheets.ts`); rows have a uuid `id` column used for edit/delete.

## Conventions

- Mobile-first: every page must work at 375px with no horizontal scroll. Containers that use `mx-auto` need `w-full` (they sit in a flex column).
- Match existing component style (Tailwind utility classes).
- **UI/UX: follow the [Laws of UX](https://lawsofux.com/)** for every new or changed screen (e.g. Hick's Law: progressive disclosure; Miller's Law: chunk content; Fitts's Law: touch targets of at least 44px; Jakob's Law: familiar patterns; Doherty Threshold: feedback under 400ms). Note the law applied in a short code comment where it drives a decision.
- **Animation: use [Motion](https://motion.dev/)** (the `motion` package) for animations and transitions instead of ad-hoc CSS/JS animation libraries. Keep animations subtle and purposeful, and respect `prefers-reduced-motion`.
- Never commit secrets: `credentials/` and `.env` stay out of git.

## Git workflow (required)

- **Never commit directly to `main`.** Create a branch first:
  - New feature → `feat/<feat-name>` (e.g. `feat/add-itinerary`)
  - Bug fix → `fix/<bug-name>` (e.g. `fix/mobile-overflow`)
  - Use short kebab-case names.
- Commit only when asked. Keep commits focused, with a clear imperative message.
- Push the branch to `origin` and merge via pull request.
- Run `npm run build` before committing and make sure it passes.
