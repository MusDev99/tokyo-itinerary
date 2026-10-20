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
interface DayDraft {
  date: string;
  title: string;
  activities: ActivityDraft[];
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

const newDay = (date = ''): DayDraft => ({ date, title: '', activities: [emptyActivity()] });

const nextDate = (date: string) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

interface DayErrors {
  date?: string;
  title?: string;
  activities: Array<Record<string, string>>;
}

/** Client-side validation: a day needs a date + title before its activities count. */
function validateDays(days: DayDraft[]): { errors: DayErrors[]; ok: boolean } {
  const seen = new Map<string, number>();
  let ok = true;
  const errors = days.map((d, i) => {
    const e: DayErrors = { activities: [] };
    if (!d.date) e.date = 'Date is required';
    else if (seen.has(d.date)) e.date = `Same date as Day ${(seen.get(d.date) as number) + 1}`;
    else seen.set(d.date, i);
    if (!d.title.trim()) e.title = 'Day title is required';
    e.activities = d.activities.map((a) => {
      const ae: Record<string, string> = {};
      if (!a.time) ae.time = 'Time is required';
      if (!a.title.trim()) ae.title = 'Title is required';
      return ae;
    });
    if (e.date || e.title || e.activities.some((a) => Object.keys(a).length)) ok = false;
    return e;
  });
  return { errors, ok };
}

/** Fade/slide a freshly added block in (Motion; skipped for reduced motion). */
function Reveal({ children, className = '' }: { children: any; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate(el, { opacity: [0, 1], y: [14, 0] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

export default function AddItineraryForm({ countries, trips, initialCountry = '', initialState = '' }: Props) {
  const [country, setCountry] = useState(initialCountry);
  const [state, setState] = useState(initialState);
  const [days, setDays] = useState<DayDraft[]>([newDay()]);
  const [showErrors, setShowErrors] = useState(false);
  // Server-side row errors, keyed "dayIndex-activityIndex"
  const [serverErrors, setServerErrors] = useState<Record<string, Record<string, string>>>({});
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

  // Pre-select currency from the chosen country unless the user changed it on that activity
  const withCurrency = (a: ActivityDraft): ActivityDraft =>
    a.currencyTouched ? a : { ...a, price_currency: currency || a.price_currency };

  const { errors: dayErrors, ok: daysValid } = validateDays(days);

  const patchDay = (i: number, patch: Partial<DayDraft>) =>
    setDays((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const patchActivity = (di: number, ai: number, patch: Partial<ActivityDraft>) =>
    setDays((prev) =>
      prev.map((d, idx) =>
        idx === di
          ? { ...d, activities: d.activities.map((a, j) => (j === ai ? { ...withCurrency(a), ...patch } : a)) }
          : d
      )
    );

  const addDay = () =>
    setDays((prev) => [...prev, newDay(nextDate(prev[prev.length - 1]?.date || ''))]);

  const dayReady = (d: DayDraft) => Boolean(d.date && d.title.trim());

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!tripValid || activeStep !== 2) return;
    setShowErrors(true);
    if (!daysValid) {
      setError('Please complete the highlighted fields.');
      return;
    }
    setBusy(true);
    setError('');
    setServerErrors({});

    // Flatten days -> sheet rows (every row carries its day's date and title)
    const refs: string[] = [];
    const activities = days.flatMap((d, di) =>
      d.activities.map((a, ai) => {
        refs.push(`${di}-${ai}`);
        return { ...draftToPayload(withCurrency(a)), date: d.date, day_title: d.title.trim() };
      })
    );

    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          state,
          website: (document.getElementById('hp-website') as HTMLInputElement | null)?.value || '',
          activities,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.rowErrors) {
          const map: Record<string, Record<string, string>> = {};
          data.rowErrors.forEach((er: Record<string, string>, i: number) => {
            if (er && Object.keys(er).length) map[refs[i]] = er;
          });
          setServerErrors(map);
        }
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
            onClick={() => { setDone(null); setDays([newDay()]); setShowErrors(false); setError(''); }}>
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
        {tabBtn(2, 'Days & Activities', !tripValid)}
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
          <div id="add-panel-2" role="tabpanel" aria-labelledby="add-tab-2" className="space-y-4">
            <div className="flex items-center justify-between gap-3 px-1">
              <h2 className="text-base sm:text-lg font-extrabold text-text min-w-0 truncate">{country} - {state}</h2>
              <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-primary hover:underline shrink-0 px-2 py-1">
                ← Edit trip
              </button>
            </div>

            {days.map((day, di) => {
              const de = dayErrors[di];
              const ready = dayReady(day);
              return (
                <Reveal key={di} className="glass-effect rounded-2xl p-4 sm:p-5 border border-primary/20 shadow-md space-y-4">
                  {/* Step A: the day itself (date + title) */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-primary text-white">Day {di + 1}</span>
                    {days.length > 1 && (
                      <button type="button" className="text-xs font-bold text-red-700 hover:underline px-2 py-1"
                        onClick={() => setDays((p) => p.filter((_, idx) => idx !== di))}>
                        Remove day
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <div className="flex flex-col gap-1 min-w-0 sm:col-span-2">
                      <label htmlFor={`day-${di}-date`} className="text-xs font-bold text-text/80">Date <span className="text-red-600">*</span></label>
                      <input id={`day-${di}-date`} type="date" className={inputClass} value={day.date}
                        onInput={(e) => patchDay(di, { date: (e.target as HTMLInputElement).value })} />
                      {showErrors && de?.date && <span className="text-[11px] font-semibold text-red-600">{de.date}</span>}
                    </div>
                    <div className="flex flex-col gap-1 min-w-0 sm:col-span-4">
                      <label htmlFor={`day-${di}-title`} className="text-xs font-bold text-text/80">Day title <span className="text-red-600">*</span></label>
                      <input id={`day-${di}-title`} type="text" maxLength={200} className={inputClass} placeholder="e.g. Arrival & Shibuya night walk"
                        value={day.title} onInput={(e) => patchDay(di, { title: (e.target as HTMLInputElement).value })} />
                      {showErrors && de?.title && <span className="text-[11px] font-semibold text-red-600">{de.title}</span>}
                    </div>
                  </div>

                  {/* Step B: activities for this day, unlocked once date + title are filled */}
                  {!ready ? (
                    <p className="text-xs text-text/60 px-1">🔒 Add a date and a title for this day to start adding activities.</p>
                  ) : (
                    <Reveal className="space-y-3">
                      {day.activities.map((raw, ai) => {
                        const a = withCurrency(raw);
                        const errs = { ...(showErrors ? de?.activities[ai] : {}), ...(serverErrors[`${di}-${ai}`] || {}) };
                        return (
                          <Reveal key={ai} className="rounded-xl bg-white/30 border border-primary/15 p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-extrabold text-primary">Activity {ai + 1}</span>
                              {day.activities.length > 1 && (
                                <button type="button" className="text-xs font-bold text-red-700 hover:underline px-2 py-1"
                                  onClick={() => patchDay(di, { activities: day.activities.filter((_, j) => j !== ai) })}>
                                  Remove
                                </button>
                              )}
                            </div>
                            <ActivityFields hideDate idPrefix={`d${di}a${ai}`} value={a} errors={errs}
                              onChange={(patch) => patchActivity(di, ai, patch)} />
                          </Reveal>
                        );
                      })}
                      <button type="button" disabled={day.activities.length >= 30}
                        className="touch-target w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold hover:bg-primary/10 transition-colors"
                        onClick={() => patchDay(di, { activities: [...day.activities, emptyActivity()] })}>
                        ＋ Add activity to Day {di + 1}
                      </button>
                    </Reveal>
                  )}
                </Reveal>
              );
            })}

            <button type="button" disabled={days.length >= 30}
              className="touch-target w-full px-4 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold hover:bg-primary/10 transition-colors"
              onClick={addDay}>
              ＋ Add another day
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
