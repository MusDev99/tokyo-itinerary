import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { createPortal } from 'preact/compat';
import { prefersReducedMotion } from '../utils/motion';
import { lockOverlay } from '../utils/overlay';
import { DOC_KINDS, NOTE_COLOURS, type PocketItem, type PocketKind } from '../utils/pocket';
import { useDismiss } from './useDismiss';
import FormField from './FormField';
import CalendarPicker from './CalendarPicker';
import AnalogTimePicker from './AnalogTimePicker';
import { inputClass } from './inputClass';
import InlineError from './ui/InlineError';
import Button from './ui/Button';

export type PocketDraft = Omit<PocketItem, 'id' | 'createdBy' | 'createdAt'>;

export const KIND_META: Record<PocketKind, { icon: string; label: string; hint: string }> = {
  flight: { icon: '✈️', label: 'Flight', hint: 'Number, route, times' },
  stay: { icon: '🏨', label: 'Stay', hint: 'Hotel, check-in/out' },
  doc: { icon: '📄', label: 'Doc', hint: 'Visa, insurance, booking' },
  note: { icon: '📝', label: 'Note', hint: 'Codes, wifi, to-dos' },
};

export const emptyDraft = (kind: PocketKind, startDate = ''): PocketDraft => ({
  kind, title: '', startDate, startTime: '', endDate: '', endTime: '', from: '', to: '', ref: '', notes: '',
  url: '', colour: kind === 'note' ? 'yellow' : '', todo: false, done: false, details: {},
});

const COLOUR_CLASS: Record<string, string> = {
  yellow: 'bg-yellow-300', green: 'bg-green-300', blue: 'bg-sky-300', purple: 'bg-violet-300', pink: 'bg-pink-300',
};

interface Props {
  /** Open on this kind (skips the chooser); null = show the chooser */
  kind: PocketKind | null;
  /** Existing item to edit */
  item?: PocketItem | null;
  defaultDate?: string;
  /** Resolves to field errors (or nothing on success) */
  onSave: (draft: PocketDraft, id?: string) => Promise<Record<string, string> | void>;
  onClose: () => void;
}

/**
 * "Put it in Pocket": type chooser, then one short form.
 * Hick's Law: required fields first, the rest behind "More details". Fitts's Law: bottom sheet, 44px targets.
 */
