import { h } from 'preact';
import { refreshPage } from '../utils/refresh';
import { useMemo, useState } from 'preact/hooks';
import { redirectIfSignedOut } from '../utils/authClient';
import { buildDays, nextFreeDay, suggestNextTime, isIsoDate } from '../utils/tripDraft';
import ActivitySheet from './ActivitySheet';
import { emptyActivity, draftToPayload, type ActivityDraft } from './ActivityFields';

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

/** The "Add place" button of a trip page; the form itself is the shared ActivitySheet. */
export default function TripBuilder({ country, state, currency, dates, planned, empty = false }: Props) {
  const [open, setOpen] = useState(false);

  const plannedByDate = useMemo(() => new Map(planned.map((p) => [p.date, p])), [planned]);
  // Chips: the trip range plus any planned day outside it
  const days = useMemo(() => {
    const set = new Set<string>(dates ? buildDays(dates.start, dates.end) : []);
    planned.forEach((p) => isIsoDate(p.date) && set.add(p.date));
    return [...set].sort();
  }, [dates, planned]);

  // Continue from the previous item's end; a day with nothing yet leaves the time unset (--:--)
  const suggestTime = (iso: string) => {
    const last = plannedByDate.get(iso)?.lastTime;
    return last ? suggestNextTime(last) : '';
  };

  const first = nextFreeDay(days, planned.map((p) => p.date)) || new Date().toISOString().slice(0, 10);
  const initial: ActivityDraft = { ...emptyActivity(currency), date: first, time: suggestTime(first) };

  const save = async (draft: ActivityDraft): Promise<Record<string, string> | void> => {
    try {
      const res = await fetch('/api/itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, state, activities: [draftToPayload(draft)], website: '' }),
      });
      if (redirectIfSignedOut(res)) return { _: 'Please sign in again.' };
      const data = await res.json();
      if (!res.ok) return { ...(data.rowErrors?.[0] || {}), _: data.error || 'Something went wrong' };
    } catch {
      return { _: 'Network error. Please try again.' };
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
        // Phones: a floating button in thumb reach above the tab dock (Fitts's Law, Jakob's Law); from lg it sits inline
        className={`touch-target inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-primary text-white text-sm font-extrabold shadow-sm hover:opacity-95 ${
          empty
            ? 'w-full h-12 text-base'
            : 'max-lg:fixed max-lg:right-4 max-lg:bottom-[calc(5.75rem+env(safe-area-inset-bottom))] max-lg:z-30 max-lg:h-12 max-lg:rounded-full max-lg:shadow-xl lg:w-auto'
        }`}>
        <span aria-hidden="true" className="text-lg leading-none">＋</span> Add place
      </button>

      {open && (
        <ActivitySheet
          mode="add"
          initial={initial}
          days={days}
          plannedDays={planned.map((p) => p.date)}
          canExtend
          suggestTime={suggestTime}
          onSave={save}
          // The timeline is server-rendered: refresh once, after the last save, not on every one
          onClose={(saved) => { setOpen(false); if (saved > 0) refreshPage(); }}
        />
      )}
    </>
  );
}
