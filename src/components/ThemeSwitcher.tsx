import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { animate, stagger } from 'motion';
import { SEASONS, readSavedSeason, type SeasonId } from '../utils/seasons';
import { prefersReducedMotion } from '../utils/motion';
import { useDismiss } from './useDismiss';

const FAB = 56; // px, floating button (Fitts's Law: large target in the bottom-right thumb zone)
const COLS = 4;

const GROUPS = [
  { id: 'season', label: 'Seasons' },
  { id: 'weather', label: 'Weather' },
] as const;

const spring = { type: 'spring', stiffness: 380, damping: 28 } as const;

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<SeasonId>('autumn');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const fabIcon = useRef<HTMLSpanElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const saved = readSavedSeason();
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Open: panel grows from the button, tiles stagger in; focus lands on the current theme
  useEffect(() => {
    if (!open || !panel.current) return;
    const tiles = Array.from(panel.current.querySelectorAll<HTMLElement>('[data-season]'));
    (tiles.find((t) => t.dataset.season === theme) || tiles[0])?.focus();
    if (prefersReducedMotion()) return;
    animate(panel.current, { opacity: [0, 1], scale: [0.85, 1], y: [12, 0] }, spring);
    animate(tiles, { opacity: [0, 1], y: [8, 0] }, { delay: stagger(0.025, { startDelay: 0.04 }), duration: 0.2 });
  }, [open]);

  const close = async (refocus = true) => {
    if (!open || closing.current) return;
    closing.current = true;
    if (!prefersReducedMotion() && panel.current) {
      await animate(panel.current, { opacity: [1, 0], scale: [1, 0.9], y: [0, 8] }, { duration: 0.15, ease: 'easeIn' }).finished;
    }
    setOpen(false);
    closing.current = false;
    if (refocus) fab.current?.focus();
  };

  useDismiss(open, [root], (reason) => close(reason === 'escape'));

  // The panel stays open after a pick so themes can be compared; the page re-themes instantly (Doherty Threshold)
  const choose = (id: SeasonId, tile: HTMLElement) => {
    if (id === theme) return;
    setTheme(id);
    try {
      localStorage.setItem('theme', id);
    } catch {
      /* private mode: theme still applies for this page */
    }
    document.documentElement.setAttribute('data-theme', id);
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: id } }));
    if (prefersReducedMotion()) return;
    animate(tile, { scale: [0.9, 1.06, 1] }, { duration: 0.3, ease: 'easeOut' });
    if (fabIcon.current) animate(fabIcon.current, { rotate: [0, 360], scale: [0.6, 1.15, 1] }, { duration: 0.6, ease: 'easeOut' });
  };

  // Arrow keys move through the tiles as a 4-column grid
  const onTileKey = (e: KeyboardEvent) => {
    const tiles = Array.from(panel.current!.querySelectorAll<HTMLElement>('[data-season]'));
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

  const active = SEASONS.find((s) => s.id === theme)!;

  return (
    <div ref={root} className="theme-switcher relative" style={{ width: `${FAB}px`, height: `${FAB}px` }}>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Choose a theme"
          onKeyDown={onTileKey}
          className="absolute right-0 rounded-2xl bg-surface-solid border border-primary/25 shadow-2xl p-3"
          style={{ bottom: `${FAB + 12}px`, width: 'min(304px, calc(100vw - 40px))', transformOrigin: 'bottom right' }}
        >
          <div className="mb-2 pl-1">
            <span className="text-sm font-extrabold text-text">Theme</span>
          </div>

          {/* Two labelled chunks instead of one long fan (Miller's Law); visible labels, no hover-only captions (Hick's Law) */}
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
      )}

      {/* Jakob's Law: one familiar floating button that opens a small menu above it */}
      <button
        ref={fab}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Theme: ${active.label}. Change theme`}
        onClick={() => (open ? close() : setOpen(true))}
        className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-xl border-2 border-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ width: `${FAB}px`, height: `${FAB}px` }}
      >
        <span ref={fabIcon} className="text-2xl inline-block" aria-hidden="true">{active.icon}</span>
      </button>
    </div>
  );
};

export default ThemeSwitcher;
