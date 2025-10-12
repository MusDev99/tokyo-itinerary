import { h } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import type { DayItinerary, TimelineItem as TimelineItemType } from '../types/itinerary';

interface Props {
  itinerary: DayItinerary[];
  onFilteredItinerary: (filteredItinerary: DayItinerary[]) => void;
}

export default function SearchFilter({ itinerary, onFilteredItinerary }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredItinerary = useMemo(() => {
    let filtered = itinerary;

    // Filter by day
    if (selectedDay !== null) {
      filtered = filtered.filter(day => day.day === selectedDay);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.map(day => ({
        ...day,
        items: day.items.filter(item => 
          item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.location.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.note && item.note.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      })).filter(day => day.items.length > 0);
    }

    // Filter by price
    if (priceFilter !== 'all') {
      filtered = filtered.map(day => ({
        ...day,
        items: day.items.filter(item => {
          if (priceFilter === 'free') return item.price.amount === 0;
          if (priceFilter === 'paid') return item.price.amount > 0;
          return true;
        })
      })).filter(day => day.items.length > 0);
    }

    return filtered;
  }, [itinerary, searchTerm, selectedDay, priceFilter]);

  // Update parent component when filtered results change
  useEffect(() => {
    onFilteredItinerary(filteredItinerary);
  }, [filteredItinerary, onFilteredItinerary]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedDay(null);
    setPriceFilter('all');
  };

  const hasActiveFilters = searchTerm || selectedDay !== null || priceFilter !== 'all';

  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="h-4 w-4 text-text/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search activities, locations, or notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-gradient-to-r from-bg/50 to-secondary/30 border border-primary/20 rounded-lg text-text placeholder-text/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-300 touch-target focus-ring"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text/50 hover:text-text transition-colors duration-200"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-secondary/20 to-bg/20 border border-primary/20 rounded-lg hover:from-secondary/30 hover:to-bg/30 transition-all duration-200 touch-target touch-feedback focus-ring"
        >
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
          </svg>
          <span className="text-sm font-medium text-text">Filters</span>
          <svg 
            className={`w-4 h-4 text-primary transition-transform duration-200 ${showFilters ? 'rotate-180' : ''}`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:text-accent transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gradient-to-r from-secondary/10 to-bg/10 rounded-lg border border-primary/20">
          {/* Day Filter */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">Day</label>
            <select
              value={selectedDay || ''}
              onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 bg-bg/50 border border-primary/20 rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
            >
              <option value="">All days</option>
              {itinerary.map(day => (
                <option key={day.day} value={day.day}>Day {day.day}: {day.title}</option>
              ))}
            </select>
          </div>

          {/* Price Filter */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">Price</label>
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value as 'all' | 'free' | 'paid')}
              className="w-full px-3 py-2 bg-bg/50 border border-primary/20 rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
            >
              <option value="all">All prices</option>
              <option value="free">Free activities</option>
              <option value="paid">Paid activities</option>
            </select>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-text/70">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Showing {filteredItinerary.reduce((total, day) => total + day.items.length, 0)} activities 
            across {filteredItinerary.length} day{filteredItinerary.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
