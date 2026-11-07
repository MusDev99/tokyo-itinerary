import { h } from 'preact';
import { goTo } from '../utils/refresh';
import { apiFetch } from '../utils/apiFetch';
import { toast } from '../utils/toast';
import { useState } from 'preact/hooks';
import ConfirmDialog from './ConfirmDialog';
import TripEditSheet from './TripEditSheet';
import type { Stop } from '../utils/trips';

interface Props {
  tab: string; // exact worksheet tab (never renamed: the title is a separate field)
  /** The trip's current title */
  title: string;
  activityCount: number;
  /** Where to go after the trip is deleted */
  afterDeleteHref: string;
  /** For the edit sheet: saved dates and the cities of this trip */
  dates?: { start: string; end: string } | null;
  stops?: Stop[];
  rev?: string;
}

/** Trip-level actions: edit the trip (title, dates, cities; the slug and tab stay, so shared links keep working) and delete it. */
export default function TripActions({ tab, title, activityCount, afterDeleteHref, dates = null, stops = [], rev }: Props) {
  const [mode, setMode] = useState<'idle' | 'edit' | 'delete'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const call = async (method: 'PATCH' | 'DELETE', body: unknown, url = '/api/itinerary') => {
    setBusy(true);
    setError('');
    const r = await apiFetch(url, { method, body });
    setBusy(false);
    if (!r.ok) { if (r.kind !== 'signed-out') setError(r.error); return null; }
    return r.data;
  };

  const remove = async () => {
    const data = await call('DELETE', { tab, wholeTrip: true });
    if (data) { toast.success('Trip deleted'); goTo(afterDeleteHref); }
  };

  const close = () => { setMode('idle'); setError(''); };

  // Icon-only, minimalist controls. Familiar icons (Jakob's Law), 44px targets (Fitts's Law),
  // one filled primary and two quiet secondaries (Von Restorff), only three choices (Hick's Law).
  const btn = 'touch-target relative inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors focus-ring';
  const icon = 'w-5 h-5';

  return (
    // Common Region: one quiet container so the two icons read as a single "manage" control
    <div className="inline-flex items-center gap-0.5 shrink-0 self-start p-0.5 rounded-xl bg-white/45 border border-primary/15" role="group" aria-label="Manage trip">
      <button type="button" aria-label="Edit trip" title="Edit trip"
        onClick={() => setMode('edit')}
        className={`${btn} text-primary hover:bg-primary/15`}>
        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5" />
        </svg>
      </button>

      <button type="button" aria-label="Delete trip" title="Delete trip"
        onClick={() => setMode('delete')}
        className={`${btn} text-danger-strong/80 hover:bg-danger-solid hover:text-white`}>
        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      </button>

      {mode === 'edit' && <TripEditSheet tab={tab} title={title} dates={dates} stops={stops} rev={rev} onClose={close} />}

      <ConfirmDialog
        open={mode === 'delete'}
        title={`Delete “${title}”?`}
        confirmLabel="Delete trip"
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={close}
        message={<>The whole trip and its {activityCount} {activityCount === 1 ? 'activity' : 'activities'} will be permanently deleted. This can't be undone.</>}
      />
    </div>
  );
}
