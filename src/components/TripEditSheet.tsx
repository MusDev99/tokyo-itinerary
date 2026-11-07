import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { animate } from 'motion';
import { apiFetch } from '../utils/apiFetch';
import { toast } from '../utils/toast';
import { refreshPage } from '../utils/refresh';
import { lockOverlay } from '../utils/overlay';
import { prefersReducedMotion } from '../utils/motion';
import { diffDays, validateRange } from '../utils/tripDraft';
import { partsFromStops, stopsFromParts, type Stop } from '../utils/trips';
import { formatLongDate } from '../utils/calendar';
import { useDismiss } from './useDismiss';
import { inputClass } from './inputClass';
import FormField from './FormField';
import CalendarPicker from './CalendarPicker';
import Button from './ui/Button';
import InlineError from './ui/InlineError';
import ConflictNotice from './ui/ConflictNotice';

interface Props {
  tab: string;
  title: string;
  /** The trip's saved date range (null = never set) */
  dates: { start: string; end: string } | null;
  stops: Stop[];
  /** Fingerprint of title, dates and cities as loaded (conflict detection) */
  rev?: string;
  onClose: () => void;
}

interface Row { city: string; days: number }

/**
 * Edit a trip after it exists: title, dates and the cities in between. One sheet (Hick: one place for "change this
 * trip"), same rows as the wizard's Cities step (Jakob: familiar), live preview (Doherty).
 * Places already in the itinerary are never moved or deleted by this; only where new places can go changes.
 */
