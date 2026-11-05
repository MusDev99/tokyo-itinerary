import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORIES } from '../utils/analytics';
import { normTitle, type Suggestion } from '../utils/suggestions';
import { formatLongDate } from '../utils/calendar';
import { inputClass } from './inputClass';

export type StartMode = 'blank' | 'copy' | 'suggest';

/** A trip offered for copying: just what the picker needs (the full rows stay on the server). */
export interface CopyTrip {
  slug: string;
  title: string;
  country: string;
  cities: string[];
  start: string;
  end: string;
  days: Array<{ date: string; title: string; items: number }>;
}

const MODES: Array<{ id: StartMode; icon: string; label: string; hint: string }> = [
  { id: 'blank', icon: '✍️', label: 'From scratch', hint: 'Start empty' },
  { id: 'copy', icon: '📋', label: 'Copy a trip', hint: 'Reuse a plan' },
  { id: 'suggest', icon: '💡', label: 'Suggestions', hint: 'From past trips' },
];

/** "How do you want to start?" Hick's Law: three plain choices, the picker for the chosen one opens below. */
export function ModeSwitch({ mode, onMode }: { mode: StartMode; onMode: (m: StartMode) => void }) {
  return (
    <div role="radiogroup" aria-label="How do you want to start?" className="grid grid-cols-3 gap-2">
      {MODES.map((m) => (
        <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} onClick={() => onMode(m.id)}
          className={`touch-target min-h-[72px] rounded-2xl border-2 px-2 py-2 text-center transition-colors ${
            mode === m.id ? 'bg-primary text-white border-primary shadow-md' : 'bg-white/60 border-primary/25 text-text hover:border-primary/60'
          }`}>
          <span className="block text-xl leading-none" aria-hidden="true">{m.icon}</span>
          <span className="block text-xs font-extrabold mt-1 leading-tight">{m.label}</span>
          <span className={`block text-[10px] leading-tight ${mode === m.id ? 'text-white/80' : 'text-text/55'}`}>{m.hint}</span>
        </button>
      ))}
    </div>
  );
}

const chip = (on: boolean) =>
  `touch-target shrink-0 px-3 h-11 rounded-full border-2 text-xs font-bold transition-colors ${
    on ? 'bg-primary text-white border-primary' : 'bg-white/60 border-primary/25 text-text hover:border-primary/60'
  }`;

interface CopyProps {
  trips: CopyTrip[];
  source: CopyTrip | null;
  onSource: (t: CopyTrip | null) => void;
  /** ISO dates of the source days to copy */
  selected: string[];
  onSelected: (dates: string[]) => void;
  prices: boolean;
  onPrices: (v: boolean) => void;
}

