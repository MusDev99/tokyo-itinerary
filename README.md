# Tokyo Trip Itinerary

A modern, interactive itinerary planner built with Astro and Preact, featuring a beautiful UI powered by Tailwind CSS.

## 🚀 Features

- **Interactive Timeline**: View your daily activities in a beautiful timeline format
- **Responsive Design**: Fully responsive layout that works on all devices
- **Modern UI**: Clean and intuitive interface with smooth animations
- **Component-Based**: Built with reusable components for easy maintenance
- **TypeScript Support**: Full TypeScript integration for better development experience

## 🛠️ Tech Stack

### Core Technologies
- [Astro](https://astro.build/) (v5.8.1) - The web framework for content-driven websites
- [Preact](https://preactjs.com/) (v10.26.8) - Fast 3kB alternative to React
- [TypeScript](https://www.typescriptlang.org/) - For type-safe code
- [Tailwind CSS](https://tailwindcss.com/) (v3.4.1) - Utility-first CSS framework

### Key Dependencies
- `@astrojs/preact` (v4.1.0) - Preact integration for Astro
- `@astrojs/tailwind` (v5.1.0) - Tailwind CSS integration for Astro
- `postcss` (v8.4.35) - CSS transformation tool
- `autoprefixer` (v10.4.17) - PostCSS plugin for vendor prefixes

## 📦 Project Structure

```
tokyo-itinerary/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── TabsNew.tsx
│   │   ├── Timeline.tsx
│   │   └── TimelineItem.tsx
│   ├── layouts/        # Page layouts
│   │   └── Layout.astro
│   ├── pages/          # Astro pages
│   │   └── index.astro
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
- User profile section
- Notification system

### Footer
- Modern grid layout
- Navigation links
- Company information
- Social links

### Timeline
- Interactive day-by-day view
- Beautiful timeline visualization
- Location information
- Image support for activities

### Tabs
- Smooth tab transitions
- Responsive design
- Content organization by day

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```

## 🎯 Development

- **Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Preview**: `npm run preview`

## 🎨 Styling

The project uses Tailwind CSS with a custom configuration that includes:
- Custom color palette
- Responsive breakpoints
- Custom font family (Inter)
- Utility classes for common patterns

## 🔧 Configuration Files

### Tailwind Configuration
- Custom colors
- Extended theme
- Content paths
- Font family configuration

### PostCSS Configuration
- Tailwind CSS plugin
- Autoprefixer
- Custom plugins support

### TypeScript Configuration
- Strict mode enabled
- JSX support
- Module resolution
- Path aliases

## 📱 Responsive Design

The application is fully responsive with breakpoints for:
- Mobile devices
- Tablets
- Desktop screens
- Large displays

## 🎯 Future Improvements

- [ ] Add authentication system
- [ ] Implement user preferences
- [ ] Add more interactive features
- [ ] Enhance mobile experience
- [ ] Add offline support
- [ ] Implement sharing functionality

## 📄 License

MIT License - feel free to use this project for your own purposes.

```sh
npm create astro@latest -- --template minimal
```

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/withastro/astro/tree/latest/examples/minimal)
[![Open with CodeSandbox](https://assets.codesandbox.io/github/button-edit-lime.svg)](https://codesandbox.io/p/sandbox/github/withastro/astro/tree/latest/examples/minimal)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/withastro/astro?devcontainer_path=.devcontainer/minimal/devcontainer.json)

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
├── src/
│   └── pages/
│       └── index.astro
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
