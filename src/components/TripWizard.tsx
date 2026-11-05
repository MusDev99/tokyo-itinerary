import { h } from 'preact';
import { goTo } from '../utils/refresh';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { redirectIfSignedOut } from '../utils/authClient';
import { prefersReducedMotion } from '../utils/motion';
import { slug, validateTripName, validateRange, buildDays, diffDays } from '../utils/tripDraft';
import { formatLongDate } from '../utils/calendar';
import LocationPicker from './LocationPicker';
import CalendarPicker from './CalendarPicker';
import FormField from './FormField';
import { inputClass } from './ActivityFields';
import type { Place } from '../types/place';

interface CountryOption { name: string; slug: string; flag: string; currency: string }
interface Trip { country: string; state: string }

interface Props {
  countries?: CountryOption[];
  trips?: Trip[];
  initialCountry?: string;
  initialState?: string;
}

type Step = 1 | 2 | 3;
const STEPS = ['Where', 'When', 'Review'] as const;
const DRAFT_KEY = 'tripDraft:wizard';
const CREATE_STEPS = ['Saving your trip…', 'Setting the dates…', 'Opening your trip…'] as const;

interface Draft { country: string; state: string; start: string; end: string; place: Place | null; step: Step; savedAt?: number }

/** A draft older than this is dropped instead of offered (a trip planned last month is not "unfinished") */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const readDraft = (): Draft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
};
const writeDraft = (d: Draft | null) => {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {}
};

const primaryBtn =
  'touch-target flex-1 px-5 py-3 rounded-xl bg-primary text-white text-sm sm:text-base font-extrabold shadow-md hover:opacity-95 disabled:opacity-50 transition-opacity';
const ghostBtn =
  'touch-target px-5 py-3 rounded-xl bg-primary/10 text-primary text-sm font-bold hover:bg-primary/15 transition-colors';

/**
 * Create-a-trip wizard: Where -> When -> Review.
 * Hick's Law: one decision per screen. Doherty Threshold: the day count updates as dates change.
 * Fitts's Law: Back/Next are full-width, 44px+ and anchored at the bottom of each step.
 */
