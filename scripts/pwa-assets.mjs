// Astro integration: lists the hashed client bundle (/_astro/*) in /sw-assets.json so the service worker
// can precache every island, chunk and stylesheet on install. Without it, pages saved for offline would
// render their HTML but lose interactive parts whose chunks were never loaded.
import { readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export default function pwaAssets() {
  return {
    name: 'pwa-assets',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(new URL('./', dir));
        const files = await readdir(new URL('./_astro/', dir)).catch(() => []);
        const assets = files.filter((f) => /\.(js|css|woff2?|svg|png|webp)$/.test(f)).map((f) => `/_astro/${f}`).sort();
        await writeFile(new URL('./sw-assets.json', dir), JSON.stringify(assets));
        logger.info(`sw-assets.json: ${assets.length} files in ${root}`);
      },
    },
  };
}
