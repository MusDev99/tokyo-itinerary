import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { prefersReducedMotion } from '../utils/motion';
import { dayRouteUrl, placeSearchUrl } from '../utils/mapsRoute';
import { formatTime12 } from '../utils/calendar';
import { formatUntil, localNow, pickToday, type TimedItem, type TodayTrip, type TodayView } from '../utils/today';

interface Props {
  trips: TodayTrip[];
}

/** Dev only: `?today=2026-10-18T10:00` previews the card on any date. */
function clock(): Date {
  if (import.meta.env.DEV) {
    const forced = new URLSearchParams(window.location.search).get('today');
    if (forced && !isNaN(new Date(forced).getTime())) return new Date(forced);
  }
  return new Date();
}

const directions = (it: TimedItem, region: string) => it.mapsUrl || placeSearchUrl(it.place || it.title, region);

/**
 * "Today" card on the home page during a trip: what's on now, what's next and how to get there, from the
 * traveller's own clock (the server's date may be another timezone). Renders nothing outside trip days.
 */
export default function TodayCard({ trips }: Props) {
  const [view, setView] = useState<TodayView | null>(null);
  const card = useRef<HTMLElement>(null);
  const shown = useRef(false);

  useEffect(() => {
    const update = () => {
      const { iso, minutes } = localNow(clock());
      setView(pickToday(trips, iso, minutes));
    };
    update();
    // Minute precision is enough; 30s keeps "in N min" honest without busy work
    const timer = setInterval(update, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && update();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [trips]);

  useEffect(() => {
    if (!view || shown.current || !card.current) return;
    shown.current = true;
    if (!prefersReducedMotion()) animate(card.current, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, ease: 'easeOut' });
  }, [view]);

  if (!view) return null;
  const { trip, day, current, next, minutesUntilNext, later, all, tomorrow } = view;
  const route = dayRouteUrl(all.map((it) => ({ title: it.title, location: { name: it.place || it.title } })), trip.region);
  const dayHref = `${trip.href}?day=${day.day}`;
  const time = (t: string) => formatTime12(t) || t;

  const btn = 'touch-target inline-flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-extrabold transition-colors';

  return (
    // Serial Position + Von Restorff: during a trip the most useful thing comes first and stands out
    <section ref={card} aria-labelledby="today-title" className="glass-effect rounded-2xl sm:rounded-3xl p-4 sm:p-6 mb-6 sm:mb-8 border border-emerald-500/40 shadow-md space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Today · Day {day.day}
          </p>
          <h2 id="today-title" className="text-lg sm:text-2xl font-extrabold text-text leading-tight mt-1">
            <span aria-hidden="true">{trip.flag}</span> {day.title}
          </h2>
          <p className="text-xs sm:text-sm text-text/65">{trip.name}</p>
        </div>
        <a href={dayHref} className="touch-target shrink-0 inline-flex items-center gap-1 px-3 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20">
          Full day <span aria-hidden="true">→</span>
        </a>
      </div>

      {current && (
        <p className="flex items-center gap-2 text-sm text-text/80">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-900">Now</span>
          <span className="font-bold tabular-nums">{time(current.time)}</span>
          <span className="truncate">{current.title}</span>
        </p>
      )}

      {next ? (
        <div className="rounded-2xl bg-white/50 border border-primary/20 p-3.5 sm:p-4 space-y-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-primary" aria-live="polite">
              Next {minutesUntilNext !== null ? formatUntil(minutesUntilNext) : ''}
            </p>
            <p className="text-base sm:text-lg font-extrabold text-text leading-snug mt-0.5">
              <span className="tabular-nums">{time(next.time)}</span> · {next.title}
            </p>
            {next.place && <p className="text-xs sm:text-sm text-text/65 mt-0.5">📍 {next.place}</p>}
          </div>
          {/* Fitts's Law: the two actions people reach for on the go, full-width side by side on phones */}
          <div className="grid grid-cols-2 sm:flex gap-2">
            <a href={directions(next, trip.region)} target="_blank" rel="noopener noreferrer" className={`${btn} h-11 bg-primary text-white hover:opacity-95`}>
              <span aria-hidden="true">🧭</span> Directions
            </a>
            {route && route.stops > 1 && (
              <a href={route.url} target="_blank" rel="noopener noreferrer" className={`${btn} h-11 bg-primary/10 text-primary hover:bg-primary/20`}>
                <span aria-hidden="true">🗺️</span> Route<span className="hidden sm:inline">&nbsp;for today</span>
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/50 border border-primary/20 p-3.5 sm:p-4">
          <p className="text-sm font-bold text-text">That's everything planned for today. 🎉</p>
          {tomorrow && (
            <a href={`${trip.href}?day=${tomorrow.day}`} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline">
              Tomorrow: Day {tomorrow.day} · {tomorrow.title} <span aria-hidden="true">→</span>
            </a>
          )}
        </div>
      )}

      {later.length > 0 && (
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wide text-text/55 mb-1.5">Later today</h3>
          <ul className="space-y-1">
            {later.map((it) => (
              <li key={`${it.start}-${it.title}`} className="flex items-baseline gap-2 text-sm">
                <span className="w-[4.5rem] shrink-0 font-bold tabular-nums text-text/70">{time(it.time)}</span>
                <span className="min-w-0 truncate text-text">{it.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
