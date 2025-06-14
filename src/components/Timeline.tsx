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
    <div className="space-y-2">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-text mb-1">Day {day.day}: {day.title}</h2>
        <p className="text-text/80 text-sm">{day.date}</p>
      </div>
      <div className="space-y-4">
        {day.items.map((item, index) => (
          <TimelineItem key={index} {...item} />
        ))}
      </div>
    </div>
  );
} 