export default function PocketSheet({ kind: initialKind, item, defaultDate = '', onSave, onClose }: Props) {
  const [kind, setKind] = useState<PocketKind | null>(item ? item.kind : initialKind);
  const [draft, setDraft] = useState<PocketDraft>(() => {
    if (item) { const { id, createdBy, createdAt, ...rest } = item; return rest; }
    return emptyDraft(initialKind || 'flight', defaultDate);
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(Boolean(item));
  const sheet = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);

  useDismiss(true, [sheet], (reason) => reason === 'escape' && onClose());

  useEffect(() => lockOverlay(), []);

  useEffect(() => {
    const el = sheet.current;
    if (el && !prefersReducedMotion()) animate(el, { opacity: [0, 1], y: [32, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
  }, []);
  useEffect(() => { first.current?.focus(); }, [kind]);

  const patch = (p: Partial<PocketDraft>) => setDraft((d) => ({ ...d, ...p }));
  const detail = (k: string, v: string) => setDraft((d) => ({ ...d, details: { ...d.details, [k]: v } }));
  const choose = (k: PocketKind) => { setKind(k); setDraft(emptyDraft(k, defaultDate)); setMore(false); setErrs({}); };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    try {
      const result = await onSave({ ...draft, kind }, item?.id);
      if (result) setErrs(result);
    } finally {
      setBusy(false);
    }
  };

  const text = (id: string, key: keyof PocketDraft, props: Record<string, any> = {}) => (
    <input id={id} type="text" className={inputClass} maxLength={200} autoComplete="off"
      value={draft[key] as string} onInput={(e) => patch({ [key]: (e.target as HTMLInputElement).value } as any)} {...props} />
  );

  const titleLabel = kind === 'flight' ? 'Flight number' : kind === 'stay' ? 'Place name' : kind === 'doc' ? 'Name' : 'Title';
  const titlePlaceholder = kind === 'flight' ? 'e.g. GA 874' : kind === 'stay' ? 'e.g. Hotel Gracery Shinjuku' : kind === 'doc' ? 'e.g. Japan eVisa' : 'e.g. Wifi & door codes';

  // Portal to <body> so glass/backdrop-filter ancestors can't trap the fixed overlay; z-90 is above header/tab bar, below the pickers (100)
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 sm:p-4 text-left" role="presentation"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={sheet} role="dialog" aria-modal="true" aria-labelledby="pk-title"
        className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl bg-[var(--surface-solid)] text-text p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="pk-title" className="text-lg font-extrabold text-text">
            {!kind ? 'Put it in Pocket' : `${item ? 'Edit' : 'New'} ${KIND_META[kind].label.toLowerCase()}`}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="touch-target w-11 h-11 grid place-items-center rounded-full bg-primary/10 text-primary text-lg font-bold">✕</button>
        </div>

        {!kind && (
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(KIND_META) as PocketKind[]).map((k) => (
              <button key={k} type="button" onClick={() => choose(k)}
                className="touch-target min-h-[88px] rounded-2xl border-2 border-primary/25 bg-white/60 p-3 text-left hover:border-primary/60 active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                <span className="text-2xl" aria-hidden="true">{KIND_META[k].icon}</span>
                <span className="block text-sm font-extrabold text-text">{KIND_META[k].label}</span>
                <span className="block text-micro text-text/60">{KIND_META[k].hint}</span>
              </button>
            ))}
          </div>
        )}

        {kind && (
          <form onSubmit={submit} noValidate className="space-y-4">
            <FormField label={titleLabel} htmlFor="pk-t" required error={errs.title}>
              {text('pk-t', 'title', { ref: first, placeholder: titlePlaceholder })}
            </FormField>

            {kind === 'flight' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="From" htmlFor="pk-from" required error={errs.from}>{text('pk-from', 'from', { placeholder: 'CGK', maxLength: 100 })}</FormField>
                  <FormField label="To" htmlFor="pk-to" required error={errs.to}>{text('pk-to', 'to', { placeholder: 'NRT', maxLength: 100 })}</FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Departs" htmlFor="pk-sd" required error={errs.startDate}>
                    <CalendarPicker id="pk-sd" value={draft.startDate} invalid={!!errs.startDate} onChange={(startDate) => patch({ startDate, endDate: draft.endDate || startDate })} />
                  </FormField>
                  <FormField label="Time" htmlFor="pk-st" error={errs.startTime}>
                    <AnalogTimePicker id="pk-st" value={draft.startTime} onChange={(startTime) => patch({ startTime })} />
                  </FormField>
                  <FormField label="Arrives" htmlFor="pk-ed" error={errs.endDate}>
                    <CalendarPicker id="pk-ed" value={draft.endDate} min={draft.startDate} invalid={!!errs.endDate} onChange={(endDate) => patch({ endDate })} />
                  </FormField>
                  <FormField label="Time" htmlFor="pk-et" error={errs.endTime}>
                    <AnalogTimePicker id="pk-et" value={draft.endTime} onChange={(endTime) => patch({ endTime })} />
                  </FormField>
                </div>
              </>
            )}

            {kind === 'stay' && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Check-in" htmlFor="pk-sd" required error={errs.startDate}>
                  <CalendarPicker id="pk-sd" value={draft.startDate} invalid={!!errs.startDate} onChange={(startDate) => patch({ startDate })} />
                </FormField>
                <FormField label="Check-out" htmlFor="pk-ed" error={errs.endDate}>
                  <CalendarPicker id="pk-ed" value={draft.endDate} min={draft.startDate} invalid={!!errs.endDate} onChange={(endDate) => patch({ endDate })} />
                </FormField>
              </div>
            )}

            {kind === 'doc' && (
              <div>
                <div id="pk-dk" className="text-xs font-bold text-text/80 mb-1.5">Type <span className="text-text/40 font-medium">(optional)</span></div>
                <div role="radiogroup" aria-labelledby="pk-dk" className="flex flex-wrap gap-2">
                  {DOC_KINDS.map((d) => {
                    const on = draft.details.docKind === d;
                    return (
                      <button key={d} type="button" role="radio" aria-checked={on} onClick={() => detail('docKind', on ? '' : d)}
                        className={`touch-target px-3 h-11 rounded-full border-2 text-xs font-bold capitalize ${on ? 'bg-primary text-white border-primary' : 'bg-white/60 border-primary/25 text-text'}`}>
                        {d}
                      </button>
                    );
                  })}
                </div>
                {errs.docKind && <span className="text-micro font-semibold text-danger-strong">{errs.docKind}</span>}
              </div>
            )}

            {kind === 'note' && (
              <>
                <FormField label="Note" htmlFor="pk-n">
                  <textarea id="pk-n" rows={3} maxLength={2000} className={inputClass} value={draft.notes}
                    placeholder="Airbnb door code 4471"
                    onInput={(e) => patch({ notes: (e.target as HTMLTextAreaElement).value })} />
                </FormField>
                <div className="flex items-center gap-3 flex-wrap">
                  <div role="radiogroup" aria-label="Colour" className="flex gap-2">
                    {NOTE_COLOURS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={draft.colour === c} aria-label={c}
                        onClick={() => patch({ colour: c })}
                        className={`touch-target w-11 h-11 rounded-full ${COLOUR_CLASS[c]} ${draft.colour === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
                    ))}
                  </div>
                  <label className="touch-target flex items-center gap-2 text-sm font-bold text-text">
                    <input type="checkbox" className="w-5 h-5" checked={draft.todo}
                      onChange={(e) => patch({ todo: (e.target as HTMLInputElement).checked, done: false })} />
                    To-do
                  </label>
                </div>
              </>
            )}

            {kind !== 'note' && (
              <div>
                <button type="button" aria-expanded={more} onClick={() => setMore((m) => !m)} className="touch-target text-sm font-bold text-primary px-1">
                  {more ? '− Fewer details' : '＋ More details'}
                </button>
                {more && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {kind === 'flight' && (
                      <>
                        <FormField label="Airline" htmlFor="pk-al" className="col-span-2">
                          <input id="pk-al" type="text" className={inputClass} maxLength={60} value={draft.details.airline || ''} onInput={(e) => detail('airline', (e.target as HTMLInputElement).value)} />
                        </FormField>
                        <FormField label="Seat" htmlFor="pk-seat"><input id="pk-seat" type="text" className={inputClass} maxLength={60} value={draft.details.seat || ''} onInput={(e) => detail('seat', (e.target as HTMLInputElement).value)} /></FormField>
                        <FormField label="Gate" htmlFor="pk-gate"><input id="pk-gate" type="text" className={inputClass} maxLength={60} value={draft.details.gate || ''} onInput={(e) => detail('gate', (e.target as HTMLInputElement).value)} /></FormField>
                        <FormField label="Terminal" htmlFor="pk-term" className="col-span-2"><input id="pk-term" type="text" className={inputClass} maxLength={60} value={draft.details.terminal || ''} onInput={(e) => detail('terminal', (e.target as HTMLInputElement).value)} /></FormField>
                      </>
                    )}
                    {kind === 'stay' && (
                      <>
                        <FormField label="Address" htmlFor="pk-addr" className="col-span-2">
                          <input id="pk-addr" type="text" className={inputClass} maxLength={300} value={draft.details.address || ''} onInput={(e) => detail('address', (e.target as HTMLInputElement).value)} />
                        </FormField>
                        <FormField label="Check-in time" htmlFor="pk-st" error={errs.startTime}><AnalogTimePicker id="pk-st" value={draft.startTime} onChange={(startTime) => patch({ startTime })} /></FormField>
                        <FormField label="Check-out time" htmlFor="pk-et" error={errs.endTime}><AnalogTimePicker id="pk-et" value={draft.endTime} onChange={(endTime) => patch({ endTime })} /></FormField>
                      </>
                    )}
                    <FormField label="Confirmation" htmlFor="pk-ref" className="col-span-2">{text('pk-ref', 'ref', { maxLength: 60 })}</FormField>
                    <FormField label="Link to ticket / file" htmlFor="pk-url" error={errs.url} className="col-span-2">
                      {text('pk-url', 'url', { type: 'url', inputMode: 'url', maxLength: 500, placeholder: 'https://drive.google.com/…' })}
                    </FormField>
                    <FormField label="Notes" htmlFor="pk-notes" className="col-span-2">
                      <textarea id="pk-notes" rows={2} maxLength={2000} className={inputClass} value={draft.notes} onInput={(e) => patch({ notes: (e.target as HTMLTextAreaElement).value })} />
                    </FormField>
                    <p className="col-span-2 text-micro text-text/60">Everyone with edit access to the sheet can read this. Don't store passport numbers.</p>
                  </div>
                )}
              </div>
            )}

            <InlineError message={errs._} />

            <div className="flex gap-2">
              <Button variant="soft" onClick={() => (item || initialKind ? onClose() : setKind(null))}>{item || initialKind ? 'Cancel' : 'Back'}</Button>
              <Button type="submit" className="flex-1" busy={busy} busyLabel="Saving…">{item ? 'Save changes' : 'Put it in Pocket'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
