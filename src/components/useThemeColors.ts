import { useEffect, useState } from 'preact/hooks';

export interface ThemeColors {
  text: string;
  primary: string;
  accent: string;
}

const FALLBACK: ThemeColors = { text: '#451a03', primary: '#d97706', accent: '#b45309' };

function read(): ThemeColors {
  if (typeof document === 'undefined') return FALLBACK;
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  return {
    text: get('--color-text', FALLBACK.text),
    primary: get('--color-primary', FALLBACK.primary),
    accent: get('--color-accent', FALLBACK.accent),
  };
}

/** Current season colors for charts; updates when the season changes. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);
  useEffect(() => {
    setColors(read());
    const onTheme = () => setTimeout(() => setColors(read()), 60);
    document.addEventListener('theme-changed', onTheme);
    return () => document.removeEventListener('theme-changed', onTheme);
  }, []);
  return colors;
}
