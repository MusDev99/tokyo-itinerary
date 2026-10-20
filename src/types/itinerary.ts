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
  /** Stable row id (uuid) from the sheet's `id` column; absent on legacy rows. */
  id?: string;
  /** Worksheet tab the row lives in, e.g. "Japan - Tokyo". */
  tab?: string;
  /** 1-based sheet row number (fallback for rows without an id). */
  row?: number;
  date?: string;
  time: string;
  title: string;
  description: string;
  location: Location;
  price: Price;
  note: string;
  category?: string;
  images?: string;
  youtubeUrl?: string;
}

export interface DayItinerary {
  day: number;
  title: string;
  date: string;
  items: TimelineItem[];
} 