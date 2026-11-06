import { h } from 'preact';
import { goTo } from '../utils/refresh';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { apiFetch } from '../utils/apiFetch';
import { toast } from '../utils/toast';
import { prefersReducedMotion } from '../utils/motion';
import { slug, validateRange, buildDays, diffDays, addDays, isIsoDate, MAX_TRIP_DAYS } from '../utils/tripDraft';
import { stopsFromParts, citiesLabel } from '../utils/trips';
import { distributeSuggestions, type Suggestion } from '../utils/suggestions';
import { ModeSwitch, CopyPicker, SuggestionPicker, type CopyTrip, type StartMode } from './TripStart';
import { formatLongDate } from '../utils/calendar';
import LocationPicker from './LocationPicker';
import CalendarPicker from './CalendarPicker';
import FormField from './FormField';
import { inputClass } from './ActivityFields';
import type { Place } from '../types/place';
import InlineError from './ui/InlineError';
import Button from './ui/Button';

interface CountryOption { name: string; slug: string; flag: string; currency: string }
interface Trip { country: string; state: string }

interface Props {
  countries?: CountryOption[];
  trips?: Trip[];
  initialCountry?: string;
  initialState?: string;
  /** Trips that can be copied (slim: title, cities, dates, days with counts) */
  copyTrips?: CopyTrip[];
}

// The wizard follows one of three flows (Hick's Law: only the steps that flow needs)
type Phase = 'picks' | 'source' | 'where' | 'when' | 'cities' | 'review';
const FLOW: Record<StartMode, Phase[]> = {
  blank: ['where', 'when', 'cities', 'review'],
  copy: ['source', 'when', 'review'],
  suggest: ['picks', 'where', 'when', 'cities', 'review'],
};
const PHASE_LABEL: Record<Phase, string> = { picks: 'Places', source: 'Trip', where: 'Where', when: 'When', cities: 'Cities', review: 'Review' };
const DRAFT_KEY = 'tripDraft:wizard';
const CREATE_STEPS = ['Saving your trip…', 'Setting the dates…', 'Opening your trip…'] as const;

/** An extra city after the first one, and how many days to stay */
interface Extra { city: string; days: number }

interface Draft { title?: string; country: string; state: string; start: string; end: string; place: Place | null; phase?: Phase; step?: number; extras?: Extra[]; savedAt?: number }

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


/**
 * Create-a-trip wizard: Where -> When -> Review.
 * Hick's Law: one decision per screen. Doherty Threshold: the day count updates as dates change.
 * Fitts's Law: Back/Next are full-width, 44px+ and anchored at the bottom of each step.
 */
