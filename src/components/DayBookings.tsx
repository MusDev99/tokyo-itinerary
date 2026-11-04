import { h } from 'preact';
import type { DayCard } from '../utils/pocket';

const ICON: Record<DayCard['variant'], string> = { depart: '✈️', arrive: '🛬', checkin: '🏨', checkout: '🧳' };

function label(c: DayCard): string {
  const { item, variant } = c;
  if (item.kind === 'flight') {
    const route = item.from || item.to ? ` · ${item.from} → ${item.to}` : '';
    return `${variant === 'arrive' ? 'Arrives' : 'Flight'} ${item.title}${route}`;
  }
  return `${variant === 'checkout' ? 'Check-out' : 'Check-in'} · ${item.title}`;
}

/**
 * Flights and stays from the trip's Pocket, shown on their day (read-only; edit them in Pocket).
 * Only rendered for signed-in editors: the data is fetched client-side, never part of the page HTML.
 */
export default function DayBookings({ cards, pocketHref }: { cards: DayCard[]; pocketHref: string }) {
  if (cards.length === 0) return null;
  return (
    <ul aria-label="Bookings for this day" className="space-y-2">
      {cards.map((c) => (
        <li key={`${c.item.id}-${c.variant}`}>
          <a href={`${pocketHref}#${c.item.id}`}
            className="touch-target flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 px-3 py-2.5 hover:bg-primary/10 transition-colors">
            <span className="text-xl" aria-hidden="true">{ICON[c.variant]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-text truncate">{label(c)}</span>
              <span className="block text-[11px] font-semibold text-text/60">
                {[c.time, c.item.details.terminal && `Terminal ${c.item.details.terminal}`, c.item.details.address].filter(Boolean).join(' · ') || 'In your Pocket'}
              </span>
            </span>
            <span className="text-xs font-bold text-primary shrink-0" aria-hidden="true">Pocket →</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
