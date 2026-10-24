// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  // Astro's built-in form-POST origin check compares the Origin header with the URL it rebuilds from the request.
  // Behind Vercel's proxy that URL is http://, so same-site form posts (e.g. sign out) were rejected with
  // "Cross-site POST form submissions are forbidden". CSRF is enforced by our own isSameOrigin() instead
  // (src/middleware.ts for every write API, and src/pages/api/logout.ts), which uses Sec-Fetch-Site / Origin host.
  security: { checkOrigin: false },
  integrations: [
    preact({
      compat: true,
      include: ['**/preact/*'],
    }),
  ],
  // Tailwind 3 runs through postcss.config.mjs (Vite picks it up); @astrojs/tailwind only supports Astro <= 5.
});
