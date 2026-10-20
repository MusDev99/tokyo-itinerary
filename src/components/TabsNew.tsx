import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import Timeline from './Timeline';
import SearchFilter from './SearchFilter';
import type { DayItinerary } from '../types/itinerary';

interface Props {
  itinerary: DayItinerary[];
}

export default function Tabs({ itinerary }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [filteredItinerary, setFilteredItinerary] = useState(itinerary);
  const [showSearch, setShowSearch] = useState(false);

  // Support deep linking via ?day=N query param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const dayParam = Number(params.get('day'));
    if (dayParam > 0) {
      const idx = itinerary.findIndex((d) => d.day === dayParam);
      if (idx >= 0) {
        setActiveTab(idx);
      }
    }
  }, [itinerary]);

  const handleTabChange = (index: number) => {
    if (index === activeTab || index < 0 || index >= filteredItinerary.length) return;
    setActiveTab(index);
  };

  const handleFilteredItinerary = (filtered: DayItinerary[]) => {
    setFilteredItinerary(filtered);
    if (activeTab >= filtered.length && filtered.length > 0) {
      setActiveTab(0);
    }
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const currentDay = filteredItinerary[activeTab];

  return (
    <div className="w-full p-3 sm:p-6">
      {/* Top Toolbar: Day Selector Header + Search Toggle (Hick's Law: Progressive disclosure for filters) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-extrabold text-text">
            Daily Itinerary Schedule
          </h3>
          <p className="text-xs text-text/70">
            Select a day below or search across all {itinerary.length} days
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSearch(!showSearch)}
          aria-expanded={showSearch}
          className={`touch-target inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all duration-150 w-full sm:w-auto ${
            showSearch
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-white/45 text-text/80 border-primary/20 hover:border-primary/40 hover:text-primary'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>{showSearch ? 'Hide Search & Filters' : 'Search & Filter Activities'}</span>
        </button>
      </div>

      {showSearch && (
        <div className="mb-5">
          <SearchFilter
            itinerary={itinerary}
            onFilteredItinerary={handleFilteredItinerary}
          />
        </div>
      )}

      {/* Day Tabs Strip (Fitts's Law & Miller's Law: Large touch targets with Day + Short Date) */}
      <div className="relative mb-5 sm:mb-6">
        <div
          role="tablist"
          aria-label="Trip Days"
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        >
          {filteredItinerary.map((day, index) => {
            const isActive = activeTab === index;
            return (
              <button
                key={day.day}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleTabChange(index)}
                className={`touch-target shrink-0 snap-start px-3.5 py-2 rounded-xl text-left transition-all duration-150 border ${
                  isActive
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-white/45 text-text/80 border-primary/15 hover:bg-primary/10 hover:border-primary/35'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold">Day {day.day}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'
                    }`}
                  >
                    {day.items.length}
                  </span>
                </div>
                <div
                  className={`text-[11px] font-medium mt-0.5 ${
                    isActive ? 'text-white/90' : 'text-text/60'
                  }`}
                >
                  {formatShortDate(day.date)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Trip Progress Bar (Goal-Gradient Effect) */}
        <div className="mt-2 h-1.5 bg-primary/15 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-200 ease-out"
            style={{
              width: `${
                filteredItinerary.length > 0
                  ? ((activeTab + 1) / filteredItinerary.length) * 100
                  : 0
              }%`,
            }}
          />
        </div>
      </div>

      {/* Active Day Timeline Content */}
      <div className="rounded-2xl bg-white/45 border border-primary/15 p-2.5 sm:p-6">
        {currentDay ? (
          <div>
            <Timeline day={currentDay} />

            {/* Bottom Day Stepper (Fitts's Law: Easy sequential progression at the end of reading a day) */}
            {filteredItinerary.length > 1 && (
              <div className="mt-6 sm:mt-8 pt-4 border-t border-primary/15 flex items-center justify-between gap-2 sm:gap-3">
                <button
                  type="button"
                  disabled={activeTab === 0}
                  onClick={() => handleTabChange(activeTab - 1)}
                  className="touch-target inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white/45 border border-primary/20 text-text disabled:opacity-40 disabled:pointer-events-none hover:bg-primary/10 transition-colors"
                >
                  <span>←</span>
                  <span>
                    {activeTab > 0
                      ? `Day ${filteredItinerary[activeTab - 1].day}`
                      : 'Prev'}
                  </span>
                </button>

                <span className="text-[11px] sm:text-xs font-bold text-text/60 text-center">
                  Day {activeTab + 1} / {filteredItinerary.length}
                </span>

                <button
                  type="button"
                  disabled={activeTab === filteredItinerary.length - 1}
                  onClick={() => handleTabChange(activeTab + 1)}
                  className="touch-target inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-primary text-white disabled:opacity-40 disabled:pointer-events-none hover:opacity-95 transition-opacity shadow-sm"
                >
                  <span>
                    {activeTab < filteredItinerary.length - 1
                      ? `Day ${filteredItinerary[activeTab + 1].day}`
                      : 'Done'}
                  </span>
                  <span>→</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-bold text-text/75 mb-1">No matching activities found</p>
            <p className="text-sm text-text/55">Try adjusting your search keywords or price filters</p>
          </div>
        )}
      </div>
    </div>
  );
}