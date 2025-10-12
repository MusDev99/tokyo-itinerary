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
  const [isAnimating, setIsAnimating] = useState(false);
  const [filteredItinerary, setFilteredItinerary] = useState(itinerary);
  const [showSearch, setShowSearch] = useState(false);

  const handleTabChange = (index: number) => {
    if (index === activeTab || isAnimating) return;
    
    setIsAnimating(true);
    setActiveTab(index);
    
    // Reset animation state after transition
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleFilteredItinerary = (filtered: DayItinerary[]) => {
    setFilteredItinerary(filtered);
    // Reset to first tab if current tab doesn't exist in filtered results
    if (activeTab >= filtered.length && filtered.length > 0) {
      setActiveTab(0);
    }
  };

  return (
    <div className="w-full px-2 sm:px-4 py-3 sm:py-6">
      {/* Search and Filter Controls */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-text">Itinerary Explorer</h3>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-secondary/20 to-bg/20 border border-primary/20 rounded-lg hover:from-secondary/30 hover:to-bg/30 transition-all duration-200"
          >
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-medium text-text">Search & Filter</span>
          </button>
        </div>
        
        {showSearch && (
          <SearchFilter 
            itinerary={itinerary} 
            onFilteredItinerary={handleFilteredItinerary}
          />
        )}
      </div>

      {/* Tab buttons with progress indicator */}
      <div className="relative">
        <div className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2 snap-x snap-mandatory">
          {filteredItinerary.map((day, index) => (
            <button
              key={day.day}
              onClick={() => handleTabChange(index)}
              className={`relative px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-300 whitespace-nowrap snap-start min-w-[80px] sm:min-w-[100px] touch-manipulation group touch-target touch-feedback focus-ring
                ${activeTab === index
                  ? 'bg-primary text-white shadow-lg scale-105'
                  : 'bg-bg/50 text-text/80 hover:bg-primary/10 hover:text-text hover:scale-105 active:bg-primary/20'
                }`}
            >
              <span className="relative z-10">Day {day.day}</span>
              
              {/* Hover effect */}
              <div className={`absolute inset-0 rounded-lg transition-opacity duration-300 ${
                activeTab === index 
                  ? 'bg-gradient-to-r from-primary to-accent opacity-100' 
                  : 'bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-hover:opacity-100'
              }`} />
              
              {/* Active indicator */}
              {activeTab === index && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
        
        {/* Progress bar */}
        <div className="mt-2 h-1 bg-bg/30 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${filteredItinerary.length > 0 ? ((activeTab + 1) / filteredItinerary.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Tab content with animation */}
      <div className={`mt-3 sm:mt-6 glass-effect rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-6 transition-all duration-300 ${
        isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
      }`}>
        {filteredItinerary.length > 0 ? (
          <div className="transition-all duration-300 ease-out">
            <Timeline day={filteredItinerary[activeTab]} />
          </div>
        ) : (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-text/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-lg font-medium text-text/70 mb-2">No activities found</h3>
            <p className="text-text/50 text-sm">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
} 