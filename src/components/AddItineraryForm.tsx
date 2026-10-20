import { h } from 'preact';
import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import ActivityFields, { emptyActivity, draftToPayload, inputClass, type ActivityDraft } from './ActivityFields';

interface CountryOption {
  name: string;
  slug: string;
  flag: string;
  currency: string;
}
interface Trip {
  country: string;
  state: string;
}
interface Props {
  countries: CountryOption[];
  trips: Trip[];
  initialCountry?: string;
  initialState?: string;
}

const FORBIDDEN = /[\[\]*?:\/\\'!]/;
const RESERVED = new Set(['itinerary', 'add', 'api', '404']);

/** Mirrors the server-side tab-name rules so tab 2 only unlocks for a valid trip. */
function validateTrip(country: string, state: string): { country?: string; state?: string } {
  const errors: { country?: string; state?: string } = {};
  const check = (v: string, label: string) => {
    if (!v.trim()) return `${label} is required`;
    if (FORBIDDEN.test(v)) return "Can't contain [ ] * ? : / \\ ' !";
    if (v.includes(' - ')) return "Can't contain ' - '";
    if (!slugify(v)) return 'Use at least one letter or number';
    if (RESERVED.has(slugify(v))) return 'That name is reserved';
    return undefined;
  };
  const c = check(country, 'Country');
  const st = check(state, 'State / City');
  if (c) errors.country = c;
  if (st) errors.state = st;
  return errors;
}

const slugify = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function AddItineraryForm({ countries, trips, initialCountry = '', initialState = '' }: Props) {
  const [country, setCountry] = useState(initialCountry);
  const [state, setState] = useState(initialState);
  const [rows, setRows] = useState<ActivityDraft[]>([emptyActivity()]);
  const [rowErrors, setRowErrors] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<1 | 2>(initialCountry && initialState ? 2 : 1);
  const [touched, setTouched] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<{ href: string; tab: string; created: boolean; count: number } | null>(null);

  const match = useMemo(() => countries.find((c) => c.slug === slugify(country)), [country, countries]);
  const knownStates = useMemo(
    () => trips.filter((t) => slugify(t.country) === slugify(country)).map((t) => t.state),
    [trips, country]
  );
  const isExisting = knownStates.some((s) => slugify(s) === slugify(state));
  const currency = match?.currency || '';
  const tripErrors = validateTrip(country, state);
  const tripValid = !tripErrors.country && !tripErrors.state;
  // Tab 2 is only reachable while tab 1 is complete and valid
  const activeStep = tripValid ? step : 1;

  const goStep2 = () => {
    setTouched(true);
    if (tripValid) setStep(2);
  };

  // Fade/slide the panel in on tab change (Motion; skipped for reduced motion)
  useEffect(() => {
    const el = panelRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(el, { opacity: [0, 1], y: [16, 0] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
  }, [activeStep]);

  // Pre-select currency from the chosen country unless the user changed it on that row
  const effectiveRows = rows.map((r) => (r.currencyTouched ? r : { ...r, price_currency: currency || r.price_currency }));

  const updateRow = (i: number, patch: Partial<ActivityDraft>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...effectiveRows[i], ...patch } : r)));

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!tripValid || activeStep !== 2) return;
    setBusy(true);
    setError('');
    setRowErrors([]);
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          state,
          website: (document.getElementById('hp-website') as HTMLInputElement | null)?.value || '',
          activities: effectiveRows.map(draftToPayload),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.rowErrors) setRowErrors(data.rowErrors);
        return;
      }
      setDone({ href: data.href, tab: data.tab, created: data.created, count: data.count });
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="glass-effect rounded-2xl p-6 sm:p-10 border border-primary/20 shadow-md text-center max-w-2xl mx-auto">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-text">
          {done.created ? 'New itinerary created' : 'Activities added'}
        </h2>
        <p className="text-sm text-text/75 mt-2">
          {done.count} {done.count === 1 ? 'activity' : 'activities'} saved to the “{done.tab}” tab.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <a href={done.href} className="touch-target px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm">
            View itinerary →
          </a>
          <button type="button" className="touch-target px-5 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-bold"
            onClick={() => { setDone(null); setRows([emptyActivity()]); }}>
            Add more
          </button>
        </div>
      </div>
    );
  }

  const tabBtn = (n: 1 | 2, label: string, locked: boolean) => {
    const active = activeStep === n;
    const complete = n === 1 && tripValid && activeStep === 2;
    return (
      <button
        type="button"
        role="tab"
        id={`add-tab-${n}`}
        aria-selected={active}
        aria-controls={`add-panel-${n}`}
        aria-disabled={locked}
        title={locked ? 'Complete country and state first' : undefined}
        onClick={() => {
          if (locked) { setTouched(true); return; }
          setStep(n);
        }}
        className={`touch-target flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all duration-150 ${
          active
            ? 'bg-primary text-white shadow-sm'
            : locked
            ? 'text-text/40 cursor-not-allowed'
            : 'text-text/75 hover:text-primary hover:bg-primary/10'
        }`}
      >
        <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${active ? 'bg-white/25' : 'bg-primary/15 text-primary'}`}>
          {complete ? '✓' : locked ? '🔒' : n}
        </span>
        <span>{label}</span>
      </button>
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4 sm:space-y-5 max-w-3xl mx-auto w-full" noValidate>
      {/* Tab switcher (Hick's Law: one task per tab; Jakob's Law: familiar stepper) */}
      <div role="tablist" aria-label="Add itinerary steps" className="flex gap-1.5 p-1.5 rounded-xl bg-white/45 border border-primary/20">
        {tabBtn(1, 'Country & State', false)}
        {tabBtn(2, 'Activities', !tripValid)}
      </div>

      <div ref={panelRef}>
        {activeStep === 1 && (
          <section id="add-panel-1" role="tabpanel" aria-labelledby="add-tab-1"
            className="glass-effect rounded-2xl p-4 sm:p-6 border border-primary/20 shadow-md space-y-4">
            <h2 className="text-base sm:text-lg font-extrabold text-text">Where are you going?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="country" className="text-xs font-bold text-text/80">Country <span className="text-red-600">*</span></label>
                <input id="country" list="country-list" className={inputClass} placeholder="e.g. Malaysia"
                  aria-invalid={touched && !!tripErrors.country}
                  value={country} onInput={(e) => setCountry((e.target as HTMLInputElement).value)} />
                <datalist id="country-list">
                  {countries.map((c) => <option key={c.slug} value={c.name}>{c.flag}</option>)}
                </datalist>
                {touched && tripErrors.country && <span className="text-[11px] font-semibold text-red-600">{tripErrors.country}</span>}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <label htmlFor="state" className="text-xs font-bold text-text/80">State / City <span className="text-red-600">*</span></label>
                <input id="state" list="state-list" className={inputClass} placeholder="e.g. Kuala Lumpur"
                  aria-invalid={touched && !!tripErrors.state}
                  value={state} onInput={(e) => setState((e.target as HTMLInputElement).value)} />
                <datalist id="state-list">
                  {knownStates.map((s) => <option key={s} value={s} />)}
                </datalist>
                {touched && tripErrors.state && <span className="text-[11px] font-semibold text-red-600">{tripErrors.state}</span>}
              </div>
            </div>
            {tripValid && (
              <p className="text-xs text-text/70">
                {isExisting
                  ? <>Adding to the existing trip <strong>{country} - {state}</strong>.</>
                  : <>A new Google Sheet tab <strong>{country} - {state}</strong> will be created.</>}
                {currency && <> Default currency: <strong>{currency}</strong> (change per activity if needed).</>}
              </p>
            )}
            {/* Honeypot (hidden from humans) */}
            <input id="hp-website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0" />
            <button type="button" onClick={goStep2}
              className={`touch-target w-full px-5 py-3 rounded-xl text-sm sm:text-base font-extrabold shadow-md transition-opacity ${
                tripValid ? 'bg-primary text-white hover:opacity-95' : 'bg-primary/40 text-white'
              }`}>
              Continue to activities →
            </button>
          </section>
        )}

        {activeStep === 2 && (
          <div id="add-panel-2" role="tabpanel" aria-labelledby="add-tab-2" className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-base sm:text-lg font-extrabold text-text min-w-0 truncate">Activities · {country} - {state}</h2>
              <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-primary hover:underline shrink-0 px-2 py-1">
                ← Edit trip
              </button>
            </div>
            {effectiveRows.map((row, i) => (
              <div key={i} className="glass-effect rounded-2xl p-4 sm:p-5 border border-primary/20 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-primary text-white">Activity {i + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" className="text-xs font-bold text-red-700 hover:underline px-2 py-1"
                      onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  )}
                </div>
                <ActivityFields idPrefix={`a${i}`} value={row} errors={rowErrors[i]} onChange={(patch) => updateRow(i, patch)} />
              </div>
            ))}
            <button type="button" disabled={rows.length >= 50}
              className="touch-target w-full px-4 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold hover:bg-primary/10 transition-colors"
              onClick={() => setRows((p) => [...p, { ...emptyActivity(), date: effectiveRows[effectiveRows.length - 1]?.date || '' }])}>
              ＋ Add another activity
            </button>

            {error && (
              <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-800">{error}</div>
            )}

            <button type="submit" disabled={busy}
              className="touch-target w-full px-5 py-3 rounded-xl bg-primary text-white text-sm sm:text-base font-extrabold shadow-md hover:opacity-95 disabled:opacity-60 transition-opacity">
              {busy ? 'Saving…' : isExisting ? 'Add to itinerary' : 'Create itinerary'}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
