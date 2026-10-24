import { h } from 'preact';
import { redirectIfSignedOut } from '../utils/authClient';
import { useState } from 'preact/hooks';
import LocationPicker from './LocationPicker';
import PrayerTimesCard from './PrayerTimesCard';
import { placeLabel, type Place } from '../types/place';

interface Props {
  tab: string;
  searchName: string;
  /** Saved (confirmed) place, if any */
  savedPlace: Place | null;
  /** Auto-geocoded top match used until the user confirms */
  suggestion: Place | null;
  dates: string[];
  /** Only signed-in editors can confirm or change the saved location */
  canEdit?: boolean;
}

/** Travel tools for one trip. Each tool is a collapsible card (Hick's Law: one thing at a time). */
export default function TravelTools({ tab, searchName, savedPlace, suggestion, dates, canEdit = false }: Props) {
  const [place, setPlace] = useState<Place | null>(savedPlace || suggestion);
  const [confirmed, setConfirmed] = useState(Boolean(savedPlace));
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (p: Place) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, place: p }),
      });
      if (redirectIfSignedOut(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the location');
      setPlace(p);
      setConfirmed(true);
      setChanging(false);
    } catch (e: any) {
      setError(e?.message || 'Could not save the location');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Location card */}
      <section className="glass-effect rounded-2xl p-4 sm:p-6 space-y-3" aria-label="Trip location">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-text">📍 Location</h2>
            {place ? (
              <p className="text-sm text-text/80 mt-0.5 break-words">
                Using <strong>{placeLabel(place)}</strong>
                {!confirmed && <span className="ml-2 inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 whitespace-nowrap">Not confirmed</span>}
              </p>
            ) : (
              <p className="text-sm text-text/70 mt-0.5">We couldn't find “{searchName}”. Search for the right place below.</p>
            )}
          </div>
          {canEdit && place && !changing && (
            <div className="grid grid-cols-2 sm:flex gap-2 shrink-0">
              {!confirmed && (
                <button type="button" disabled={busy} onClick={() => save(place)}
                  className="touch-target px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60">
                  {busy ? 'Saving…' : 'Confirm'}
                </button>
              )}
              <button type="button" onClick={() => setChanging(true)}
                className="touch-target px-3.5 py-2 rounded-xl bg-white/45 border border-primary/25 text-primary text-xs font-bold">
                Wrong place?
              </button>
            </div>
          )}
        </div>

        {canEdit && (changing || !place) && (
          <div className="space-y-2">
            <LocationPicker idPrefix="tools-loc" initialQuery={searchName} value={place} onSelect={(p) => save(p)} />
            {changing && (
              <button type="button" onClick={() => setChanging(false)} className="text-xs font-bold text-primary hover:underline px-1 py-1">Cancel</button>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
      </section>

      {/* Prayer times card */}
      {place && (
        <section className="glass-effect rounded-2xl p-4 sm:p-6" aria-label="Prayer times">
          <PrayerTimesCard place={place} dates={dates} />
        </section>
      )}
    </div>
  );
}
