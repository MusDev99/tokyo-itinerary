import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { createPortal } from 'preact/compat';
import { prefersReducedMotion } from '../utils/motion';
import { lockOverlay } from '../utils/overlay';
import { CATEGORIES } from '../utils/analytics';
import { addDays, dayLabel, isIsoDate, MAX_TRIP_DAYS } from '../utils/tripDraft';
import { useDismiss } from './useDismiss';
import FormField from './FormField';
import AnalogTimePicker from './AnalogTimePicker';
import { MoreFields, inputClass, type ActivityDraft } from './ActivityFields';
import InlineError from './ui/InlineError';
import Button from './ui/Button';

export type SaveResult = Record<string, string> | void;

interface Props {
  mode: 'add' | 'edit';
  /** Starting values; `date` is the selected day */
  initial: ActivityDraft;
  /** Days that can be picked (ISO, ascending) */
  days: string[];
  /** Days that already have activities (dot on the chip) */
  plannedDays?: string[];
  /** Add only: offer one more day after the last (extends the trip) */
  canExtend?: boolean;
  /** Add only: time to pre-fill when a day is picked ('' = leave unset) */
  suggestTime?: (iso: string) => string;
  /** The trip's cities: with two or more, a City row appears (Hick's Law: nothing extra for one-city trips) */
  cities?: string[];
  /** City of a day (from the trip's stops), used when a day is picked */
  cityForDate?: (iso: string) => string;
  /** Returns field errors (keys: title, date, time, price_amount, _ for a general message) or nothing on success */
  onSave: (draft: ActivityDraft) => Promise<SaveResult>;
  /** `saved` = number of places saved while the sheet was open */
  onClose: (saved: number) => void;
}

const weekday = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const monthShort = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

const hasExtras = (d: ActivityDraft) => Boolean(d.location_name || d.description || d.price_amount || d.price_notes);
const same = (a: ActivityDraft, b: ActivityDraft) =>
  JSON.stringify({ ...a, currencyTouched: undefined }) === JSON.stringify({ ...b, currencyTouched: undefined });

/**
 * One sheet for adding and editing a place (a bottom sheet on phones, a dialog from sm up).
 * Lean by design:
 *  - Hick's Law: day, place, time and type up front; location and price live under "More details".
 *  - Miller's Law: days are chips, one at a time; the selected chip scrolls into view.
 *  - Fitts's Law: 44px chips, full-width actions pinned to the bottom, thumb reach.
 *  - Doherty Threshold: Add stays open for the next place (toast in under 400ms); Save is off until something changed.
 *  - Jakob's Law: the familiar sheet + chips pattern from maps and booking apps.
 */
