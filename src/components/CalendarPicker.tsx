import { h } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { PickerPopover, PickerTrigger, pickerButton, usePickerPopover } from './PickerPopover';
import { prefersReducedMotion } from '../utils/motion';
import {
  addMonths, clampIso, dateForKey, formatLongDate, formatMonthYear, isOutOfRange,
  monthGrid, parseIso, todayIso, toIsoDate, weekdayLabels,
} from '../utils/calendar';

interface Props {
  id: string;
  value: string; // "YYYY-MM-DD" (legacy sheet dates are read too) or ""
  onChange: (value: string) => void;
  invalid?: boolean;
  min?: string;
  max?: string;
  /** 0 = Sunday (default, matches the native picker most users know: Jakob's Law) */
  weekStartsOn?: number;
}

const CELL = 44; // Fitts's Law: every day is a 44px touch target

const navBtn = 'touch-target w-11 h-11 grid place-items-center rounded-xl text-primary bg-primary/10 disabled:opacity-30';

function Chevron({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function CalendarPicker({ id, value, onChange, invalid, min = '', max = '', weekStartsOn = 0 }: Props) {
  const [focusIso, setFocusIso] = useState('');
  const grid = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);
  const slideDir = useRef(0);

  const selected = toIsoDate(value);
  const today = todayIso();
  const view = parseIso(focusIso) || parseIso(today)!;
  const labelId = `${id}-month`;

  const picker = usePickerPopover({
    width: CELL * 7 + 24,
    height: 420,
    onOpen: () => {
      setFocusIso(clampIso(selected || today, min, max));
      moveFocus.current = true;
      slideDir.current = 0;
    },
  });

  const select = (iso: string) => {
    if (isOutOfRange(iso, min, max)) return;
    onChange(iso);
    picker.close();
  };

  /** Moves the highlighted day; `focus` is true for keyboard moves so focus follows the day. */
  const goTo = (iso: string, focus: boolean) => {
    const next = clampIso(iso, min, max);
    slideDir.current = Math.sign(next.slice(0, 7).localeCompare(focusIso.slice(0, 7)));
    moveFocus.current = focus;
    setFocusIso(next);
  };

  // Month change: short slide in the travel direction so the change is noticed (Doherty: well under 400ms)
  const monthKey = focusIso.slice(0, 7);
  useEffect(() => {
    if (!picker.open || !grid.current || !slideDir.current || prefersReducedMotion()) return;
    animate(grid.current, { opacity: [0.4, 1], x: [slideDir.current * 16, 0] }, { duration: 0.18, ease: 'easeOut' });
  }, [monthKey]);

  // Roving focus: the highlighted day is the only tabbable day (layout effect so a fast next key lands on it)
  useLayoutEffect(() => {
    if (!picker.open || !moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusIso}"]`)?.focus();
  }, [picker.open, focusIso]);

  const onGridKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(focusIso);
      return;
    }
    const next = dateForKey(e.key, focusIso, e.shiftKey, weekStartsOn);
    if (!next) return;
    e.preventDefault();
    goTo(next, true);
  };

  const cells = monthGrid(view.year, view.month, weekStartsOn);
  const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const prevMonth = addMonths(focusIso, -1);
  const nextMonth = addMonths(focusIso, 1);
  const prevDisabled = !!min && prevMonth.slice(0, 7) < min.slice(0, 7);
  const nextDisabled = !!max && nextMonth.slice(0, 7) > max.slice(0, 7);

  return (
    <>
      <PickerTrigger picker={picker} id={id} invalid={invalid} display={formatLongDate(selected)} placeholder="Select date"
        icon={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" /></>} />

      <PickerPopover picker={picker} aria-labelledby={labelId} className="p-3">
        {/* Month header: one month at a time keeps the choice small (Hick's Law) */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <button type="button" className={navBtn} aria-label="Previous month" disabled={prevDisabled} onClick={() => goTo(prevMonth, false)}>
            <Chevron d="M15 6l-6 6 6 6" />
          </button>
          <span id={labelId} aria-live="polite" className="text-sm font-extrabold text-text">
            {formatMonthYear(view.year, view.month)}
          </span>
          <button type="button" className={navBtn} aria-label="Next month" disabled={nextDisabled} onClick={() => goTo(nextMonth, false)}>
            <Chevron d="M9 6l6 6-6 6" />
          </button>
        </div>

        <div ref={grid} role="grid" aria-labelledby={labelId} onKeyDown={onGridKey} className="overflow-hidden">
          <div role="row" className="grid grid-cols-7">
            {weekdayLabels(weekStartsOn).map((d) => (
              <span key={d} role="columnheader" className="h-8 grid place-items-center text-[11px] font-bold text-text/60">{d}</span>
            ))}
          </div>
          {/* Keyed by position, not date: reusing the same nodes across months keeps keyboard focus from dropping to <body> */}
          {weeks.map((week, w) => (
            <div key={w} role="row" className="grid grid-cols-7">
              {week.map((c, d) => {
                const isSel = c.iso === selected;
                const isToday = c.iso === today;
                const disabled = isOutOfRange(c.iso, min, max);
                const tone = isSel
                  ? 'bg-primary text-white'
                  : `hover:bg-primary/10 ${isToday ? 'ring-1 ring-inset ring-primary text-primary' : c.inMonth ? 'text-text' : 'text-text/35'}`;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    data-iso={c.iso}
                    tabIndex={c.iso === focusIso ? 0 : -1}
                    aria-selected={isSel}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={formatLongDate(c.iso)}
                    disabled={disabled}
                    onClick={() => select(c.iso)}
                    className={`h-11 rounded-xl text-sm font-bold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tone} ${disabled ? 'opacity-30 cursor-not-allowed hover:bg-transparent' : ''}`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-between gap-2 mt-2">
          <button type="button" className={pickerButton.secondary} disabled={isOutOfRange(today, min, max)} onClick={() => select(today)}>Today</button>
          <button type="button" className={pickerButton.secondary} onClick={() => picker.close()}>Cancel</button>
        </div>
      </PickerPopover>
    </>
  );
}
