import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { prefersReducedMotion } from '../utils/motion';
import { dayRouteUrl, placeSearchUrl } from '../utils/mapsRoute';
import {
  EMPTY_LIVE, MAX_DELAY, formatMinutes, formatUntil, liveKey, localNow, parseLive, pickToday,
  type LiveState, type LiveStatus, type TimedItem, type TodayTrip, type TodayView,
} from '../utils/today';

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

function readLive(key: string): LiveState {
  try {
    return parseLive(localStorage.getItem(key));
  } catch {
    return EMPTY_LIVE; // storage blocked: check-ins still work for this visit
  }
}

const LATE_STEPS = [15, 30, 60];

/** Planned time, or "~~planned~~ shifted" once running late. */
function When({ it }: { it: TimedItem }) {
  if (it.start === it.planned) return <span className="tabular-nums">{formatMinutes(it.planned)}</span>;
  return (
    <span className="tabular-nums">
      <s className="text-text/45 font-semibold" aria-label={`planned ${formatMinutes(it.planned)}`}>{formatMinutes(it.planned)}</s>{' '}
      <span>{formatMinutes(it.start)}</span>
    </span>
  );
}

/**
 * "Today" card on the home page during a trip: what's on now, what's next and how to get there, from the
 * traveller's own clock (the server's date may be another timezone). Live day: tick activities done or
 * skipped and say "running late" to shift what's left. Saved on this device. Renders nothing outside trip days.
 */
