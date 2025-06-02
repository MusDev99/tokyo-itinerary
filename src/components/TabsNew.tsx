import { h } from 'preact';
import { useState } from 'preact/hooks';
import Timeline from './Timeline';

interface Location {
  name: string;
  mapsUrl: string;
}

interface Price {
  amount: number;
  currency: string;
  notes: string;
}

interface TimelineItem {
  time: string;
  title: string;
  description: string;
  location: Location;
  price: Price;
  note: string;
}

interface DayItinerary {
  day: number;
  title: string;
  date: string;
  items: TimelineItem[];
}

interface Props {
  itinerary: DayItinerary[];
}

export default function Tabs({ itinerary }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="w-full px-2 sm:px-4 py-3 sm:py-6">
      {/* Tab buttons */}
      <div className="flex space-x-1.5 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2 snap-x snap-mandatory">
        {itinerary.map((day, index) => (
          <button
            key={day.day}
            onClick={() => setActiveTab(index)}
            className={`px-3 sm:px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap snap-start min-w-[80px] sm:min-w-[100px] touch-manipulation
              ${activeTab === index
                ? 'bg-primary text-white shadow-sm'
                : 'bg-bg/50 text-text/80 hover:bg-primary/10 hover:text-text active:bg-primary/20'
              }`}
          >
            Day {day.day}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-3 sm:mt-6 bg-bg/50 rounded-lg sm:rounded-xl shadow-sm p-3 sm:p-6">
        <Timeline day={itinerary[activeTab]} />
      </div>
    </div>
  );
} 