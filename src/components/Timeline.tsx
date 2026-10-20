import { h } from 'preact';
import TimelineItem from './TimelineItem';
import type { DayItinerary } from '../types/itinerary';

interface Props {
  day: DayItinerary;
}

export default function Timeline({ day }: Props) {
  const totalDayCost = day.items.reduce((sum, item) => sum + (item.price?.amount || 0), 0);
  const currency = day.items.find((item) => item.price?.currency)?.price.currency || '';

  return (
    <div className="space-y-6">
      {/* Day Summary Banner (Law of Common Region & Miller's Law: Chunked daily context) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-primary/15">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-extrabold uppercase tracking-wider bg-primary text-white">
              Day {day.day}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-text/70">
              📅 {day.date}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-text tracking-tight">
            {day.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start sm:self-center">
          <div className="px-3 py-1.5 rounded-xl bg-white/45 border border-primary/15 text-xs font-bold text-text/80">
            <span>📍 {day.items.length} Stops</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 text-xs font-extrabold text-primary">
            <span>
              💰 {totalDayCost > 0 ? `${totalDayCost.toLocaleString()} ${currency}` : 'Free Day'}
            </span>
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="relative space-y-5">
        {day.items.map((item, index) => (
          <TimelineItem
            key={`${day.day}-${index}`}
            {...item}
            isLast={index === day.items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}