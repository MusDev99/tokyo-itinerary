# Tokyo Trip Itinerary

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/minimal)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/minimal)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/minimal/devcontainer.json)

A modern, interactive itinerary planner built with Astro and Preact, featuring a beautiful UI powered by Tailwind CSS.

## 🚀 Features

- **Interactive Timeline**: View your daily activities in a beautiful timeline format.
- **Prayer Time Dashboard**: An interactive, theme-aware clock displaying prayer times for different cities and dates in Japan.
- **Responsive Design**: Fully responsive layout that works on all devices.
- **Modern UI**: Clean and intuitive interface with smooth animations.
- **Component-Based**: Built with reusable components for easy maintenance.
- **TypeScript Support**: Full TypeScript integration for better development experience.

## 🛠️ Tech Stack

### Core Technologies
- [Astro](https://astro.build/) - The web framework for content-driven websites.
- [Preact](https://preactjs.com/) - Fast 3kB alternative to React.
- [TypeScript](https://www.typescriptlang.org/) - For type-safe code.
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework.
- **Canvas API**: Used for drawing the interactive prayer time clock.

### Key Dependencies
- `@astrojs/preact` - Preact integration for Astro.
- `@astrojs/tailwind` - Tailwind CSS integration for Astro.
- `react-icons` - for icons.
- `postcss` - CSS transformation tool.
- `autoprefixer` - PostCSS plugin for vendor prefixes.

## 📦 Project Structure

```
tokyo-itinerary/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── TabsNew.tsx
│   │   ├── Timeline.tsx
│   │   ├── TimelineItem.tsx
│   │   └── PrayerDashboard.tsx
│   ├── data/
│   │   ├── itineraryData.json
│   │   └── jp_prayer.json
│   ├── layouts/        # Page layouts
│   │   └── Layout.astro
│   ├── pages/          # Astro pages
│   │   ├── index.astro
│   │   └── prayer.astro
│   └── styles/         # Global styles
│       └── global.css
├── public/            # Static assets
├── astro.config.mjs   # Astro configuration
├── tailwind.config.mjs # Tailwind CSS configuration
├── postcss.config.mjs # PostCSS configuration
└── tsconfig.json     # TypeScript configuration
```

## 🎨 UI Components

### Header
- Sticky navigation with blur effect
- Responsive menu

### Footer
- Modern grid layout
- Navigation links

### Timeline
- Interactive day-by-day view
- Beautiful timeline visualization

### Prayer Dashboard
- Interactive prayer time clock built with Canvas.
- Theme-aware colors that adapt to the selected theme.
- City and date selectors to view prayer times across Japan.

### Tabs
- Smooth tab transitions
- Content organization by day

## 🚀 Getting Started

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

## 🎨 Styling

The project uses Tailwind CSS with a custom configuration that includes:
- Custom color palette for different themes (autumn, winter, spring, summer).
- Responsive breakpoints.
- Custom font family (Inter).

## 🎯 Future Improvements

- [ ] Add authentication system
- [ ] Implement user preferences
- [ ] Add more interactive features
- [ ] Enhance mobile experience
- [ ] Add offline support
- [ ] Implement sharing functionality

## 📄 License

MIT License - feel free to use this project for your own purposes.
