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
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Tab buttons */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {itinerary.map((day, index) => (
          <button
            key={day.day}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap
              ${activeTab === index
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Day {day.day}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
        <Timeline day={itinerary[activeTab]} />
      </div>
    </div>
  );
} 