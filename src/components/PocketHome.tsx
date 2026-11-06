import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { apiFetch } from '../utils/apiFetch';
import { toast } from '../utils/toast';
import InlineError from './ui/InlineError';
import { ListSkeleton } from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import { sortItems, type PocketItem, type PocketKind } from '../utils/pocket';
import { formatLongDate } from '../utils/calendar';
import type { CheckGroup } from '../utils/checklist';
import type { Place } from '../types/place';
import PocketSheet, { KIND_META, type PocketDraft } from './PocketSheet';
import ConfirmDialog from './ConfirmDialog';
import PortalMenu from './PortalMenu';
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
const RowSkeleton = () => <ListSkeleton rows={2} label="Loading your Pocket" />;

/** One ⋯ button per row instead of two always-visible icon buttons (Hick's Law: fewer options on screen). */
function RowMenu({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <PortalMenu
      className="shrink-0"
      label={`Actions for ${label}`}
      items={[
        { label: <><span aria-hidden="true">✎</span> Edit</>, onSelect: onEdit },
        { label: <><span aria-hidden="true">🗑</span> Delete</>, onSelect: onDelete, danger: true },
      ]}
    />
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
    const r = await apiFetch(`/api/pocket?tab=${encodeURIComponent(tab)}`);
    if (r.ok) { setItems(r.data.items as PocketItem[]); return; }
    if (r.kind === 'signed-out') return;
    setLoadError(r.kind === 'http' ? r.error : 'Could not load your Pocket. Check your connection.');
    setItems([]);
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
    const r = await apiFetch('/api/pocket', { method: id ? 'PATCH' : 'POST', body: { tab, id, item: draft, website: '' } });
    if (!r.ok) return r.data?.fieldErrors || { _: r.error };
    // Show it at once (Doherty Threshold): the server's copy is already in the response, no second round trip
    if (id) setItems((prev) => (prev || []).map((i) => (i.id === id ? { ...i, ...draft } : i)));
    else if (r.data.item) setItems((prev) => [...(prev || []), r.data.item as PocketItem]);
    else await load();
    setSheet(null);
    toast.success(id ? 'Saved' : 'Added to your Pocket');
  };

  const toggleDone = async (item: PocketItem) => {
    const { id, createdBy, createdAt, ...rest } = item;
    setItems((prev) => (prev || []).map((i) => (i.id === id ? { ...i, done: !i.done } : i))); // optimistic (Doherty)
    const r = await apiFetch('/api/pocket', { method: 'PATCH', body: { tab, id, item: { ...rest, done: !item.done } } });
    if (!r.ok) load();
  };

  // Optimistic: the row leaves the list when you confirm; it comes back with a message if the server says no
  const confirmDelete = async () => {
    if (!del) return;
    const gone = del;
    const before = items;
    setItems((prev) => (prev || []).filter((i) => i.id !== gone.id));
    setDel(null);
    setDelError('');
    const r = await apiFetch('/api/pocket', { method: 'DELETE', body: { tab, id: gone.id } });
    if (r.ok) {
      // Undo puts it back as a new item (same content, new id): easy reversal instead of a "can't be undone" warning
      const { id: _id, createdBy: _by, createdAt: _at, ...rest } = gone;
      toast.success(`Removed “${gone.title}”`, {
        action: {
          label: 'Undo',
          run: async () => {
            const back = await apiFetch('/api/pocket', { body: { tab, item: rest, website: '' } });
            if (back.ok) { await load(); toast.success('Restored'); } else toast.error(back.error);
          },
        },
      });
      return;
    }
    if (r.kind === 'signed-out') return;
    setItems(before);
    setLoadError(`“${gone.title}” could not be removed: ${r.error}`);
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

  const empty = (text: string, icon = '📭') => <EmptyState icon={icon} title={text} className="py-4" />;

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
            <InlineError message={loadError} onRetry={load} />
          )}
          <Section id="pk-bookings" title="Bookings & docs" count={bookings.length} open={open.bookings} onToggle={() => toggle('bookings')}>
            {items === null ? <RowSkeleton /> : bookings.length === 0 ? empty('No flights, stays or docs yet', '✈️') : <ul className="space-y-2">{bookings.map(card)}</ul>}
          </Section>
          <Section id="pk-notes" title="Notes" count={notes.length} open={open.notes} onToggle={() => toggle('notes')}>
            {items === null ? <RowSkeleton /> : notes.length === 0 ? empty('No notes yet: door codes, wifi, reminders', '📝') : <ul className="space-y-2">{notes.map(noteCard)}</ul>}
          </Section>
        </>
      )}

      <Section id="pk-checklist" title="Checklist" open={open.checklist} onToggle={() => toggle('checklist')}>
        {hasItinerary
          ? <TripChecklist tab={tab} groups={groups} firstDate={firstDate} />
          : empty('Add places to your itinerary to get a tailored checklist', '✅')}
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