export default function TripWizard({ countries = [], trips = [], initialCountry = '', initialState = '' }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [country, setCountry] = useState(initialCountry);
  const [state, setState] = useState(initialState);
  const [place, setPlace] = useState<Place | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  // Progress illusion while the trip is created (one request): named steps advance on a timer, so the wait reads as work
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!busy) { setStage(0); return; }
    const t = setInterval(() => setStage((n) => Math.min(n + 1, CREATE_STEPS.length - 1)), 650);
    return () => clearInterval(t);
  }, [busy]);
  const [error, setError] = useState('');
  // An unfinished draft is OFFERED, never applied silently: the form always opens on a clean "Where" step
  const [pending, setPending] = useState<Draft | null>(null);
  const [checked, setChecked] = useState(false); // the draft lookup ran: only then may autosave touch storage
  const [restored, setRestored] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  // Look for an unfinished draft once. Nothing is applied until the person says "Continue" (no jump between steps)
  useEffect(() => {
    if (initialCountry || initialState) {
      writeDraft(null); // a prefilled link starts a new trip: the old draft would only confuse
    } else {
      const d = readDraft();
      const fresh = d && (!d.savedAt || Date.now() - d.savedAt < DRAFT_MAX_AGE_MS);
      if (d && fresh && (d.country || d.state)) setPending(d);
      else writeDraft(null);
    }
    setChecked(true);
  }, []);

  // Autosave only once there is no pending offer, so the offer can't be overwritten by the empty form
  useEffect(() => {
    if (busy || pending || !checked) return;
    writeDraft(country || state || start ? { country, state, start, end, place, step, savedAt: Date.now() } : null);
  }, [country, state, start, end, place, step, busy, pending, checked]);

  const resume = () => {
    if (!pending) return;
    setCountry(pending.country);
    setState(pending.state);
    setStart(pending.start);
    setEnd(pending.end);
    setPlace(pending.place);
    setStep(pending.step);
    setRestored(true);
    setPending(null);
  };
  const discard = () => {
    writeDraft(null);
    setPending(null);
  };

  useEffect(() => {
    const el = panel.current;
    if (!el || prefersReducedMotion()) return;
    animate(el, { opacity: [0, 1], x: [16, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
  }, [step]);

  const match = useMemo(() => countries.find((c) => c.slug === slug(country)), [country, countries]);
  const knownStates = useMemo(
    () => trips.filter((t) => slug(t.country) === slug(country)).map((t) => t.state),
    [trips, country]
  );
  const nameErrors = validateTripName(country, state);
  const nameValid = !nameErrors.country && !nameErrors.state;
  const exists = nameValid && knownStates.some((s) => slug(s) === slug(state));
  const tripKey = `${slug(country)}|${slug(state)}`;

  // A different destination means a different place: drop the old pick
  useEffect(() => {
    setPlace((p) => (restored && p ? p : null));
    setRestored(false);
  }, [tripKey]);

  const rangeError = start || end ? validateRange(start, end) : null;
  const days = buildDays(start, end).length;
  const step1Ready = nameValid && !exists && Boolean(place);
  const step2Ready = Boolean(start && end) && !rangeError;

  const next = () => {
    setTouched(true);
    setError('');
    if (step === 1 && step1Ready) setStep(2);
    else if (step === 2 && step2Ready) setStep(3);
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          state,
          place,
          dates: { start, end },
          website: (document.getElementById('hp-website') as HTMLInputElement | null)?.value || '',
          activities: [],
        }),
      });
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return;
      }
      writeDraft(null);
      goTo(data.href);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    writeDraft(null);
    setCountry(''); setState(''); setPlace(null); setStart(''); setEnd('');
    setStep(1); setTouched(false); setError('');
  };

  const progress = (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <li key={label} className="flex-1 min-w-0" aria-current={active ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full transition-colors ${done || active ? 'bg-primary' : 'bg-primary/20'}`} />
            <span className={`mt-1 block text-[11px] font-bold truncate ${active ? 'text-primary' : 'text-text/50'}`}>
              {done ? '✓ ' : `${n}. `}{label}
            </span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {progress}
      {pending && (
        <div role="region" aria-label="Unfinished trip" className="rounded-2xl border border-primary/25 bg-primary/10 p-3 space-y-2">
          <p className="text-sm font-extrabold text-text">Continue your unfinished trip?</p>
          <p className="text-xs text-text/75">
            {[pending.state, pending.country].filter(Boolean).join(', ')}
            {pending.start && pending.end ? ` · ${formatLongDate(pending.start)} → ${formatLongDate(pending.end)}` : ''}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={resume} className="touch-target flex-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-extrabold">Continue</button>
            <button type="button" onClick={discard} className="touch-target px-4 py-2 rounded-xl bg-white/60 text-primary text-sm font-bold">Start fresh</button>
          </div>
        </div>
      )}
      {!pending && (country || state || start || end) && (
        <div className="flex items-center justify-between gap-3 text-xs text-text/70 px-1">
          <span>{restored ? 'Picked up where you left off.' : 'Draft saved on this device.'}</span>
          <button type="button" className="touch-target font-bold text-primary px-2" onClick={startOver}>Start over</button>
        </div>
      )}

      <div ref={panel} className="glass-effect rounded-2xl p-4 sm:p-6 border border-primary/20 shadow-md space-y-4">
        {step === 1 && (
          <>
            <h2 className="text-lg font-extrabold text-text">Where are you going?</h2>
            <FormField label="Country" htmlFor="wz-country" required error={touched ? nameErrors.country : ''}>
              <input id="wz-country" list="wz-country-list" className={inputClass} placeholder="e.g. Japan"
                autoComplete="off" value={country}
                onInput={(e) => setCountry((e.target as HTMLInputElement).value)} />
              <datalist id="wz-country-list">
                {countries.map((c) => <option key={c.slug} value={c.name}>{c.flag}</option>)}
              </datalist>
            </FormField>
            <FormField label="State / City" htmlFor="wz-state" required error={touched ? nameErrors.state : ''}>
              <input id="wz-state" list="wz-state-list" className={inputClass} placeholder="e.g. Tokyo"
                autoComplete="off" value={state}
                onInput={(e) => setState((e.target as HTMLInputElement).value)} />
              <datalist id="wz-state-list">
                {knownStates.map((s) => <option key={s} value={s} />)}
              </datalist>
            </FormField>

            {exists && (
              <p role="status" className="rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs font-semibold text-amber-900">
                {country} - {state} already exists.{' '}
                <a className="underline font-bold" href={`/trips/${slug(country)}-${slug(state)}`}>Open it to add places →</a>
              </p>
            )}

            {nameValid && !exists && (
              <div className="rounded-xl bg-white/30 border border-primary/15 p-3 space-y-1">
                <LocationPicker key={tripKey} idPrefix="wz-loc" initialQuery={state.trim()} value={place} onSelect={setPlace} />
                <p className="text-[11px] text-text/60">Pin the exact place. It powers prayer times and other tools.</p>
                {touched && !place && <p className="text-[11px] font-semibold text-red-600">Pick the matching location to continue.</p>}
              </div>
            )}
            {match && <p className="text-xs text-text/70">{match.flag} Default currency: <strong>{match.currency}</strong></p>}
            {/* Honeypot (hidden from humans) */}
            <input id="hp-website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
              className="absolute -left-[9999px] w-px h-px opacity-0" />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-extrabold text-text">When are you travelling?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Departure" htmlFor="wz-start" required>
                <CalendarPicker id="wz-start" value={start}
                  onChange={(v) => { setStart(v); if (end && end < v) setEnd(''); }} />
              </FormField>
              <FormField label="Return" htmlFor="wz-end" required>
                <CalendarPicker id="wz-end" value={end} min={start} invalid={Boolean(touched && !end)}
                  onChange={setEnd} />
              </FormField>
            </div>
            <p role="status" className={`text-sm font-bold ${rangeError ? 'text-red-600' : 'text-primary'}`}>
              {rangeError || (days ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Pick your first and last day')}
            </p>
            {touched && !step2Ready && !rangeError && <p className="text-[11px] font-semibold text-red-600">Pick both dates to continue.</p>}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-lg font-extrabold text-text">Ready to go?</h2>
            <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-white/40 p-4 space-y-3">
              <div>
                <div className="text-xl font-extrabold text-text break-words">{state}</div>
                <div className="text-sm text-text/70">{match?.flag} {country}</div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-text/50 font-bold">From</dt><dd className="font-bold">{formatLongDate(start)}</dd></div>
                <div><dt className="text-text/50 font-bold">To</dt><dd className="font-bold">{formatLongDate(end)}</dd></div>
                <div><dt className="text-text/50 font-bold">Length</dt><dd className="font-bold">{diffDays(start, end) + 1} days</dd></div>
              </dl>
              {place && <p className="text-[11px] text-text/60">📍 {place.name}{place.admin1 ? `, ${place.admin1}` : ''}</p>}
            </div>
            <p className="text-xs text-text/70">You'll add places day by day on the next screen.</p>
            {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-800">{error}</div>}
          </>
        )}

        {busy && (
          <div role="progressbar" aria-valuemin={0} aria-valuemax={CREATE_STEPS.length} aria-valuenow={stage + 1} aria-label="Creating your trip"
            className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div className="h-full w-full origin-left bg-gradient-to-r from-primary to-accent rounded-full transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${(stage + 1) / CREATE_STEPS.length})` }} />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {step > 1 && (
            <button type="button" className={ghostBtn} disabled={busy} onClick={() => { setStep((step - 1) as Step); setError(''); }}>Back</button>
          )}
          {step < 3 ? (
            <button type="button" className={primaryBtn} onClick={next}>
              {step === 1 ? 'Next: choose dates →' : 'Next: review →'}
            </button>
          ) : (
            <button type="button" className={primaryBtn} disabled={busy} onClick={create}>
              {busy ? CREATE_STEPS[stage] : 'Create trip'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
