import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { SEASONS, readSavedSeason, type SeasonId } from '../utils/seasons';
import { prefersReducedMotion } from '../utils/motion';

const COLS = 4;
const GROUPS = [
  { id: 'season', label: 'Seasons' },
  { id: 'weather', label: 'Weather' },
] as const;

/** Current theme, kept in sync with <html data-theme>, localStorage and the `theme-changed` event. */
export function useTheme() {
  const [theme, setThemeState] = useState<SeasonId>('autumn');

  useEffect(() => {
    const saved = readSavedSeason();
    setThemeState(saved);
    document.documentElement.setAttribute('data-theme', saved);
    const onChange = (e: Event) => setThemeState((e as CustomEvent).detail?.theme ?? readSavedSeason());
    document.addEventListener('theme-changed', onChange);
    return () => document.removeEventListener('theme-changed', onChange);
  }, []);

  // The page re-themes instantly (Doherty Threshold)
  const setTheme = (id: SeasonId) => {
    setThemeState(id);
    try {
      localStorage.setItem('theme', id);
    } catch {
      /* private mode: the theme still applies for this page */
    }
    document.documentElement.setAttribute('data-theme', id);
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: id } }));
  };

  return { theme, setTheme, active: SEASONS.find((s) => s.id === theme) ?? SEASONS[0] };
}

/**
 * Season / weather tiles, two labelled chunks (Miller's Law) with visible labels (Hick's Law: no hover-only captions).
 * Lives inside the account menu (signed in) or the header theme button (guests). Arrow keys move over the grid.
 */
export default function ThemePicker({ theme, onPick }: { theme: SeasonId; onPick: (id: SeasonId) => void }) {
  const root = useRef<HTMLDivElement>(null);

  const choose = (id: SeasonId, tile: HTMLElement) => {
    if (id === theme) return;
    onPick(id);
    if (!prefersReducedMotion()) animate(tile, { scale: [0.9, 1.06, 1] }, { duration: 0.3, ease: 'easeOut' });
  };

  const onKey = (e: KeyboardEvent) => {
    const tiles = Array.from(root.current!.querySelectorAll<HTMLElement>('[data-season]'));
    const i = tiles.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const moves: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: Math.min(i + COLS, tiles.length - 1),
      ArrowUp: i - COLS,
      Home: 0,
      End: tiles.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    tiles[Math.max(0, Math.min(next, tiles.length - 1))]?.focus();
  };

  return (
    <div ref={root} onKeyDown={onKey}>
      {GROUPS.map((g) => (
        <div key={g.id} role="group" aria-labelledby={`theme-group-${g.id}`} className="mt-1 first-of-type:mt-0">
          <p id={`theme-group-${g.id}`} className="px-1 pt-1 pb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-text/55">
            {g.label}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {SEASONS.filter((s) => s.group === g.id).map((s) => {
              const isActive = s.id === theme;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-season={s.id}
                  aria-pressed={isActive}
                  onClick={(e) => choose(s.id, e.currentTarget as HTMLElement)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-h-[64px] px-1 rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isActive
                      ? 'bg-gradient-to-br from-primary to-accent text-white border-white/60 shadow-md'
                      : 'bg-primary/5 text-text border-transparent hover:bg-primary/15 hover:border-primary/30'
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{s.icon}</span>
                  <span className="text-[11px] font-bold leading-tight text-center">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
