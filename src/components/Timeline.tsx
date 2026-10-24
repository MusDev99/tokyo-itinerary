import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import TimelineItem from './TimelineItem';
import type { DayItinerary } from '../types/itinerary';
import { prefersReducedMotion } from '../utils/motion';

interface Props {
  day: DayItinerary;
  canEdit?: boolean;
}

export default function Timeline({ day, canEdit = false }: Props) {
  const totalDayCost = day.items.reduce((sum, item) => sum + (item.price?.amount || 0), 0);
  const currency = day.items.find((item) => item.price?.currency)?.price.currency || '';

  // All activities start collapsed (time + title only); the day header can expand or collapse them all
  const [open, setOpen] = useState<boolean[]>(() => day.items.map(() => false));
  useEffect(() => setOpen(day.items.map(() => false)), [day.day, day.items.length]);
  const allOpen = open.length > 0 && open.every(Boolean);
  const setAll = (value: boolean) => setOpen(day.items.map(() => value));

  // The chevron flips to show the next action (Motion; instant for reduced motion)
  const chevron = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!chevron.current) return;
    const reduce = prefersReducedMotion();
    animate(chevron.current, { rotate: allOpen ? 180 : 0 }, { duration: first.current || reduce ? 0 : 0.25 });
    first.current = false;
  }, [allOpen]);

  return (
    <div className="space-y-6">
      {/* Day Summary Banner (Law of Common Region & Miller's Law: Chunked daily context) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-primary/15">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-primary text-white">
              Day {day.day}
            </span>
            {day.state && (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold bg-primary/15 text-primary border border-primary/30">
                📍 {day.state}
              </span>
            )}
            <span className="text-xs sm:text-sm font-semibold text-text/70">
              📅 {day.date}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
            {day.title}
          </h2>
        </div>

        <div className="flex flex-nowrap items-center gap-2 self-start lg:self-center whitespace-nowrap">
          <div className="inline-flex items-center h-9 px-3 rounded-xl bg-white/45 border border-primary/15 text-xs font-bold text-text/80">
            <span>📍 {day.items.length} Stops</span>
          </div>
          <div className="inline-flex items-center h-9 px-3 rounded-xl bg-primary/10 border border-primary/25 text-xs font-extrabold text-primary">
            <span>
              💰 {totalDayCost > 0 ? `${totalDayCost.toLocaleString()} ${currency}` : 'Free Day'}
            </span>
          </div>
          {/* Expand / collapse all, grouped with the day's other controls (Law of Proximity) */}
          {day.items.length > 1 && (
            <button
              type="button"
              onClick={() => setAll(!allOpen)}
              aria-pressed={allOpen}
              aria-label={allOpen ? 'Collapse all activities' : 'Expand all activities'}
              className="relative inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/45 border border-primary/25 text-primary text-xs font-bold hover:bg-primary/10 active:bg-primary/15 transition-colors after:absolute after:-inset-1.5 after:content-['']"
            >
              <span ref={chevron} className="inline-flex" aria-hidden="true">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.75} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
              {allOpen ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="relative space-y-5">
        {day.items.map((item, index) => (
          <TimelineItem
            key={`${day.day}-${index}`}
            {...item}
            editable={canEdit}
            open={open[index] ?? false}
            onToggle={() => setOpen((prev) => prev.map((v, i) => (i === index ? !v : v)))}
            isLast={index === day.items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}