import { h } from 'preact';
import { refreshPage } from '../utils/refresh';
import { useMemo, useState } from 'preact/hooks';
import { apiFetch } from '../utils/apiFetch';
import { buildDays, nextFreeDay, suggestNextTime, isIsoDate } from '../utils/tripDraft';
import ActivitySheet from './ActivitySheet';
import { cityForDay, type Stop } from '../utils/trips';
import { emptyActivity, draftToPayload, type ActivityDraft } from './ActivityFields';

interface PlannedDay {
  /** ISO date of the day */
  date: string;
  title: string;
  /** Time of its last activity, used to suggest the next slot */
  lastTime: string;
}

interface Props {
  /** Worksheet tab of the trip the places are added to */
  tab: string;
  currency: string;
  /** Saved trip range from the wizard (legacy trips have none) */
  dates: { start: string; end: string } | null;
  /** Days that already have activities */
  planned: PlannedDay[];
  /** Show a larger call to action (trip has no activities yet) */
  empty?: boolean;
  /** Cities of the trip and where it stays on which dates (multi-city trips) */
  cities?: string[];
  stops?: Stop[];
}

/** The "Add place" button of a trip page; the form itself is the shared ActivitySheet. */
export default function TripBuilder({ tab, currency, dates, planned, empty = false, cities = [], stops = [] }: Props) {
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
  const cityForDate = (iso: string) => cityForDay({ date: iso }, stops) || cities[0] || '';
  const initial: ActivityDraft = { ...emptyActivity(currency), date: first, time: suggestTime(first), city: cities.length > 1 ? cityForDate(first) : '' };

  const save = async (draft: ActivityDraft): Promise<Record<string, string> | void> => {
    const r = await apiFetch('/api/itinerary', { body: { tab, activities: [draftToPayload(draft)], website: '' } });
    if (!r.ok) return { ...(r.data?.rowErrors?.[0] || {}), _: r.error };
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
          cities={cities}
          cityForDate={cityForDate}
          onSave={save}
          // The timeline is server-rendered: refresh once, after the last save, not on every one
          onClose={(saved) => { setOpen(false); if (saved > 0) refreshPage(); }}
        />
      )}
    </>
  );
}