export default function TodayCard({ trips }: Props) {
  const [now, setNow] = useState<{ iso: string; minutes: number } | null>(null);
  const [live, setLive] = useState<LiveState>(EMPTY_LIVE);
  const [toast, setToast] = useState<{ text: string; undo: LiveState } | null>(null);
  const card = useRef<HTMLElement>(null);
  const shown = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const tick = () => setNow(localNow(clock()));
    tick();
    // Minute precision is enough; 30s keeps "in N min" honest without busy work
    const timer = setInterval(tick, 30_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Which trip is "today" doesn't depend on check-ins, so find it first, then load that day's saved state
  const base: TodayView | null = now ? pickToday(trips, now.iso, now.minutes) : null;
  const storageKey = base && now ? liveKey(base.trip.href, now.iso) : '';
  useEffect(() => {
    if (storageKey) setLive(readLive(storageKey));
  }, [storageKey]);

  const view: TodayView | null = now && base ? pickToday([base.trip], now.iso, now.minutes, live) : null;

  useEffect(() => {
    if (!view || shown.current || !card.current) return;
    shown.current = true;
    if (!prefersReducedMotion()) animate(card.current, { opacity: [0, 1], y: [8, 0] }, { duration: 0.3, ease: 'easeOut' });
  }, [view]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  if (!view) return null;

  const save = (next: LiveState, text: string) => {
    setToast({ text, undo: live });
    setLive(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* private mode: keep it for this page */
    }
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  const undo = () => {
    if (!toast) return;
    const prev = toast.undo;
    setLive(prev);
    try {
      localStorage.setItem(storageKey, JSON.stringify(prev));
    } catch {
      /* ignore */
    }
    setToast(null);
  };
  const mark = (it: TimedItem, status: LiveStatus) =>
    save({ ...live, status: { ...live.status, [it.key]: status } }, `${status === 'done' ? 'Done' : 'Skipped'}: ${it.title}`);
  const late = (min: number) => {
    const delay = Math.min(MAX_DELAY, live.delay + min);
    save({ ...live, delay }, `Rest of today moved ${delay} min later`);
  };
  const onTime = () => save({ ...live, delay: 0 }, 'Back on the planned times');

  const { trip, day, current, next, minutesUntilNext, later, all, remaining, done, delay, tomorrow } = view;
  const route = dayRouteUrl(remaining.map((it) => ({ title: it.title, location: { name: it.place || it.title } })), trip.region);
  const dayHref = `${trip.href}?day=${day.day}`;

  const btn = 'touch-target inline-flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-extrabold transition-colors';
  const quiet = 'touch-target inline-flex items-center justify-center gap-1 px-3 rounded-xl text-xs font-bold transition-colors';

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

      {/* Goal-Gradient Effect: progress through the day */}
      {all.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-emerald-500/15 overflow-hidden" role="progressbar" aria-label="Today's progress" aria-valuemin={0} aria-valuemax={all.length} aria-valuenow={done}>
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${(done / all.length) * 100}%` }} />
          </div>
          <span className="text-xs font-bold text-text/65 tabular-nums">{done} of {all.length} done</span>
        </div>
      )}

      {current && (
        <div className="flex items-center gap-2 text-sm text-text/80">
          <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-900">Now</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="font-bold"><When it={current} /></span> {current.title}
          </span>
          {/* Fitts's Law: 44px targets right where the activity is named */}
          <button type="button" onClick={() => mark(current, 'done')} aria-label={`Mark ${current.title} done`} className={`${quiet} shrink-0 bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/25`}>
            ✓ Done
          </button>
        </div>
      )}

      {next ? (
        <div className="rounded-2xl bg-white/50 border border-primary/20 p-3.5 sm:p-4 space-y-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-primary" aria-live="polite">
              Next {minutesUntilNext !== null ? formatUntil(minutesUntilNext) : ''}
            </p>
            <p className="text-base sm:text-lg font-extrabold text-text leading-snug mt-0.5">
              <When it={next} /> · {next.title}
            </p>
            {next.place && <p className="text-xs sm:text-sm text-text/65 mt-0.5">📍 {next.place}</p>}
          </div>
          {/* Hick's Law: two primary actions on the go; Skip stays quiet */}
          <div className="flex flex-wrap gap-2">
            <a href={directions(next, trip.region)} target="_blank" rel="noopener noreferrer" className={`${btn} h-11 flex-1 sm:flex-none bg-primary text-white hover:opacity-95`}>
              <span aria-hidden="true">🧭</span> Directions
            </a>
            {route && route.stops > 1 && (
              <a href={route.url} target="_blank" rel="noopener noreferrer" className={`${btn} h-11 flex-1 sm:flex-none bg-primary/10 text-primary hover:bg-primary/20`}>
                <span aria-hidden="true">🗺️</span> Route<span className="hidden sm:inline">&nbsp;for the rest of today</span>
              </a>
            )}
            <button type="button" onClick={() => mark(next, 'skipped')} aria-label={`Skip ${next.title}`} className={`${quiet} h-11 text-text/60 hover:bg-text/5`}>
              ⏭ Skip
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/50 border border-primary/20 p-3.5 sm:p-4">
          <p className="text-sm font-bold text-text">{done > 0 ? `All done for today: ${done} of ${all.length} checked in. 🎉` : "That's everything planned for today. 🎉"}</p>
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
              <li key={it.key} className="flex items-baseline gap-2 text-sm">
                <span className="w-[8.5rem] shrink-0 font-bold text-text/70"><When it={it} /></span>
                <span className="min-w-0 truncate text-text">{it.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Running late: three presets instead of a time input (Hick's Law); only while something is left */}
      {next && (
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-primary/10">
          <span className="w-full sm:w-auto text-xs font-bold text-text/65 sm:mr-1">{delay ? `Running ${delay} min late · add more` : 'Running late? Push the rest of today back'}</span>
          {LATE_STEPS.map((m) => (
            <button key={m} type="button" onClick={() => late(m)} disabled={delay + m > MAX_DELAY} aria-label={`${m} minutes later`} className={`${quiet} bg-white/55 border border-primary/20 text-primary hover:bg-primary/10 disabled:opacity-40`}>
              +{m}
            </button>
          ))}
          {delay > 0 && (
            <button type="button" onClick={onTime} className={`${quiet} text-text/60 hover:bg-text/5`}>
              On time
            </button>
          )}
        </div>
      )}

      {/* Forgiving: every check-in can be undone for 5s (Doherty: instant feedback) */}
      <div aria-live="polite" className="empty:hidden">
        {toast && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-text/90 text-white px-3.5 py-1 text-sm">
            <span className="min-w-0 truncate">{toast.text}</span>
            <button type="button" onClick={undo} className="touch-target shrink-0 px-2 font-extrabold text-amber-300 hover:underline">
              Undo
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