export default function ActivitySheet({ mode, initial, days, plannedDays = [], canExtend = false, suggestTime, cities = [], cityForDate, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ActivityDraft>(initial);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);
  const [toast, setToast] = useState('');
  const [more, setMore] = useState(mode === 'edit' && hasExtras(initial));
  const sheet = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const chips = useRef<HTMLDivElement>(null);
  const types = useRef<HTMLDivElement>(null);
  const cityTouched = useRef(false);

  const planned = useMemo(() => new Set(plannedDays), [plannedDays]);
  const lastDay = days[days.length - 1];
  // A day picked through "＋" is not in `days` yet: show it as an extra chip
  const shown = useMemo(() => {
    const all = new Set(days);
    if (isIsoDate(draft.date)) all.add(draft.date);
    return [...all].sort();
  }, [days, draft.date]);
  const dirty = mode === 'add' || !same(draft, initial);

  const patch = (p: Partial<ActivityDraft>) => setDraft((d) => ({ ...d, ...p }));
  const close = () => onClose(saved);

  useDismiss(true, [sheet], (reason) => reason === 'escape' && close());

  // Keep the page from scrolling behind the sheet
  useEffect(() => lockOverlay(), []);

  useEffect(() => {
    if (mode === 'add') titleInput.current?.focus();
    const el = sheet.current;
    if (el && !prefersReducedMotion()) animate(el, { opacity: [0, 1], y: [32, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
  }, []);

  // With a long trip the selected day can sit off-screen: bring it into view
  useEffect(() => {
    const el = chips.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [draft.date]);

  // Editing: the saved type may sit off-screen in the scrolling row
  useEffect(() => {
    types.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const pickDay = (iso: string) => {
    // Picking a day also picks its city (a trip moving from Tokyo to Osaka on day 5), unless the person chose one
    patch({
      date: iso,
      ...(mode === 'add' && suggestTime ? { time: suggestTime(iso) } : {}),
      ...(cities.length > 1 && cityForDate && !cityTouched.current ? { city: cityForDate(iso) } : {}),
    });
    setErrs((e) => ({ ...e, date: '' }));
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!draft.title.trim()) local.title = 'Give this place a name';
    if (!isIsoDate(draft.date)) local.date = 'Pick a day';
    setErrs(local);
    if (Object.keys(local).length) {
      if (local.title) titleInput.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await onSave(draft);
      if (result) {
        setErrs(result);
        return;
      }
      if (mode === 'edit') {
        onClose(1);
        return;
      }
      // Add: stay open for the next place, continuing from this one's time
      setSaved((n) => n + 1);
      setToast(`✓ Added “${draft.title.trim()}”`);
      setDraft((d) => ({ ...initial, date: d.date, category: d.category, price_currency: d.price_currency, time: suggestTime ? suggestTime(d.date) : '' }));
      setMore(false);
      titleInput.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const dayChip = (iso: string, i: number) => {
    const active = draft.date === iso;
    return (
      <button key={iso} type="button" role="radio" aria-checked={active} onClick={() => pickDay(iso)}
        className={`touch-target shrink-0 snap-start min-w-[68px] px-3 py-2 rounded-xl border-2 text-center transition-colors ${
          active ? 'bg-primary text-white border-primary' : 'bg-white/60 text-text border-primary/25 hover:border-primary/60'
        }`}>
        <span className="block text-xs font-extrabold">{dayLabel(i)}</span>
        <span className={`block text-micro font-bold ${active ? 'text-white/80' : 'text-text/60'}`}>
          {weekday(iso)} {Number(iso.slice(8))} {monthShort(iso)}{planned.has(iso) ? ' •' : ''}
        </span>
      </button>
    );
  };

  return createPortal(
    // Portal to <body> (a blurred ancestor traps `fixed`); z-90: above header (50) and tab bar (40), below the pickers (100)
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4 text-left" role="presentation"
      onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div ref={sheet} role="dialog" aria-modal="true" aria-labelledby="as-title"
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-[var(--surface-solid)] text-text shadow-2xl">
        <form onSubmit={submit} noValidate className="flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6 pb-2">
            <h2 id="as-title" className="text-lg font-extrabold text-text">{mode === 'edit' ? 'Edit place' : 'Add place'}</h2>
            <button type="button" onClick={close} aria-label="Close"
              className="touch-target w-11 h-11 grid place-items-center rounded-full bg-primary/10 text-primary text-lg font-bold">✕</button>
          </div>

          <div className="overflow-y-auto overscroll-contain px-4 sm:px-6 pb-2 space-y-4">
            <div>
              <div className="text-xs font-bold text-text/80 mb-1.5" id="as-day">Day</div>
              <div ref={chips} role="radiogroup" aria-labelledby="as-day" className="flex gap-2 overflow-x-auto snap-x pb-1 -mx-1 px-1">
                {shown.map(dayChip)}
                {canExtend && shown.length < MAX_TRIP_DAYS && (
                  <button type="button" aria-label="Add another day" onClick={() => pickDay(addDays(shown[shown.length - 1] || lastDay || draft.date, 1))}
                    className="touch-target shrink-0 min-w-[56px] rounded-xl border-2 border-dashed border-primary/40 text-primary text-xl font-bold">＋</button>
                )}
              </div>
              {errs.date && <span className="text-micro font-semibold text-danger-strong">{errs.date}</span>}
              {mode === 'edit' && <p className="text-micro text-text/55 mt-1">Trip days only</p>}
            </div>

            {cities.length > 1 && (
              <div>
                <div className="text-xs font-bold text-text/80 mb-1.5" id="as-city">City</div>
                <div role="radiogroup" aria-labelledby="as-city" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {cities.map((c) => {
                    const on = draft.city.toLowerCase() === c.toLowerCase();
                    return (
                      <button key={c} type="button" role="radio" aria-checked={on}
                        onClick={() => { cityTouched.current = true; patch({ city: c }); }}
                        className={`touch-target shrink-0 px-3 h-11 rounded-full border-2 text-xs font-bold transition-colors ${
                          on ? 'bg-primary text-white border-primary' : 'bg-white/60 border-primary/25 text-text hover:border-primary/60'
                        }`}>
                        📍 {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FormField label="Place" htmlFor="as-place" required error={errs.title}>
              <input id="as-place" ref={titleInput} type="text" maxLength={200} className={inputClass} autoComplete="off"
                placeholder="e.g. Senso-ji Temple"
                value={draft.title} onInput={(e) => patch({ title: (e.target as HTMLInputElement).value })} />
            </FormField>

            <FormField label="Time" htmlFor="as-time" error={errs.time}>
              <div className="flex items-stretch gap-2">
                <div className="flex-1 min-w-0">
                  <AnalogTimePicker id="as-time" value={draft.time} placeholder="--:--" onChange={(time) => patch({ time })} />
                </div>
                {draft.time && (
                  <button type="button" onClick={() => patch({ time: '' })} aria-label="Clear time"
                    className="touch-target w-11 shrink-0 rounded-xl bg-primary/10 text-primary font-bold">✕</button>
                )}
              </div>
            </FormField>

            <div>
              <div className="text-xs font-bold text-text/80 mb-1.5" id="as-type">Type <span className="text-text/40 font-medium">(optional)</span></div>
              {/* One scrolling row, not a wrapped grid: keeps the sheet short (Hick) */}
              <div ref={types} role="radiogroup" aria-labelledby="as-type" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {Object.values(CATEGORIES).map((c) => {
                  const on = draft.category === c.key;
                  return (
                    <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => patch({ category: on ? '' : c.key })}
                      className={`touch-target shrink-0 px-3 h-11 rounded-full border-2 text-xs font-bold transition-colors ${
                        on ? 'bg-primary text-white border-primary' : 'bg-white/60 border-primary/25 text-text hover:border-primary/60'
                      }`}>
                      {c.emoji} {c.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="touch-target text-sm font-bold text-primary px-1">
                {more ? '− Fewer details' : '＋ More details (location, price, notes)'}
              </button>
              {more && (
                <div className="mt-2 space-y-3">
                  <FormField label="Location" htmlFor="as-loc">
                    <input id="as-loc" type="text" maxLength={200} className={inputClass} placeholder="Used for the map link"
                      value={draft.location_name} onInput={(e) => patch({ location_name: (e.target as HTMLInputElement).value })} />
                  </FormField>
                  <MoreFields idPrefix="as" value={draft} errors={errs} onChange={patch} />
                </div>
              )}
            </div>

            <InlineError message={errs._} />
            <div role="status" aria-live="polite" className="min-h-[1.25rem] text-sm font-bold text-success-strong">{toast}</div>
          </div>

          {/* Pinned actions: always in thumb reach, however long the form gets */}
          <div className="flex gap-2 px-4 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-primary/10">
            <Button variant="soft" onClick={close}>{saved ? 'Done' : 'Cancel'}</Button>
            <Button type="submit" className="flex-1" disabled={!dirty} busy={busy} busyLabel="Saving…">
              {mode === 'edit' ? 'Save changes' : saved ? 'Add another' : 'Add place'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
