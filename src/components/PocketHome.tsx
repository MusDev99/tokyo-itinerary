import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { redirectIfSignedOut } from '../utils/authClient';
import { sortItems, type PocketItem, type PocketKind } from '../utils/pocket';
import { formatLongDate } from '../utils/calendar';
import type { CheckGroup } from '../utils/checklist';
import type { Place } from '../types/place';
import PocketSheet, { KIND_META, type PocketDraft } from './PocketSheet';
import ConfirmDialog from './ConfirmDialog';
import { useDismiss } from './useDismiss';
import TripChecklist from './TripChecklist';
import TravelTools from './TravelTools';

interface Props {
  /** Sheet tab of the trip */
  tab: string;
  signedIn: boolean;
  loginHref: string;
  /** Trip start (from the wizard) used to pre-fill dates */
  tripStart: string;
  /** Checklist needs a planned itinerary */
  hasItinerary: boolean;
  groups: CheckGroup[];
  firstDate: string | null;
  tools: { searchName: string; savedPlace: Place | null; suggestion: Place | null; dates: string[] };
}

/** Skeleton rows while the Pocket loads (same height as a real row: no layout jump) */
function RowSkeleton() {
  return (
    <div role="status" aria-label="Loading your Pocket" className="space-y-3 py-1">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-7 h-7 rounded-lg bg-primary/15 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-primary/15" />
            <div className="h-3 w-1/2 rounded bg-primary/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** One ⋯ button per row instead of two always-visible icon buttons (Hick's Law: fewer options on screen). */
function RowMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useDismiss(open, [root], () => setOpen(false));
  return (
    <div ref={root} className="relative shrink-0">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Actions for ${label}`} onClick={() => setOpen((o) => !o)}
        className="touch-target w-11 h-11 grid place-items-center rounded-full text-text/70 hover:bg-primary/10 text-lg font-bold">⋯</button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl bg-surface-solid border border-primary/20 shadow-xl p-1">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}
            className="touch-target w-full flex items-center gap-2 px-3 rounded-lg text-sm font-semibold text-text hover:bg-primary/10 text-left">✎ Edit</button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDelete(); }}
            className="touch-target w-full flex items-center gap-2 px-3 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-500/10 text-left">🗑 Delete</button>
        </div>
      )}
    </div>
  );
}

const NOTE_BG: Record<string, string> = {
  yellow: 'bg-yellow-100 border-yellow-300', green: 'bg-green-100 border-green-300', blue: 'bg-sky-100 border-sky-300',
  purple: 'bg-violet-100 border-violet-300', pink: 'bg-pink-100 border-pink-300',
};

const when = (date: string, time: string) => [date ? formatLongDate(date) : '', time].filter(Boolean).join(' · ');

function Section({ id, title, count, open, onToggle, children }: { id: string; title: string; count?: number; open: boolean; onToggle: () => void; children: any }) {
  return (
    <section aria-labelledby={`${id}-h`} className="glass-effect rounded-2xl border border-primary/20 shadow-md">
      <h2 id={`${id}-h`}>
        <button type="button" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}
          className="touch-target w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="text-base font-extrabold text-text">{title}{count ? <span className="ml-2 text-xs font-bold text-primary">{count}</span> : null}</span>
          <span aria-hidden="true" className={`text-primary transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </h2>
      {open && <div id={`${id}-body`} className="px-3 pb-3 sm:px-4 sm:pb-4">{children}</div>}
    </section>
  );
}

/**
 * The trip's Pocket: bookings, notes, checklist and travel tools in one place.
 * Hick's Law: bookings first, the rest are collapsible sections. Bookings and notes are private:
 * they are fetched only for signed-in editors, so no booking data is ever in the page HTML.
 */
export default function PocketHome({ tab, signedIn, loginHref, tripStart, hasItinerary, groups, firstDate, tools }: Props) {
  const [items, setItems] = useState<PocketItem[] | null>(signedIn ? null : []);
  const [loadError, setLoadError] = useState('');
  const [sheet, setSheet] = useState<{ kind: PocketKind | null; item?: PocketItem } | null>(null);
  const [del, setDel] = useState<PocketItem | null>(null);
  const [delError, setDelError] = useState('');
  const [copied, setCopied] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ bookings: true, notes: true, checklist: false, tools: false });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const load = async () => {
    setLoadError('');
    try {
      const res = await fetch(`/api/pocket?tab=${encodeURIComponent(tab)}`);
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load your Pocket');
      setItems(data.items as PocketItem[]);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load your Pocket');
      setItems([]);
    }
  };
  useEffect(() => { if (signedIn) load(); }, [signedIn, tab]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(''), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const sorted = useMemo(() => sortItems(items || []), [items]);
  const bookings = sorted.filter((i) => i.kind === 'flight' || i.kind === 'stay' || i.kind === 'doc');
  const notes = sorted.filter((i) => i.kind === 'note');

  const save = async (draft: PocketDraft, id?: string): Promise<Record<string, string> | void> => {
    try {
      const res = await fetch('/api/pocket', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, id, item: draft, website: '' }),
      });
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) return data.fieldErrors || { _: data.error || 'Something went wrong' };
      // Show it at once (Doherty Threshold): the server's copy is already in the response, no second round trip
      if (id) setItems((prev) => (prev || []).map((i) => (i.id === id ? { ...i, ...draft } : i)));
      else if (data.item) setItems((prev) => [...(prev || []), data.item as PocketItem]);
      else await load();
      setSheet(null);
    } catch {
      return { _: 'Network error. Please try again.' };
    }
  };

  const toggleDone = async (item: PocketItem) => {
    const { id, createdBy, createdAt, ...rest } = item;
    setItems((prev) => (prev || []).map((i) => (i.id === id ? { ...i, done: !i.done } : i))); // optimistic (Doherty)
    const res = await fetch('/api/pocket', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, id, item: { ...rest, done: !item.done } }),
    }).catch(() => null);
    if (!res || !res.ok) load();
  };

  // Optimistic: the row leaves the list when you confirm; it comes back with a message if the server says no
  const confirmDelete = async () => {
    if (!del) return;
    const gone = del;
    const before = items;
    setItems((prev) => (prev || []).filter((i) => i.id !== gone.id));
    setDel(null);
    setDelError('');
    try {
      const res = await fetch('/api/pocket', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, id: gone.id }),
      });
      if (redirectIfSignedOut(res)) return;
      if (!res.ok) throw new Error((await res.json()).error || 'Could not delete');
    } catch (e: any) {
      setItems(before);
      setLoadError(`“${gone.title}” could not be removed: ${e?.message || 'try again'}`);
    }
  };

  const actions = (item: PocketItem) => (
    <RowMenu
      label={item.title}
      onEdit={() => setSheet({ kind: item.kind, item })}
      onDelete={() => { setDelError(''); setDel(item); }}
    />
  );

  const card = (item: PocketItem) => {
    const meta = KIND_META[item.kind];
    const d = item.details;
    return (
      <li key={item.id} id={item.id} className="flex gap-3 py-3 border-b border-primary/10 last:border-b-0 scroll-mt-24">
        <span className="text-2xl leading-none mt-0.5" aria-hidden="true">{meta.icon}</span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="text-sm font-extrabold text-text break-words">
            {item.title}{item.kind === 'flight' && (item.from || item.to) ? ` · ${item.from} → ${item.to}` : ''}
          </div>
          {item.kind === 'flight' && (
            <div className="text-xs text-text/70">
              {when(item.startDate, item.startTime)}{item.endDate || item.endTime ? ` → ${when(item.endDate !== item.startDate ? item.endDate : '', item.endTime)}` : ''}
              {[d.airline, d.terminal && `T${d.terminal}`, d.gate && `Gate ${d.gate}`, d.seat && `Seat ${d.seat}`].filter(Boolean).length > 0 &&
                <div>{[d.airline, d.terminal && `Terminal ${d.terminal}`, d.gate && `Gate ${d.gate}`, d.seat && `Seat ${d.seat}`].filter(Boolean).join(' · ')}</div>}
            </div>
          )}
          {item.kind === 'stay' && (
            <div className="text-xs text-text/70">
              {item.startDate ? `${formatLongDate(item.startDate)}${item.endDate ? ` → ${formatLongDate(item.endDate)}` : ''}` : ''}
              {d.address && <div>{d.address}</div>}
            </div>
          )}
          {item.kind === 'doc' && d.docKind && <div className="text-xs font-bold text-primary capitalize">{d.docKind}</div>}
          {item.notes && <div className="text-xs text-text/70 whitespace-pre-wrap break-words">{item.notes}</div>}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.ref && (
              <button type="button" onClick={() => { navigator.clipboard?.writeText(item.ref).then(() => setCopied(item.id)).catch(() => {}); }}
                className="touch-target px-3 h-11 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {copied === item.id ? '✓ Copied' : `Copy ${item.ref}`}
              </button>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="touch-target inline-flex items-center px-3 h-11 rounded-full bg-primary/10 text-primary text-xs font-bold">
                Open file ↗
              </a>
            )}
          </div>
        </div>
        {actions(item)}
      </li>
    );
  };

  const noteCard = (n: PocketItem) => (
    <li key={n.id} id={n.id} className={`rounded-xl border p-3 flex gap-3 ${NOTE_BG[n.colour] || NOTE_BG.yellow}`}>
      {n.todo && (
        <button type="button" role="checkbox" aria-checked={n.done} aria-label={`Mark ${n.title} done`} onClick={() => toggleDone(n)}
          className="touch-target w-11 h-11 -m-1 grid place-items-center shrink-0 text-xl">{n.done ? '☑' : '☐'}</button>
      )}
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-extrabold text-text break-words ${n.done ? 'line-through opacity-60' : ''}`}>{n.title}</div>
        {n.notes && <div className="text-xs text-text/80 whitespace-pre-wrap break-words mt-0.5">{n.notes}</div>}
      </div>
      {actions(n)}
    </li>
  );

  const empty = (text: string) => <p className="text-sm text-text/60 px-1 py-2">{text}</p>;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {signedIn ? (
        <button type="button" onClick={() => setSheet({ kind: null })} aria-haspopup="dialog"
          className="touch-target w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 h-12 rounded-xl bg-primary text-white text-base font-extrabold shadow-md hover:opacity-95 active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,opacity,transform]">
          <span aria-hidden="true" className="text-lg">＋</span> Put it in Pocket
        </button>
      ) : (
        <a href={loginHref} className="touch-target inline-flex w-full sm:w-auto items-center justify-center px-5 h-12 rounded-xl bg-primary/10 text-primary text-sm font-extrabold">
          🔒 Sign in to see and add bookings
        </a>
      )}

      {signedIn && (
        <>
          {loadError && (
            <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm font-semibold text-red-800 flex items-center justify-between gap-2">
              {loadError}
              <button type="button" onClick={load} className="touch-target px-3 font-bold underline">Retry</button>
            </div>
          )}
          <Section id="pk-bookings" title="Bookings & docs" count={bookings.length} open={open.bookings} onToggle={() => toggle('bookings')}>
            {items === null ? <RowSkeleton /> : bookings.length === 0 ? empty('No flights, stays or docs yet. Add one with the button above.') : <ul className="space-y-2">{bookings.map(card)}</ul>}
          </Section>
          <Section id="pk-notes" title="Notes" count={notes.length} open={open.notes} onToggle={() => toggle('notes')}>
            {items === null ? <RowSkeleton /> : notes.length === 0 ? empty('Door codes, wifi, reminders.') : <ul className="space-y-2">{notes.map(noteCard)}</ul>}
          </Section>
        </>
      )}

      <Section id="pk-checklist" title="Checklist" open={open.checklist} onToggle={() => toggle('checklist')}>
        {hasItinerary
          ? <TripChecklist tab={tab} groups={groups} firstDate={firstDate} />
          : empty('Add places to your itinerary to get a tailored checklist.')}
      </Section>
      <Section id="pk-tools" title="Location & prayer times" open={open.tools} onToggle={() => toggle('tools')}>
        <TravelTools tab={tab} searchName={tools.searchName} savedPlace={tools.savedPlace} suggestion={tools.suggestion} dates={tools.dates} canEdit={signedIn} />
      </Section>

      {sheet && (
        <PocketSheet kind={sheet.kind} item={sheet.item} defaultDate={tripStart} onSave={save} onClose={() => setSheet(null)} />
      )}
      <ConfirmDialog open={Boolean(del)} title="Remove from Pocket?" message={del ? `“${del.title}” will be removed for everyone with access.` : ''}
        confirmLabel="Remove" busy={false} error={delError} onConfirm={confirmDelete} onCancel={() => setDel(null)} />
    </div>
  );
}
