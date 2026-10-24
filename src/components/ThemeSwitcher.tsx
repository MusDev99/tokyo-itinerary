import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { animate, stagger } from 'motion';
import { SEASONS, readSavedSeason, type SeasonId } from '../utils/seasons';
import { prefersReducedMotion } from '../utils/motion';

const FAB = 56; // px, floating button
const ITEM = 48; // px, season button (>= 44px touch target)
const RADIUS = 180;
const SPAN = 90; // degrees: wheel fans from "up" to "left" of the button

const spring = { type: 'spring', stiffness: 320, damping: 22 } as const;

/** Position of the i-th season on the arc, relative to the FAB center (math angle: 90° = up, 180° = left). */
function polar(i: number, total: number) {
  const angle = ((180 - (i * SPAN) / (total - 1)) * Math.PI) / 180;
  return { x: RADIUS * Math.cos(angle), y: -RADIUS * Math.sin(angle) };
}

const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<SeasonId>('autumn');
  const [visible, setVisible] = useState(false);
  const [caption, setCaption] = useState('');
  const wheel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const fabIcon = useRef<HTMLSpanElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    const saved = readSavedSeason();
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  // Open animation: wheel spins in, items stagger out from the button
  useEffect(() => {
    if (!visible) return;
    const el = wheel.current;
    if (!el) return;
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-season]'));
    const current = items.find((b) => b.dataset.season === theme) || items[0];
    current?.focus();
    if (prefersReducedMotion()) return;
    animate(backdrop.current!, { opacity: [0, 1] }, { duration: 0.25 });
    animate(el, { rotate: [-90, 0], scale: [0.3, 1], opacity: [0, 1] }, spring);
    animate(items, { scale: [0, 1], opacity: [0, 1] }, { delay: stagger(0.05, { startDelay: 0.05 }), ...spring });
  }, [visible]);

  const close = async (refocus = true) => {
    if (!visible || closing.current) return;
    closing.current = true;
    if (!prefersReducedMotion() && wheel.current) {
      await Promise.all([
        animate(wheel.current, { rotate: [0, 70], scale: [1, 0.3], opacity: [1, 0] }, { duration: 0.28, ease: 'easeIn' }).finished,
        animate(backdrop.current!, { opacity: [1, 0] }, { duration: 0.25 }).finished,
      ]);
    }
    setVisible(false);
    closing.current = false;
    setCaption('');
    if (refocus) fab.current?.focus();
  };

  const choose = (id: SeasonId) => {
    setTheme(id);
    localStorage.setItem('theme', id);
    document.documentElement.setAttribute('data-theme', id);
    document.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: id } }));
    if (!prefersReducedMotion() && fabIcon.current) {
      animate(fabIcon.current, { rotate: [0, 360], scale: [0.6, 1.15, 1] }, { duration: 0.6, ease: 'easeOut' });
    }
    close();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? -1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const items = Array.from(wheel.current!.querySelectorAll<HTMLElement>('[data-season]'));
    const idx = items.indexOf(document.activeElement as HTMLElement);
    items[(idx + dir + items.length) % items.length]?.focus();
  };

  const active = SEASONS.find((s) => s.id === theme)!;
  const capPos = polar(3, SEASONS.length);

  return (
    <div className="theme-switcher relative" style={{ width: `${FAB}px`, height: `${FAB}px` }} onKeyDown={visible ? onKeyDown : undefined}>
      {visible && (
        <div
          ref={backdrop}
          className="fixed inset-0 -z-10 bg-black/20"
          onPointerDown={() => close(false)}
          aria-hidden="true"
        />
      )}

      {visible && (
        <div
          ref={wheel}
          role="menu"
          aria-label="Choose a season"
          className="absolute"
          style={{ left: `${FAB / 2}px`, top: `${FAB / 2}px`, width: 0, height: 0, transformOrigin: '0 0' }}
        >
          {/* Wheel face: translucent glass sector behind the buttons */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: `-${RADIUS + 50}px`, top: `-${RADIUS + 50}px` }}
            width={RADIUS + 50}
            height={RADIUS + 50}
            viewBox={`0 0 ${RADIUS + 50} ${RADIUS + 50}`}
            aria-hidden="true"
          >
            <path
              d={`M ${RADIUS + 50} ${RADIUS + 50} L ${RADIUS + 50} 0 A ${RADIUS + 50} ${RADIUS + 50} 0 0 0 0 ${RADIUS + 50} Z`}
              fill="rgba(255,255,255,0.22)"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1.5"
            />
            <path
              d={`M ${RADIUS + 50} ${50} A ${RADIUS} ${RADIUS} 0 0 0 ${50} ${RADIUS + 50}`}
              fill="none"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="1.5"
              strokeDasharray="3 7"
              strokeLinecap="round"
            />
          </svg>

          {/* Caption of the hovered / focused season */}
          <div
            className="absolute px-3 py-1 rounded-full bg-surface-solid text-text text-xs font-bold shadow-lg whitespace-nowrap pointer-events-none -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${capPos.x * 0.55}px`, top: `${capPos.y * 0.55}px`, opacity: caption ? 1 : 0, transition: 'opacity .15s' }}
          >
            {caption || ' '}
          </div>

          {SEASONS.map((s, i) => {
            const p = polar(i, SEASONS.length);
            const isActive = s.id === theme;
            return (
              <button
                key={s.id}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                aria-label={s.label}
                data-season={s.id}
                onClick={() => choose(s.id)}
                onPointerEnter={() => setCaption(s.label)}
                onFocus={() => setCaption(s.label)}
                onPointerLeave={() => setCaption('')}
                className={`absolute flex items-center justify-center rounded-full text-2xl shadow-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-gradient-to-br from-primary to-accent border-white/70'
                    : 'bg-surface-solid border-primary/25 hover:border-primary/60'
                }`}
                style={{ width: `${ITEM}px`, height: `${ITEM}px`, left: `${p.x - ITEM / 2}px`, top: `${p.y - ITEM / 2}px` }}
              >
                <span aria-hidden="true">{s.icon}</span>
              </button>
            );
          })}
        </div>
      )}

      <button
        ref={fab}
        type="button"
        aria-haspopup="menu"
        aria-expanded={visible}
        aria-label={`Season: ${active.label}. Change season`}
        onClick={() => (visible ? close() : setVisible(true))}
        className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white shadow-xl border-2 border-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        style={{ width: `${FAB}px`, height: `${FAB}px` }}
      >
        <span ref={fabIcon} className="text-2xl inline-block" aria-hidden="true">{active.icon}</span>
      </button>
    </div>
  );
};

export default ThemeSwitcher;
