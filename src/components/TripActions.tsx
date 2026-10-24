import { h } from 'preact';
import { redirectIfSignedOut } from '../utils/authClient';
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
}

/** Trip-level actions: add activities, rename (country/state) and delete the whole trip. */
export default function TripActions({ tab, country, state, activityCount, afterDeleteHref }: Props) {
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
      if (redirectIfSignedOut(res)) return null;
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

  // Icon-only, minimalist controls. Familiar icons (Jakob's Law), 44px targets (Fitts's Law),
  // one filled primary and two quiet secondaries (Von Restorff), only three choices (Hick's Law).
  const btn = 'touch-target relative inline-flex items-center justify-center w-11 h-11 rounded-xl transition-colors focus-ring';
  const icon = 'w-5 h-5';

  return (
    <div className="inline-flex items-center gap-1 shrink-0" role="group" aria-label="Manage trip">
      <button type="button" aria-label="Rename trip" title="Rename trip"
        onClick={() => { setNewCountry(country); setNewState(state); setMode('rename'); }}
        className={`${btn} text-primary hover:bg-primary/15`}>
        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 7.125L16.875 4.5" />
        </svg>
      </button>

      <button type="button" aria-label="Delete trip" title="Delete trip"
        onClick={() => setMode('delete')}
        className={`${btn} text-red-700/80 hover:bg-red-600 hover:text-white`}>
        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
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
