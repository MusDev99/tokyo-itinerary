import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate, stagger } from 'motion';
import { PRAYERS, compassPoint, type DayTimings, type PrayerMethod } from '../utils/prayer';
import type { Place } from '../types/place';

interface Props {
  place: Place;
  /** ISO dates (YYYY-MM-DD) of the trip days, sorted */
  dates: string[];
}

interface ApiResult {
  method: PrayerMethod;
  timezone: string;
  qibla: number | null;
  days: DayTimings[];
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

const todayIn = (tz: string) => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

/** Prayer times for every trip date in the destination's local time + Qibla direction. */
export default function PrayerTimesCard({ place, dates }: Props) {
  const [data, setData] = useState<ApiResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const needle = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  const from = dates[0];
  const to = dates[dates.length - 1];

  useEffect(() => {
    if (!from) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lng),
      from,
      to,
      cc: place.country_code,
      tz: place.timezone,
    });
    fetch(`/api/prayer-times?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load prayer times');
        setData(body);
      })
      .catch((e) => e?.name !== 'AbortError' && setError(e?.message || 'Could not load prayer times'))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [place.lat, place.lng, place.timezone, from, to, attempt]);

  // Qibla needle swings to its bearing; day cards stagger in (Motion, skipped for reduced motion)
  useEffect(() => {
    if (!data || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (needle.current && data.qibla != null) {
      animate(needle.current, { rotate: [0, data.qibla] }, { type: 'spring', stiffness: 60, damping: 12 });
    }
    if (grid.current) {
      animate(grid.current.children, { opacity: [0, 1], y: [10, 0] }, { delay: stagger(0.04), duration: 0.3 });
    }
  }, [data]);

  const today = todayIn(place.timezone);
  const tripDays = new Set(dates);
  const days = (data?.days || []).filter((d) => tripDays.has(d.date));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-text">🕌 Prayer times</h3>
          <p className="text-xs text-text/70 mt-0.5">
            {data ? `Method: ${data.method.name} · times in ${place.name} local time (${place.timezone})` : 'Calculated for the trip dates'}
          </p>
        </div>

        {data?.qibla != null && (
          <div className="flex items-center gap-3 rounded-xl bg-white/45 border border-primary/15 px-3 py-2 self-start">
            <div className="relative w-12 h-12 rounded-full border-2 border-primary/30 bg-white/50 flex items-center justify-center" aria-hidden="true">
              <span className="absolute top-0.5 text-[9px] font-bold text-text/50">N</span>
              <div ref={needle} className="absolute inset-[5px] flex items-start justify-center" style={{ transformOrigin: '50% 50%' }}>
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[18px] border-l-transparent border-r-transparent border-b-primary" />
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-text/60" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-text">Qibla {Math.round(data.qibla)}° {compassPoint(data.qibla)}</div>
              <div className="text-[11px] text-text/60">Bearing from north, clockwise</div>
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid gap-2" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-white/40 animate-pulse" />)}
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-800 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={() => setAttempt((a) => a + 1)} className="touch-target px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold shrink-0">Retry</button>
        </div>
      )}

      {!loading && !error && days.length > 0 && (
        <div ref={grid} className="grid gap-2.5">
          {days.map((d) => (
            <div key={d.date} className={`rounded-xl border p-3 ${d.date === today ? 'bg-primary/15 border-primary' : 'bg-white/45 border-primary/15'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-extrabold text-text">{fmtDay(d.date)}</span>
                {d.date === today && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">Today</span>}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRAYERS.map((p) => (
                  <div key={p.key} className="rounded-lg bg-white/50 px-2 py-1.5 text-center">
                    <div className="text-[11px] font-semibold text-text/60">{p.label}</div>
                    <div className="text-sm font-extrabold text-text tabular-nums">{d[p.key]}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && days.length === 0 && <p className="text-sm text-text/70">No trip dates to show yet.</p>}
    </div>
  );
}
