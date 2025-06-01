import { h } from 'preact';
import TimelineItem from './TimelineItem';

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
  day: DayItinerary;
}

export default function Timeline({ day }: Props) {
  return (
    <div className="mb-8">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold text-gray-900 mb-2">{day.title}</h2>
        <p className="text-lg text-gray-600">{day.date}</p>
      </div>
      
      <div className="relative">
        {day.items.map((item, index) => (
          <TimelineItem key={index} {...item} />
        ))}
      </div>
    </div>
  );
} 