/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        bg: 'color-mix(in srgb, var(--color-bg) calc(<alpha-value> * 100%), transparent)',
        text: 'color-mix(in srgb, var(--color-text) calc(<alpha-value> * 100%), transparent)',
        primary: 'color-mix(in srgb, var(--color-primary) calc(<alpha-value> * 100%), transparent)',
        secondary: 'color-mix(in srgb, var(--color-secondary) calc(<alpha-value> * 100%), transparent)',
        'surface-solid': 'var(--surface-solid)',
        accent: 'color-mix(in srgb, var(--color-accent) calc(<alpha-value> * 100%), transparent)',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};