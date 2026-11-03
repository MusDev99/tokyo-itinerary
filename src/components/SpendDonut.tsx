import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { donutArcs } from '../utils/spendHistory';
import { compositorFrames, prefersReducedMotion } from '../utils/motion';

export interface DonutSlice {
  key: string;
  label: string;
  emoji: string;
  color: string;
  total: number;
  count: number;
}

interface Props {
  slices: DonutSlice[];
  total: number;
  money: (v: number) => string;
  /** Accessible summary of what the ring shows */
  title: string;
}

const R = 48;
const SW = 11; // lean: a slim ring
const SW_ON = 15; // the picked slice grows
const GAP = SW + 2; // rounded caps never touch

/**
 * Spend by category as a slim, rounded donut (SVG, no canvas). Tap or hover a slice, or a row in the list, to
 * pick it: the ring dims the others, grows the pick and the centre reads that category (Jakob: familiar donut;
 * Doherty: the response is a CSS transition under 200ms). Slices are for the eye; the list rows are the
 * keyboard / screen-reader controls, so the ring itself stays out of the tab order.
 * Only one SVG, one entrance animation (transform + opacity, compositor), no per-frame work afterwards.
 */
export default function SpendDonut({ slices, total, money, title }: Props) {
  // `picked` = chosen by tap/click (stays); `hover` = mouse preview only (leaves with the pointer). The view shows hover first.
  const [chosen, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const picked = hover ?? chosen;
  const ring = useRef<HTMLDivElement>(null);

  const { circumference, arcs } = useMemo(() => donutArcs(slices.map((s) => s.total), R, GAP), [slices]);
  const pick = picked ? slices.find((s) => s.key === picked) : undefined;
  // A category that disappears (home currency change, data refresh) must not stay "picked"
  useEffect(() => {
    if (chosen && !slices.some((x) => x.key === chosen)) setPicked(null);
  }, [chosen, slices]);

  useEffect(() => {
    if (!ring.current || prefersReducedMotion()) return;
    animate(ring.current, compositorFrames({ rotate: [-60, 0], scale: [0.88, 1], opacity: [0, 1] }), { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
  }, []);

  const toggle = (key: string) => setPicked((p) => (p === key ? null : key));
  const hoverOn = (key: string) => (e: PointerEvent) => e.pointerType === 'mouse' && setHover(key);
  const hoverOff = (e: PointerEvent) => e.pointerType === 'mouse' && setHover(null);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
      <div ref={ring} className="relative shrink-0 w-[208px] h-[208px] sm:w-[232px] sm:h-[232px]" style={{ filter: 'drop-shadow(0 10px 14px rgb(0 0 0 / 0.16))' }}>
        <svg viewBox="0 0 120 120" role="img" aria-label={title} className="w-full h-full -rotate-90" onClick={() => setPicked(null)}>
          <defs>
            {slices.map((s) => (
              <linearGradient key={s.key} id={`sd-${s.key}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${s.color} 62%, white)` }} />
                <stop offset="1" style={{ stopColor: s.color }} />
              </linearGradient>
            ))}
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth={SW} />
          {slices.map((s, i) => {
            const a = arcs[i];
            if (!a || a.len <= 0) return null;
            const on = picked === s.key;
            return (
              <circle
                key={s.key}
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke={`url(#sd-${s.key})`}
                strokeLinecap={arcs.filter((x) => x.len > 0).length > 1 ? 'round' : 'butt'}
                strokeDasharray={`${a.len} ${circumference - a.len}`}
                strokeDashoffset={-a.start}
                style={{
                  strokeWidth: on ? SW_ON : SW,
                  opacity: picked && !on ? 0.3 : 1,
                  transition: 'stroke-width 160ms ease-out, opacity 160ms ease-out',
                  cursor: 'pointer',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(s.key);
                }}
                onPointerEnter={hoverOn(s.key)}
                onPointerLeave={hoverOff}
              />
            );
          })}
        </svg>

        {/* Centre: the total, or the pick. Plain HTML so it is crisp, selectable and read by screen readers. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10 pointer-events-none" aria-live="polite">
          {pick ? (
            <>
              <span className="text-xl leading-none" aria-hidden="true">{pick.emoji}</span>
              <span className="mt-1 max-w-full truncate text-[11px] font-bold text-text/70">{pick.label}</span>
              <span className="text-lg font-extrabold text-text leading-tight">{money(pick.total)}</span>
              <span className="text-[11px] font-semibold text-text/60">{pct(pick.total)}% · {pick.count} {pick.count === 1 ? 'item' : 'items'}</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-bold uppercase tracking-wider text-text/55">Total spend</span>
              <span className="text-xl font-extrabold text-text leading-tight break-words">{money(total)}</span>
              <span className="text-[11px] text-text/55">tap a slice</span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1" aria-label="Categories">
        {slices.map((s) => {
          const on = picked === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(s.key)}
                onPointerEnter={hoverOn(s.key)}
                onPointerLeave={hoverOff}
                className={`touch-target focus-ring w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors active:scale-[0.99] ${
                  on ? 'bg-primary/15' : 'hover:bg-primary/10'
                } ${picked && !on ? 'opacity-60' : ''}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: s.color }} />
                  <span className="truncate font-semibold text-text/85">{s.emoji} {s.label}</span>
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="font-bold text-text">{money(s.total)}</span>
                  <span className="w-9 text-right font-semibold text-text/55">{pct(s.total)}%</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
