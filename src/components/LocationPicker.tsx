import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate, stagger } from 'motion';
import { inputClass } from './inputClass';
import { placeLabel, type Place } from '../types/place';

interface Props {
  /** Initial search text (e.g. the state name) */
  initialQuery: string;
  value: Place | null;
  onSelect: (place: Place) => void;
  /** Place currently suggested but not confirmed yet (selected visually until confirmed) */
  idPrefix?: string;
}

const same = (a: Place | null, b: Place) => !!a && a.lat === b.lat && a.lng === b.lng;

/** Search + pick the real-world place behind a trip (Open-Meteo geocoding). */
export default function LocationPicker({ initialQuery, value, onSelect, idPrefix = 'loc' }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<HTMLUListElement>(null);
  const userTyped = useRef(false);

  // Debounced search (Doherty Threshold: results appear quickly, no submit button)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        setResults(data.results || []);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setError(e?.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!list.current || !results.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(list.current.querySelectorAll('li'), { opacity: [0, 1], y: [8, 0] }, { delay: stagger(0.04), duration: 0.25 });
  }, [results]);

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-q`} className="text-xs font-bold text-text/80">
        Confirm location <span className="text-red-600">*</span>
      </label>
      <input
        id={`${idPrefix}-q`}
        type="search"
        className={inputClass}
        placeholder="Search the city (fix spelling if needed)"
        value={query}
        onInput={(e) => {
          userTyped.current = true;
          setQuery((e.target as HTMLInputElement).value);
        }}
      />
      {loading && <p className="text-xs text-text/60">Searching…</p>}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-xs text-text/60">No matches. Try a different spelling or the nearest big city.</p>
      )}
      {results.length > 0 && (
        <ul ref={list} role="radiogroup" aria-label="Matching places" className="grid gap-2">
          {results.map((p) => {
            const selected = same(value, p);
            return (
              <li key={`${p.lat},${p.lng}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(p)}
                  className={`touch-target w-full flex items-center justify-between gap-3 text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                    selected ? 'bg-primary/15 border-primary text-text' : 'bg-white/45 border-primary/20 hover:bg-primary/10'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold truncate">{placeLabel(p)}</span>
                    <span className="block text-[11px] text-text/60">
                      {p.lat.toFixed(2)}, {p.lng.toFixed(2)} · {p.timezone}
                    </span>
                  </span>
                  <span aria-hidden="true" className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center text-[11px] ${selected ? 'bg-primary border-primary text-white' : 'border-primary/40'}`}>
                    {selected ? '✓' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