/** Pick a trip, then which of its days to copy (all by default). */
export function CopyPicker({ trips, source, onSource, selected, onSelected, prices, onPrices }: CopyProps) {
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const list = useMemo(() => {
    const n = normTitle(q);
    return trips.filter((t) => !n || normTitle(`${t.title} ${t.cities.join(' ')} ${t.country}`).includes(n));
  }, [trips, q]);
  const shown = q || showAll ? list : list.slice(0, 6);

  if (source) {
    const chosen = new Set(selected);
    const count = source.days.filter((d) => chosen.has(d.date)).reduce((n, d) => n + d.items, 0);
    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2 rounded-xl bg-white/50 border border-primary/20 p-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text break-words">{source.title}</p>
            <p className="text-xs text-text/70">{[source.cities.join(' → '), source.country].filter(Boolean).join(' · ')}</p>
          </div>
          <button type="button" onClick={() => onSource(null)} className="touch-target shrink-0 px-3 text-xs font-bold text-primary">Change</button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-text/80">Days to copy <span className="text-primary">({selected.length}/{source.days.length})</span></p>
          <div className="flex gap-1">
            <button type="button" className="touch-target px-2 text-xs font-bold text-primary" onClick={() => onSelected(source.days.map((d) => d.date))}>All</button>
            <button type="button" className="touch-target px-2 text-xs font-bold text-primary" onClick={() => onSelected([])}>None</button>
          </div>
        </div>
        <ul className="max-h-[40vh] overflow-y-auto overscroll-contain rounded-xl border border-primary/15 divide-y divide-primary/10 bg-white/40">
          {source.days.map((d, i) => {
            const on = chosen.has(d.date);
            return (
              <li key={d.date}>
                <label className="touch-target flex items-center gap-3 px-3 py-2 cursor-pointer min-h-[48px]">
                  <input type="checkbox" className="w-5 h-5 shrink-0" checked={on}
                    onChange={() => onSelected(on ? selected.filter((x) => x !== d.date) : [...selected, d.date])} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-text truncate">Day {i + 1} · {d.title && !/^day \d+$/i.test(d.title) ? d.title : formatLongDate(d.date)}</span>
                    <span className="block text-[11px] text-text/60">{formatLongDate(d.date)}</span>
                  </span>
                  <span className="text-xs font-bold text-primary shrink-0">{d.items} {d.items === 1 ? 'place' : 'places'}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <label className="touch-target flex items-center gap-3 text-sm font-bold text-text">
          <input type="checkbox" className="w-5 h-5" checked={prices} onChange={(e) => onPrices((e.target as HTMLInputElement).checked)} />
          Copy prices too
        </label>
        <p className="text-[11px] text-text/60">{count} {count === 1 ? 'place' : 'places'} will be copied. Notes, photos and videos stay behind.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor="cp-q" className="sr-only">Search trips</label>
      <input id="cp-q" type="search" className={inputClass} placeholder="Search trips, cities, countries" autoComplete="off"
        value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      {list.length === 0 && <p role="status" className="py-4 text-center text-sm text-text/60">No trip matches.</p>}
      <ul className="space-y-2">
        {shown.map((t) => (
          <li key={t.slug}>
            <button type="button" onClick={() => { onSource(t); onSelected(t.days.map((d) => d.date)); }}
              className="touch-target w-full text-left rounded-xl bg-white/50 border border-primary/20 hover:border-primary/50 px-3 py-2.5">
              <span className="block text-sm font-extrabold text-text truncate">{t.title}</span>
              <span className="block text-xs text-text/65 truncate">
                {[t.cities.join(' → '), t.country].filter(Boolean).join(' · ')} · {t.days.length} {t.days.length === 1 ? 'day' : 'days'}{t.start ? ` · ${formatLongDate(t.start)}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!q && !showAll && list.length > 6 && (
        <button type="button" onClick={() => setShowAll(true)} className="touch-target w-full rounded-xl border-2 border-dashed border-primary/35 text-sm font-bold text-primary">
          Show all {list.length} trips
        </button>
      )}
    </div>
  );
}

interface SuggestProps {
  picks: Suggestion[];
  onPicks: (p: Suggestion[]) => void;
  /** Start the city filter on this value (the trip's first city, when known) */
  initialCity?: string;
}

const MAX_PICKS = 60;

/** Places other trips already used, most used first. Tick the ones you want; they are spread over your days later. */
export function SuggestionPicker({ picks, onPicks, initialCity = '' }: SuggestProps) {
  const [q, setQ] = useState('');
  const [city, setCity] = useState(initialCity);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [error, setError] = useState('');
  const picked = new Set(picks.map((p) => p.key));

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, city, category });
        const res = await fetch(`/api/suggestions?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load suggestions');
        setItems(data.items as Suggestion[]);
        if (data.cities) setCities(data.cities as string[]);
        setError('');
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Could not load suggestions');
      }
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, city, category]);

  const toggle = (s: Suggestion) => {
    if (picked.has(s.key)) onPicks(picks.filter((p) => p.key !== s.key));
    else if (picks.length < MAX_PICKS) onPicks([...picks, s]);
  };

  return (
    <div className="space-y-2.5">
      <label htmlFor="sg-q" className="sr-only">Search places</label>
      <input id="sg-q" type="search" className={inputClass} placeholder="Search places" autoComplete="off" value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      {cities.length > 0 && (
        <div role="radiogroup" aria-label="City" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button type="button" role="radio" aria-checked={!city} className={chip(!city)} onClick={() => setCity('')}>Any city</button>
          {cities.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={city.toLowerCase() === c.toLowerCase()} className={chip(city.toLowerCase() === c.toLowerCase())}
              onClick={() => setCity(city.toLowerCase() === c.toLowerCase() ? '' : c)}>📍 {c}</button>
          ))}
        </div>
      )}
      <div role="radiogroup" aria-label="Type" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {Object.values(CATEGORIES).map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className={chip(category === c.key)}
            onClick={() => setCategory(category === c.key ? '' : c.key)}>{c.emoji} {c.label.split(' ')[0]}</button>
        ))}
      </div>
      <p className="text-xs font-bold text-text/80" role="status">
        {picks.length > 0 ? <span className="text-primary">{picks.length} picked</span> : 'Nothing picked yet'}
        {picks.length >= MAX_PICKS && <span className="text-text/60"> (the most that fits)</span>}
      </p>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
      {items === null && !error && <div role="status" aria-label="Loading suggestions" className="h-24 rounded-xl bg-primary/10 animate-pulse" />}
      {items && items.length === 0 && <p role="status" className="py-4 text-center text-sm text-text/60">No places match. Try another city or type.</p>}
      <ul className="max-h-[42vh] overflow-y-auto overscroll-contain rounded-xl border border-primary/15 divide-y divide-primary/10 bg-white/40">
        {(items || []).map((s) => {
          const on = picked.has(s.key);
          const cat = CATEGORIES[s.category];
          return (
            <li key={s.key}>
              <label className="touch-target flex items-center gap-3 px-3 py-2 cursor-pointer min-h-[52px]">
                <input type="checkbox" className="w-5 h-5 shrink-0" checked={on} disabled={!on && picks.length >= MAX_PICKS} onChange={() => toggle(s)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-text truncate">{cat?.emoji} {s.title}</span>
                  <span className="block text-[11px] text-text/60 truncate">
                    {[s.city, `used in ${s.count} ${s.count === 1 ? 'trip' : 'trips'}`, s.price > 0 ? `${s.price.toLocaleString()} ${s.currency}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
