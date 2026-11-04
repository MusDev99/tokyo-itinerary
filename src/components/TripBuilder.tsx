import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { redirectIfSignedOut } from '../utils/authClient';
import { prefersReducedMotion } from '../utils/motion';
import { CATEGORIES } from '../utils/analytics';
import { buildDays, nextFreeDay, suggestNextTime, addDays, dayLabel, isIsoDate, MAX_TRIP_DAYS } from '../utils/tripDraft';
import { useDismiss } from './useDismiss';
import FormField from './FormField';
import AnalogTimePicker from './AnalogTimePicker';
import { MoreFields, emptyActivity, draftToPayload, inputClass, type ActivityDraft } from './ActivityFields';

interface PlannedDay {
  /** ISO date of the day */
  date: string;
  title: string;
  /** Time of its last activity, used to suggest the next slot */
  lastTime: string;
}

interface Props {
  country: string;
  state: string;
  currency: string;
  /** Saved trip range from the wizard (legacy trips have none) */
  dates: { start: string; end: string } | null;
  /** Days that already have activities */
  planned: PlannedDay[];
  /** Show a larger call to action (trip has no activities yet) */
  empty?: boolean;
}

const weekday = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const dayNum = (iso: string) => Number(iso.slice(8, 10));

/**
 * Day-first quick add. A bottom sheet on phones (thumb reach, Fitts's Law), a centred dialog from sm up.
 * Hick's Law: day, title and time up front; price and description live behind "More details".
 * Miller's Law: the days are chunked into chips, one day at a time.
 */