export default function TripWizard({ countries = [], trips = [], initialCountry = '', initialState = '', copyTrips = [] }: Props) {
  const [mode, setMode] = useState<StartMode>('blank');
  const [phase, setPhase] = useState<Phase>('where');
  // Copy a trip: the source, the source days to copy (ISO) and whether prices come along
  const [source, setSource] = useState<CopyTrip | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [prices, setPrices] = useState(true);
  // Suggestions: the places picked from past trips
  const [picks, setPicks] = useState<Suggestion[]>([]);
  const flow = FLOW[mode];
  const idx = Math.max(0, flow.indexOf(phase));
  const [country, setCountry] = useState(initialCountry);
  const [state, setState] = useState(initialState);
  const [title, setTitle] = useState('');
  // Cities after the first (the first city is `state` and keeps whatever days are left)
  const [extras, setExtras] = useState<Extra[]>([]);
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
    // Only the from-scratch flow is drafted: copy and suggestion picks are cheap to redo and would go stale
    if (mode !== 'blank') return;
    writeDraft(country || state || start || title ? { title, country, state, start, end, place, phase, extras, savedAt: Date.now() } : null);
  }, [title, country, state, start, end, place, phase, mode, extras, busy, pending, checked]);

  const resume = () => {
    if (!pending) return;
    setTitle(pending.title || '');
    setExtras(pending.extras || []);
    setCountry(pending.country);
    setState(pending.state);
    setStart(pending.start);
    setEnd(pending.end);
    setPlace(pending.place);
    const legacy: Phase[] = ['where', 'when', 'cities', 'review'];
    setMode('blank');
    setPhase(pending.phase && FLOW.blank.includes(pending.phase) ? pending.phase : legacy[Math.max(0, (pending.step ?? 1) - 1)] ?? 'where');
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
  }, [phase]);

  const match = useMemo(() => countries.find((c) => c.slug === slug(country)), [country, countries]);
  // Cities already used in this country (suggestions while typing)
  const knownStates = useMemo(
    () => [...new Set(trips.filter((t) => slug(t.country) === slug(country)).map((t) => t.state))],
    [trips, country]
  );
  const nameErrors = {
    country: country.trim() ? '' : 'Country is required',
    state: state.trim() ? '' : 'Add the first city',
  };
  const nameValid = !nameErrors.country && !nameErrors.state;
  const tripKey = `${slug(country)}|${slug(state)}`;

  // A different destination means a different place: drop the old pick
  useEffect(() => {
    setPlace((p) => (restored && p ? p : null));
    setRestored(false);
  }, [tripKey]);

  const rangeError = start || end ? validateRange(start, end) : null;
  const days = buildDays(start, end).length;
  // Copy flow: only the start date is chosen, the end follows from the days that are copied
  const copyDays = [...selected].sort();
  const copySpan = copyDays.length ? diffDays(copyDays[0], copyDays[copyDays.length - 1]) + 1 : 0;
  const copyEnd = isIsoDate(start) && copySpan ? addDays(start, copySpan - 1) : '';
  const copyCount = source ? source.days.filter((d) => selected.includes(d.date)).reduce((n, d) => n + d.items, 0) : 0;

  const whereReady = nameValid && Boolean(place);
  const whenReady = mode === 'copy' ? isIsoDate(start) && copySpan > 0 && copySpan <= MAX_TRIP_DAYS : Boolean(start && end) && !rangeError;
  // Cities step: every extra city is named and the first city keeps at least one day
  const extraDays = extras.reduce((n, e) => n + e.days, 0);
  const firstDays = days - extraDays;
  const citiesReady = firstDays >= 1 && extras.every((e) => e.city.trim());
  const parts = [{ city: state, days: firstDays }, ...extras];
  const stopsPreview = days > 0 ? stopsFromParts(start, days, parts) : [];
  const shortDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
  const title0 = mode === 'copy' ? title.trim() || `${source?.title ?? 'Trip'} (copy)` : title.trim() || `${state.trim()} trip ${start.slice(0, 4)}`;
  const ready: Record<Phase, boolean> = {
    picks: picks.length > 0, source: Boolean(source) && selected.length > 0, where: whereReady, when: whenReady, cities: citiesReady, review: true,
  };
  const NEXT_LABEL: Record<Phase, string> = { picks: 'Next: where →', source: 'Next: dates →', where: 'Next: dates →', when: mode === 'copy' ? 'Next: review →' : 'Next: cities →', cities: 'Next: review →', review: '' };

  const go = (to: Phase) => { setPhase(to); setError(''); };
  const next = () => {
    setTouched(true);
    setError('');
    if (!ready[phase] || idx >= flow.length - 1) return;
    if (phase === 'when') setExtras((x) => x.filter((e) => e.days < days));
    setPhase(flow[idx + 1]);
  };
  const changeMode = (m: StartMode) => { if (m !== mode) { setMode(m); setPhase(FLOW[m][0]); setError(''); setTouched(false); } };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      const honeypot = (document.getElementById('hp-website') as HTMLInputElement | null)?.value || '';
      let url = '/api/trips';
      let payload: Record<string, unknown>;
      if (mode === 'copy') {
        url = '/api/trips/copy';
        payload = { sourceSlug: source?.slug, title: title.trim(), start, selection: selected.map((date) => ({ date })), includePrices: prices, website: honeypot };
      } else {
        payload = {
          title: title.trim(),
          country,
          city: state,
          stops: parts.map((p) => ({ city: p.city, country, days: p.days })),
          place,
          dates: { start, end },
          website: honeypot,
          // Suggestions: the picked places, spread over the trip's days
          ...(mode === 'suggest' ? { activities: distributeSuggestions(picks, buildDays(start, end)) } : {}),
        };
      }
      const r = await apiFetch(url, { body: payload });
      if (!r.ok) { if (r.kind !== 'signed-out') setError(r.error); return; }
      writeDraft(null);
      toast.success(mode === 'copy' ? 'Trip copied' : 'Trip created');
      goTo(r.data.href);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    writeDraft(null);
    setTitle(''); setExtras([]);
    setCountry(''); setState(''); setPlace(null); setStart(''); setEnd('');
    setMode('blank'); setPhase('where'); setSource(null); setSelected([]); setPicks([]); setTouched(false); setError('');
  };

  const progress = (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {flow.map((p, i) => {
        const label = PHASE_LABEL[p];
        const n = i + 1;
        const active = idx === i;
        const done = idx > i;
        return (
          <li key={p} className="flex-1 min-w-0" aria-current={active ? 'step' : undefined}>
            <div className={`h-1.5 rounded-full transition-colors ${done || active ? 'bg-primary' : 'bg-primary/20'}`} />
            <span className={`mt-1 block text-micro font-bold truncate ${active ? 'text-primary' : 'text-text/50'}`}>
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
            {[pending.title || pending.state, pending.country].filter(Boolean).join(', ')}
            {pending.start && pending.end ? ` · ${formatLongDate(pending.start)} → ${formatLongDate(pending.end)}` : ''}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={resume} className="touch-target flex-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-extrabold">Continue</button>
            <button type="button" onClick={discard} className="touch-target px-4 py-2 rounded-xl bg-white/60 text-primary text-sm font-bold">Start fresh</button>
          </div>
        </div>
      )}
      {!pending && (country || state || start || end || title) && (
        <div className="flex items-center justify-between gap-3 text-xs text-text/70 px-1">
          <span>{restored ? 'Picked up where you left off.' : 'Draft saved on this device.'}</span>
          <button type="button" className="touch-target font-bold text-primary px-2" onClick={startOver}>Start over</button>
        </div>
      )}

      <div ref={panel} className="glass-effect rounded-2xl p-4 sm:p-6 border border-primary/20 shadow-md space-y-4">
        {(phase === 'where' && mode === 'blank') || phase === 'source' || phase === 'picks' ? <ModeSwitch mode={mode} onMode={changeMode} /> : null}

        {phase === 'source' && (
          <>
            <h2 className="text-lg font-extrabold text-text">Which trip do you want to copy?</h2>
            <CopyPicker trips={copyTrips} source={source} onSource={setSource} selected={selected} onSelected={setSelected} prices={prices} onPrices={setPrices} />
            {touched && !ready.source && <p className="text-micro font-semibold text-danger-strong">Pick a trip and at least one day.</p>}
          </>
        )}

        {phase === 'picks' && (
          <>
            <h2 className="text-lg font-extrabold text-text">Pick places others loved</h2>
            <p className="text-xs text-text/70">From the trips already in the sheet, most used first. You choose where and when next.</p>
            <SuggestionPicker picks={picks} onPicks={setPicks} initialCity="" />
            {touched && !ready.picks && <p className="text-micro font-semibold text-danger-strong">Pick at least one place, or switch to “From scratch”.</p>}
          </>
        )}

        {phase === 'where' && (
          <>
            <h2 className="text-lg font-extrabold text-text">Where are you going?</h2>
            <FormField label="Trip title" htmlFor="wz-title" hideOptional={false}>
              <input id="wz-title" className={inputClass} maxLength={100} placeholder="e.g. AirTravel Sdn Bhd Trip at Japan 2025"
                autoComplete="off" value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
            </FormField>
            <FormField label="Country" htmlFor="wz-country" required error={touched ? nameErrors.country : ''}>
              <input id="wz-country" list="wz-country-list" className={inputClass} placeholder="e.g. Japan"
                autoComplete="off" value={country}
                onInput={(e) => setCountry((e.target as HTMLInputElement).value)} />
              <datalist id="wz-country-list">
                {countries.map((c) => <option key={c.slug} value={c.name}>{c.flag}</option>)}
              </datalist>
            </FormField>
            <FormField label="First city" htmlFor="wz-state" required error={touched ? nameErrors.state : ''}>
              <input id="wz-state" list="wz-state-list" className={inputClass} placeholder="e.g. Tokyo"
                autoComplete="off" value={state}
                onInput={(e) => setState((e.target as HTMLInputElement).value)} />
              <datalist id="wz-state-list">
                {knownStates.map((s) => <option key={s} value={s} />)}
              </datalist>
            </FormField>

            {nameValid && (
              <div className="rounded-xl bg-white/30 border border-primary/15 p-3 space-y-1">
                <LocationPicker key={tripKey} idPrefix="wz-loc" initialQuery={state.trim()} value={place} onSelect={setPlace} />
                <p className="text-micro text-text/60">Pin the exact place of the first city. It powers prayer times and other tools.</p>
                {touched && !place && <p className="text-micro font-semibold text-danger-strong">Pick the matching location to continue.</p>}
              </div>
            )}
            {match && <p className="text-xs text-text/70">{match.flag} Default currency: <strong>{match.currency}</strong></p>}
          </>
        )}

        {phase === 'when' && mode === 'copy' && (
          <>
            <h2 className="text-lg font-extrabold text-text">When does the new trip start?</h2>
            <FormField label="Departure" htmlFor="wz-start" required>
              <CalendarPicker id="wz-start" value={start} onChange={setStart} />
            </FormField>
            <p role="status" className="text-sm font-bold text-primary">
              {copyEnd ? `${copySpan} ${copySpan === 1 ? 'day' : 'days'} · ${formatLongDate(start)} → ${formatLongDate(copyEnd)}` : 'Pick the first day'}
            </p>
            {copySpan > MAX_TRIP_DAYS && <p className="text-micro font-semibold text-danger-strong">That spans more than {MAX_TRIP_DAYS} days: pick fewer days.</p>}
            {touched && !whenReady && copySpan <= MAX_TRIP_DAYS && <p className="text-micro font-semibold text-danger-strong">Pick the start date to continue.</p>}
          </>
        )}

        {phase === 'when' && mode !== 'copy' && (
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
            <p role="status" className={`text-sm font-bold ${rangeError ? 'text-danger-strong' : 'text-primary'}`}>
              {rangeError || (days ? `${days} ${days === 1 ? 'day' : 'days'}` : 'Pick your first and last day')}
            </p>
            {touched && !whenReady && !rangeError && <p className="text-micro font-semibold text-danger-strong">Pick both dates to continue.</p>}
          </>
        )}

        {phase === 'cities' && (
          <>
            <h2 className="text-lg font-extrabold text-text">Which cities?</h2>
            <p className="text-xs text-text/70">One city is fine. Add more if the trip moves on: each extra city takes days from the first.</p>
            <ol className="space-y-2" aria-label="Cities in order">
              <li className="flex items-center gap-2 rounded-xl bg-white/40 border border-primary/15 px-3 py-2">
                <span className="font-extrabold text-primary w-5" aria-hidden="true">1</span>
                <span className="flex-1 min-w-0 font-bold text-text truncate">{state}</span>
                <span className="text-xs font-bold text-text/70 shrink-0">{firstDays} {firstDays === 1 ? 'day' : 'days'}</span>
              </li>
              {extras.map((x, i) => (
                <li key={i} className="flex items-center gap-2 rounded-xl bg-white/40 border border-primary/15 px-2 py-2">
                  <span className="font-extrabold text-primary w-5 text-center" aria-hidden="true">{i + 2}</span>
                  <input className={`${inputClass} flex-1`} aria-label={`City ${i + 2}`} placeholder="City" maxLength={80} value={x.city}
                    onInput={(e) => setExtras((all) => all.map((y, j) => (j === i ? { ...y, city: (e.target as HTMLInputElement).value } : y)))} />
                  <div className="flex items-center shrink-0" role="group" aria-label={`Days in city ${i + 2}`}>
                    <button type="button" aria-label="One day less" disabled={x.days <= 1}
                      onClick={() => setExtras((all) => all.map((y, j) => (j === i ? { ...y, days: y.days - 1 } : y)))}
                      className="touch-target w-11 h-11 rounded-lg bg-primary/10 text-primary font-bold text-lg disabled:opacity-40">−</button>
                    <span className="w-8 text-center text-sm font-extrabold tabular-nums">{x.days}</span>
                    <button type="button" aria-label="One day more" disabled={firstDays <= 1}
                      onClick={() => setExtras((all) => all.map((y, j) => (j === i ? { ...y, days: y.days + 1 } : y)))}
                      className="touch-target w-11 h-11 rounded-lg bg-primary/10 text-primary font-bold text-lg disabled:opacity-40">＋</button>
                  </div>
                  <button type="button" aria-label={`Remove city ${i + 2}`} onClick={() => setExtras((all) => all.filter((_, j) => j !== i))}
                    className="touch-target w-11 h-11 rounded-lg text-danger-strong hover:bg-danger/10 font-bold">✕</button>
                </li>
              ))}
            </ol>
            <button type="button" disabled={firstDays <= 1 || extras.length >= 8}
              onClick={() => setExtras((all) => [...all, { city: '', days: 1 }])}
              className="touch-target w-full rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold py-2 disabled:opacity-40">
              ＋ Add another city
            </button>
            {stopsPreview.length > 0 && (
              <p className="text-xs font-semibold text-text/70">
                {stopsPreview.map((st) => `${st.city} ${shortDate(st.start)}–${shortDate(st.end)}`).join(' · ')}
              </p>
            )}
            {touched && !citiesReady && <p className="text-micro font-semibold text-danger-strong">{firstDays < 1 ? 'The first city needs at least one day.' : 'Name every city or remove the empty ones.'}</p>}
          </>
        )}

        {phase === 'review' && (
          <>
            <h2 className="text-lg font-extrabold text-text">Ready to go?</h2>
            <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-white/40 p-4 space-y-3">
              <div>
                <div className="text-xl font-extrabold text-text break-words">{title0}</div>
                <div className="text-sm text-text/70">
                  {mode === 'copy'
                    ? `${source?.cities.join(' → ') || source?.country || ''} · copied from ${source?.title ?? ''}`
                    : `${match?.flag ?? ''} ${citiesLabel(stopsPreview.map((st) => st.city))} · ${country}`}
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-text/50 font-bold">From</dt><dd className="font-bold">{formatLongDate(start)}</dd></div>
                <div><dt className="text-text/50 font-bold">To</dt><dd className="font-bold">{formatLongDate(mode === 'copy' ? copyEnd : end)}</dd></div>
                <div><dt className="text-text/50 font-bold">Length</dt><dd className="font-bold">{mode === 'copy' ? copySpan : diffDays(start, end) + 1} days</dd></div>
              </dl>
              {mode !== 'copy' && place && <p className="text-micro text-text/60">📍 {place.name}{place.admin1 ? `, ${place.admin1}` : ''}</p>}
              {mode === 'copy' && <p className="text-micro text-text/60">{copyCount} {copyCount === 1 ? 'place' : 'places'}{prices ? ' with prices' : ' without prices'}</p>}
              {mode === 'suggest' && <p className="text-micro text-text/60">{picks.length} suggested {picks.length === 1 ? 'place' : 'places'}, spread over {diffDays(start, end) + 1} days (you can move them later)</p>}
            </div>
            {mode === 'copy' && (
              <FormField label="Trip title" htmlFor="wz-title-review">
                <input id="wz-title-review" className={inputClass} maxLength={100} value={title} placeholder={title0}
                  onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
              </FormField>
            )}
            <p className="text-xs text-text/70">{mode === 'blank' ? "You'll add places day by day on the next screen." : 'You can change anything on the next screen.'}</p>
            <InlineError message={error} />
          </>
        )}

        {busy && (
          <div role="progressbar" aria-valuemin={0} aria-valuemax={CREATE_STEPS.length} aria-valuenow={stage + 1} aria-label="Creating your trip"
            className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
            <div className="h-full w-full origin-left bg-gradient-to-r from-primary to-accent rounded-full transition-transform duration-500 ease-out"
              style={{ transform: `scaleX(${(stage + 1) / CREATE_STEPS.length})` }} />
          </div>
        )}
        {/* Honeypot (hidden from humans): bots fill it, the server then pretends success */}
        <input id="hp-website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] w-px h-px opacity-0" />
        <div className="flex gap-2 pt-1">
          {idx > 0 && (
            <Button variant="soft" disabled={busy} onClick={() => go(flow[idx - 1])}>Back</Button>
          )}
          {phase !== 'review' ? (
            <Button className="flex-1" onClick={next}>{NEXT_LABEL[phase]}</Button>
          ) : (
            <Button className="flex-1" busy={busy} busyLabel={CREATE_STEPS[stage]} onClick={create}>
              {mode === 'copy' ? 'Copy trip' : 'Create trip'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