export default function TripEditSheet({ tab, title: initialTitle, dates, stops, rev, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [start, setStart] = useState(dates?.start || '');
  const [end, setEnd] = useState(dates?.end || '');
  const [rows, setRows] = useState<Row[]>(() => partsFromStops(stops).map((p) => ({ city: p.city, days: p.days })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [touched, setTouched] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);

  useDismiss(true, [sheet], (reason) => reason === 'escape' && onClose());
  useEffect(() => lockOverlay(), []);
  useEffect(() => {
    const el = sheet.current;
    if (el && !prefersReducedMotion()) animate(el, { opacity: [0, 1], y: [32, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
  }, []);

  const rangeError = start && end ? validateRange(start, end) : null;
  const datesOk = Boolean(start && end && !rangeError);
  const total = datesOk ? diffDays(start, end) + 1 : 0;

  // The last city takes whatever is left of the trip (same rule as the server's stopsFromParts)
  const shownDays = useMemo(() => {
    const used = rows.slice(0, -1).reduce((n, r) => n + r.days, 0);
    return rows.map((r, i) => (i === rows.length - 1 ? total - used : r.days));
  }, [rows, total]);

  const named = rows.filter((r) => r.city.trim());
  const citiesOk = rows.every((r) => r.city.trim()) && (rows.length === 0 || (datesOk && shownDays.every((d) => d >= 1)));
  const titleOk = title.trim().length >= 2;
  const ready = titleOk && (dates ? datesOk : !start && !end ? true : datesOk) && citiesOk;
  const preview = datesOk && named.length ? stopsFromParts(start, total, named.map((r, i) => ({ city: r.city, days: r.days }))) : [];

  // A new city takes a day from the one before it (the last city always holds "the rest")
  const addRow = () => setRows((all) => (all.length && datesOk
    ? [...all.slice(0, -1), { ...all[all.length - 1], days: Math.max(1, shownDays[all.length - 1] - 1) }, { city: '', days: 1 }]
    : [...all, { city: '', days: 1 }]));
  const setRow = (i: number, p: Partial<Row>) => setRows((all) => all.map((r, j) => (j === i ? { ...r, ...p } : r)));

  const save = async (e: Event, force = false) => {
    e.preventDefault();
    setTouched(true);
    if (!ready) return;
    setBusy(true);
    setError('');
    setConflict(false);
    const changedDates = datesOk && (start !== dates?.start || end !== dates?.end);
    const body: Record<string, unknown> = { tab, title: title.trim(), rev, force };
    if (changedDates) body.dates = { start, end };
    body.stops = rows.map((r) => ({ city: r.city.trim(), days: r.days }));
    const r = await apiFetch('/api/trips', { method: 'PATCH', body });
    setBusy(false);
    if (!r.ok) {
      if (r.kind === 'signed-out') return;
      setError(r.error);
      setConflict(r.status === 409);
      return;
    }
    toast.success('Trip updated');
    onClose();
    refreshPage();
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 text-left" role="presentation"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheet} role="dialog" aria-modal="true" aria-labelledby="te-title"
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-[var(--surface-solid)] text-text p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="te-title" className="text-lg font-extrabold text-text">Edit trip</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target w-11 h-11 grid place-items-center rounded-full bg-primary/10 text-primary text-lg font-bold">✕</button>
        </div>

        <form onSubmit={save} noValidate className="space-y-4">
          <FormField label="Title" htmlFor="te-t" required error={touched && !titleOk ? 'Give the trip a title' : undefined}>
            <input id="te-t" className={inputClass} maxLength={100} value={title} autoComplete="off" onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
          </FormField>
          <p className="text-micro text-text/60 -mt-2">The trip keeps its address, so shared links still work.</p>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="From" htmlFor="te-from" hideOptional><CalendarPicker id="te-from" value={start} onChange={(v) => { setStart(v); if (end && v > end) setEnd(v); }} invalid={touched && !datesOk && Boolean(start || end)} /></FormField>
            <FormField label="To" htmlFor="te-to" hideOptional><CalendarPicker id="te-to" value={end} min={start} onChange={setEnd} invalid={touched && !datesOk && Boolean(start || end)} /></FormField>
          </div>
          <p role="status" className={`text-sm font-bold -mt-2 ${rangeError ? 'text-danger-strong' : 'text-primary'}`}>
            {rangeError || (datesOk ? `${total} ${total === 1 ? 'day' : 'days'} · ${formatLongDate(start)} → ${formatLongDate(end)}` : '')}
          </p>

          <div>
            <h3 className="text-sm font-extrabold text-text mb-1">Cities</h3>
            <ol className="space-y-2" aria-label="Cities in order">
              {rows.map((r, i) => {
                const last = i === rows.length - 1;
                return (
                  <li key={i} className="flex items-center gap-2 rounded-xl bg-white/40 border border-primary/15 px-2 py-2">
                    <span className="font-extrabold text-primary w-5 text-center" aria-hidden="true">{i + 1}</span>
                    <input className={`${inputClass} flex-1`} aria-label={`City ${i + 1}`} placeholder="City" maxLength={80} value={r.city}
                      onInput={(e) => setRow(i, { city: (e.target as HTMLInputElement).value })} />
                    {last ? (
                      <span className="w-[7.5rem] text-center text-xs font-bold text-text/70 shrink-0">{datesOk ? `${Math.max(shownDays[i], 0)} ${shownDays[i] === 1 ? 'day' : 'days'} (rest)` : 'the rest'}</span>
                    ) : (
                      <div className="flex items-center shrink-0" role="group" aria-label={`Days in city ${i + 1}`}>
                        <button type="button" aria-label="One day less" disabled={r.days <= 1} onClick={() => setRow(i, { days: r.days - 1 })}
                          className="touch-target w-11 h-11 rounded-lg bg-primary/10 text-primary font-bold text-lg disabled:opacity-40">−</button>
                        <span className="w-8 text-center text-sm font-extrabold tabular-nums">{r.days}</span>
                        <button type="button" aria-label="One day more" disabled={!datesOk || shownDays[rows.length - 1] <= 1} onClick={() => setRow(i, { days: r.days + 1 })}
                          className="touch-target w-11 h-11 rounded-lg bg-primary/10 text-primary font-bold text-lg disabled:opacity-40">＋</button>
                      </div>
                    )}
                    <button type="button" aria-label={`Remove city ${i + 1}`} onClick={() => setRows((all) => all.filter((_, j) => j !== i))}
                      className="touch-target w-11 h-11 rounded-lg text-danger-strong hover:bg-danger/10 font-bold">✕</button>
                  </li>
                );
              })}
            </ol>
            <button type="button" disabled={rows.length >= 8 || (datesOk && rows.length > 0 && shownDays[rows.length - 1] <= 1)} onClick={addRow}
              className="touch-target mt-2 w-full rounded-xl border-2 border-dashed border-primary/40 text-primary text-sm font-bold py-2 disabled:opacity-40">
              ＋ Add a city
            </button>
            {preview.length > 0 && (
              <p className="mt-2 text-xs font-semibold text-text/70">{preview.map((s) => `${s.city} ${s.start.slice(5)} → ${s.end.slice(5)}`).join(' · ')}</p>
            )}
            {touched && !citiesOk && <p className="mt-1 text-micro font-semibold text-danger-strong">Name every city, set the dates, and leave at least one day for the last city.</p>}
          </div>

          <p className="text-micro text-text/60">Places already in the itinerary stay where they are. Changing the dates only changes where new places can go.</p>
          {conflict ? (
            <ConflictNotice message={error} busy={busy} onReload={() => { onClose(); refreshPage(); }} onForce={() => save(new Event('submit'), true)} />
          ) : (
            <InlineError message={error} />
          )}
          <div className="flex gap-2">
            <Button variant="soft" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" busy={busy} busyLabel="Saving…">Save changes</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
