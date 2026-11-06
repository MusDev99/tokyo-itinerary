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
        danger: { DEFAULT: 'color-mix(in srgb, var(--color-danger) calc(<alpha-value> * 100%), transparent)', strong: 'color-mix(in srgb, var(--color-danger-strong) calc(<alpha-value> * 100%), transparent)', solid: 'color-mix(in srgb, var(--color-danger-solid) calc(<alpha-value> * 100%), transparent)' },
        success: { DEFAULT: 'color-mix(in srgb, var(--color-success) calc(<alpha-value> * 100%), transparent)', strong: 'color-mix(in srgb, var(--color-success-strong) calc(<alpha-value> * 100%), transparent)', solid: 'color-mix(in srgb, var(--color-success-solid) calc(<alpha-value> * 100%), transparent)' },
        warning: { DEFAULT: 'color-mix(in srgb, var(--color-warning) calc(<alpha-value> * 100%), transparent)', strong: 'color-mix(in srgb, var(--color-warning-strong) calc(<alpha-value> * 100%), transparent)' },
        accent: 'color-mix(in srgb, var(--color-accent) calc(<alpha-value> * 100%), transparent)',
      },
      fontSize: {
        // The smallest text we allow (badges, hints): 11px. No 9px/10px.
        micro: ['0.6875rem', { lineHeight: '1rem' }],
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};