export default function TripBuilder({ country, state, currency, dates, planned, empty = false }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const [more, setMore] = useState(false);
  const [date, setDate] = useState('');
  const [draft, setDraft] = useState<ActivityDraft>(() => emptyActivity(currency));
  const sheet = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);

  const plannedByDate = useMemo(() => new Map(planned.map((p) => [p.date, p])), [planned]);

  // Chips: the trip range plus any planned day outside it, plus one extra day to extend the trip
  const days = useMemo(() => {
    const set = new Set<string>(dates ? buildDays(dates.start, dates.end) : []);
    planned.forEach((p) => isIsoDate(p.date) && set.add(p.date));
    const sorted = [...set].sort();
    return sorted;
  }, [dates, planned]);
  const canExtend = days.length < MAX_TRIP_DAYS;
  const lastDay = days[days.length - 1];

  const patch = (p: Partial<ActivityDraft>) => setDraft((d) => ({ ...d, ...p }));

  const pickDay = (iso: string) => {
    setDate(iso);
    // Continue from the previous item's end (Doherty: sensible default, one less tap)
    patch({ time: suggestNextTime(plannedByDate.get(iso)?.lastTime) });
  };

  const openSheet = () => {
    const first = nextFreeDay(days, planned.map((p) => p.date)) || new Date().toISOString().slice(0, 10);
    setDate(first);
    setDraft({ ...emptyActivity(currency), time: suggestNextTime(plannedByDate.get(first)?.lastTime) });
    setErrs({});
    setError('');
    setMore(false);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    // The timeline is server-rendered: refresh once, after the last save, not on every one
    if (saved > 0) window.location.reload();
  };

  useDismiss(open, [sheet], (reason) => reason === 'escape' && close());

  useEffect(() => {
    if (!open) return;
    titleInput.current?.focus();
    const el = sheet.current;
    if (el && !prefersReducedMotion()) {
      animate(el, { opacity: [0, 1], y: [32, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (e: Event) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (!draft.title.trim()) e2.title = 'Give this place a name';
    if (!isIsoDate(date)) e2.date = 'Pick a day';
    setErrs(e2);
    if (Object.keys(e2).length) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          state,
          activities: [{ ...draftToPayload(draft), date }],
          website: '',
        }),
      });
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        if (data.rowErrors?.[0]) setErrs(data.rowErrors[0]);
        return;
      }
      setSaved((n) => n + 1);
      setToast(`✓ Added “${draft.title.trim()}”`);
      // Stay open for the next place: bump the time, clear the text (rapid entry)
      setDraft({ ...emptyActivity(currency), category: draft.category, time: suggestNextTime(draft.time) });
      setMore(false);
      titleInput.current?.focus();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const dayChip = (iso: string, i: number) => {
    const active = date === iso;
    const count = plannedByDate.has(iso);
    return (
      <button key={iso} type="button" role="radio" aria-checked={active} onClick={() => pickDay(iso)}
        className={`touch-target shrink-0 min-w-[64px] px-3 py-2 rounded-xl border-2 text-center transition-colors ${
          active ? 'bg-primary text-white border-primary' : 'bg-white/60 text-text border-primary/25 hover:border-primary/60'
        }`}>
        <span className="block text-xs font-extrabold">{dayLabel(i)}</span>
        <span className={`block text-[10px] font-bold ${active ? 'text-white/80' : 'text-text/60'}`}>
          {weekday(iso)} {dayNum(iso)}{count ? ' •' : ''}
        </span>
      </button>
    );
  };

  return (
    <>
      <button type="button" onClick={openSheet} aria-haspopup="dialog"
        className={`touch-target inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-primary text-white text-sm font-extrabold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all ${
          empty ? 'w-full h-12 text-base' : 'w-full sm:w-auto'
        }`}>
        <span aria-hidden="true" className="text-lg leading-none">＋</span> Add place
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" role="presentation"
          onPointerDown={(e) => e.target === e.currentTarget && close()}>
          <div ref={sheet} role="dialog" aria-modal="true" aria-labelledby="tb-title"
            className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="tb-title" className="text-lg font-extrabold text-text">Add place</h2>
              <button type="button" onClick={close} aria-label="Close"
                className="touch-target w-11 h-11 grid place-items-center rounded-full bg-primary/10 text-primary text-lg font-bold">✕</button>
            </div>

            <form onSubmit={save} noValidate className="space-y-4">
              <div>
                <div className="text-xs font-bold text-text/80 mb-1.5" id="tb-day-label">Day</div>
                <div role="radiogroup" aria-labelledby="tb-day-label" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {days.map(dayChip)}
                  {canExtend && (
                    <button type="button" aria-label="Add another day"
                      onClick={() => pickDay(lastDay ? addDays(lastDay, 1) : date)}
                      className="touch-target shrink-0 min-w-[56px] rounded-xl border-2 border-dashed border-primary/40 text-primary text-xl font-bold">
                      ＋
                    </button>
                  )}
                </div>
                {errs.date && <span className="text-[11px] font-semibold text-red-600">{errs.date}</span>}
                {date && !days.includes(date) && (
                  <p className="text-[11px] text-text/60 mt-1">New day: {weekday(date)} {date}</p>
                )}
              </div>

              <FormField label="Place" htmlFor="tb-place" required error={errs.title}>
                <input id="tb-place" ref={titleInput} type="text" maxLength={200} className={inputClass} autoComplete="off"
                  placeholder="e.g. Senso-ji Temple"
                  value={draft.title} onInput={(e) => patch({ title: (e.target as HTMLInputElement).value })} />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Time" htmlFor="tb-time" error={errs.time}>
                  <AnalogTimePicker id="tb-time" value={draft.time} onChange={(time) => patch({ time })} />
                </FormField>
                <FormField label="Location" htmlFor="tb-loc">
                  <input id="tb-loc" type="text" maxLength={200} className={inputClass} placeholder="For the map link"
                    value={draft.location_name} onInput={(e) => patch({ location_name: (e.target as HTMLInputElement).value })} />
                </FormField>
              </div>

              <div>
                <div className="text-xs font-bold text-text/80 mb-1.5" id="tb-cat-label">Type <span className="text-text/40 font-medium">(optional)</span></div>
                <div role="radiogroup" aria-labelledby="tb-cat-label" className="flex flex-wrap gap-2">
                  {Object.values(CATEGORIES).map((c) => {
                    const active = draft.category === c.key;
                    return (
                      <button key={c.key} type="button" role="radio" aria-checked={active}
                        onClick={() => patch({ category: active ? '' : c.key })}
                        className={`touch-target px-3 h-11 rounded-full border-2 text-xs font-bold transition-colors ${
                          active ? 'bg-primary text-white border-primary' : 'bg-white/60 border-primary/25 text-text hover:border-primary/60'
                        }`}>
                        {c.emoji} {c.label.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)}
                  className="touch-target text-sm font-bold text-primary px-1">
                  {more ? '− Fewer details' : '＋ More details (price, notes)'}
                </button>
                {more && (
                  <div className="mt-2">
                    <MoreFields idPrefix="tb" value={draft} errors={errs} onChange={patch} />
                  </div>
                )}
              </div>

              {error && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-800">{error}</div>}
              <div role="status" aria-live="polite" className="min-h-[1.25rem] text-sm font-bold text-emerald-700">{toast}</div>

              <div className="flex gap-2">
                <button type="button" onClick={close}
                  className="touch-target px-5 py-3 rounded-xl bg-primary/10 text-primary text-sm font-bold">
                  {saved ? 'Done' : 'Cancel'}
                </button>
                <button type="submit" disabled={busy}
                  className="touch-target flex-1 px-5 py-3 rounded-xl bg-primary text-white text-sm sm:text-base font-extrabold shadow-md disabled:opacity-60">
                  {busy ? 'Saving…' : saved ? 'Add another' : 'Add place'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
