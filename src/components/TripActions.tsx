import { h } from 'preact';
import { useState } from 'preact/hooks';
import ConfirmDialog from './ConfirmDialog';
import { inputClass } from './inputClass';

interface Props {
  tab: string; // exact worksheet tab, e.g. "Japan - Tokyo"
  country: string;
  state: string;
  activityCount: number;
  /** Where to go after the trip is deleted */
  afterDeleteHref: string;
  /** "Add activities" target */
  addHref: string;
}

/** Trip-level actions: add activities, rename (country/state) and delete the whole trip. */
export default function TripActions({ tab, country, state, activityCount, afterDeleteHref, addHref }: Props) {
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle');
  const [newCountry, setNewCountry] = useState(country);
  const [newState, setNewState] = useState(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const call = async (method: 'PATCH' | 'DELETE', body: unknown) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/itinerary', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong');
        return null;
      }
      return data;
    } catch {
      setError('Network error — please try again.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    const data = await call('PATCH', { tab, rename: { country: newCountry, state: newState } });
    if (data?.href) window.location.href = data.href;
  };

  const remove = async () => {
    const data = await call('DELETE', { tab, wholeTrip: true });
    if (data) window.location.href = afterDeleteHref;
  };

  const close = () => { setMode('idle'); setError(''); };

  const btn = 'touch-target inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={addHref} className={`${btn} bg-primary text-white shadow-sm hover:opacity-95`}>＋ Add activities</a>
      <button type="button" onClick={() => { setNewCountry(country); setNewState(state); setMode('rename'); }}
        className={`${btn} bg-primary/10 text-primary hover:bg-primary/20`}>
        ✏️ Rename trip
      </button>
      <button type="button" onClick={() => setMode('delete')}
        className={`${btn} bg-red-500/10 text-red-700 hover:bg-red-600 hover:text-white`}>
        🗑️ Delete trip
      </button>

      <ConfirmDialog
        open={mode === 'rename'}
        danger={false}
        title="Rename trip"
        confirmLabel="Save name"
        busy={busy}
        error={error}
        onConfirm={rename}
        onCancel={close}
        message={
          <div className="space-y-2 mt-2">
            <p>This renames the Google Sheet tab to “{newCountry.trim()} - {newState.trim()}”.</p>
            <input className={inputClass} aria-label="Country" value={newCountry} placeholder="Country"
              onInput={(e) => setNewCountry((e.target as HTMLInputElement).value)} />
            <input className={inputClass} aria-label="State / City" value={newState} placeholder="State / City"
              onInput={(e) => setNewState((e.target as HTMLInputElement).value)} />
          </div>
        }
      />

      <ConfirmDialog
        open={mode === 'delete'}
        title={`Delete “${tab}”?`}
        confirmLabel="Delete trip"
        busy={busy}
        error={error}
        onConfirm={remove}
        onCancel={close}
        message={<>The whole Google Sheet tab and its {activityCount} {activityCount === 1 ? 'activity' : 'activities'} will be permanently deleted. This can't be undone.</>}
      />
    </div>
  );
}
