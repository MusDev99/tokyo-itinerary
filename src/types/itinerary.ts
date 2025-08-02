export interface Location {
  name: string;
  mapsUrl: string;
}

export interface Price {
  amount: number;
  currency: string;
  notes?: string;
}

export interface TimelineItem {
  time: string;
  title: string;
  description: string;
  location: Location;
  price: Price;
  note: string;
  images?: string;
}

export interface DayItinerary {
  day: number;
  title: string;
  date: string;
  items: TimelineItem[];
} 