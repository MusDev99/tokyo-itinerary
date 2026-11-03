import { h } from 'preact';
import { useState } from 'preact/hooks';
import { animate } from 'motion';
import type { DayGroup } from '../utils/spendHistory';
import { compositorFrames, prefersReducedMotion } from '../utils/motion';
import { formatMoney } from '../utils/currencyInfo';

export interface HistoryCategory {
  emoji: string;
  color: string;
}

interface Props {
  groups: DayGroup[];
  /** Category look by key (round icon + tint) */
  categories: Record<string, HistoryCategory>;
  money: (v: number) => string;
  countryLabel?: (slug: string) => string;
}

/**
 * Daily spending as a history list, grouped by day (like a bank-app statement): a day bar with the date and the
 * day's total, then one row per payment with a round category icon, title, note, the amount and the time.
 * Law of Common Region: one band per day. Jakob: the familiar transaction list. Fitts: the whole day bar is the
 * 44px+ toggle. Days start open; collapsing one hides its rows (no re-render of the others).
 */
export default function SpendHistory({ groups, categories, money, countryLabel }: Props) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggle = (key: string, panel: HTMLElement | null) => {
    const wasClosed = closed.has(key);
    setClosed((prev) => {
      const next = new Set(prev);
      if (wasClosed) next.delete(key);
      else next.add(key);
      return next;
    });
    if (wasClosed && panel && !prefersReducedMotion()) {
      requestAnimationFrame(() => animate(panel, compositorFrames({ y: [-6, 0], opacity: [0, 1] }), { duration: 0.2, ease: 'easeOut' }));
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-white/40">
      <div className="flex items-center justify-between bg-primary px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white">
        <span>Details</span>
        <span>Amount</span>
      </div>

      {groups.map((g) => {
        const open = !closed.has(g.key);
        const where = [countryLabel ? countryLabel(g.country) : '', g.state].filter(Boolean).join(' · ');
        return (
          <section key={g.key} aria-label={`Day ${g.day}`}>
            <button
              type="button"
              aria-expanded={open}
              onClick={(e) => toggle(g.key, (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement | null)}
              className="touch-target focus-ring flex w-full items-center justify-between gap-3 bg-text/5 px-4 py-2.5 text-left transition-colors hover:bg-primary/10"
            >
              <span className="min-w-0 text-xs font-extrabold uppercase tracking-wide text-text/65">
                Day {g.day}{g.dateLabel ? ` · ${g.dateLabel}` : ''}
                {where && <span className="block truncate text-[10px] font-semibold normal-case tracking-normal text-text/50">{where}</span>}
              </span>
              <span className="flex items-center gap-2 whitespace-nowrap text-sm font-extrabold text-text">
                {money(g.total)}
                <svg className={`h-4 w-4 text-text/50 transition-transform duration-150 ${open ? '' : 'rotate-180'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 15l6-6 6 6" />
                </svg>
              </span>
            </button>

            <ul hidden={!open} className="bg-white/30">
              {g.lines.map((l, i) => {
                const cat = categories[l.categoryKey] ?? { emoji: '🏷️', color: '#4b5563' };
                return (
                  <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl"
                      style={{ background: `color-mix(in srgb, ${cat.color} 16%, transparent)` }}
                      aria-hidden="true"
                    >
                      {cat.emoji}
                    </span>
                    <div className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${i < g.lines.length - 1 ? 'border-b border-primary/10 pb-3 -mb-3' : ''}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-text">{l.title}</p>
                        {(l.description || l.note) && <p className="truncate text-xs text-text/60">{l.description || l.note}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-extrabold tabular-nums text-rose-600">−{money(l.converted)}</p>
                        <p className="text-[11px] tabular-nums text-text/55">
                          {[l.time, l.currency && formatMoney(l.amount, l.currency)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
