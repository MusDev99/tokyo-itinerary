import { h } from 'preact';

interface Location {
  name: string;
  mapsUrl: string;
}

interface Price {
  amount: number;
  currency: string;
  notes: string;
}

interface TimelineItemProps {
  time: string;
  title: string;
  description: string;
  location: Location;
  price: Price;
  note: string;
}

export default function TimelineItem({ time, title, description, location, price, note }: TimelineItemProps) {
  const formatPrice = (price: Price) => {
    if (price.amount === 0) return 'Free';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: price.currency,
    }).format(price.amount);
  };

  return (
    <div className="relative mb-8">
      {/* Timeline dot and connecting line */}
      <div className="absolute left-4 top-6 w-3 h-3 rounded-full bg-amber-600 border-4 border-white shadow-sm" />
      <div className="absolute left-[1.375rem] top-9 bottom-0 w-0.5 bg-gradient-to-b from-amber-600 to-amber-200" />

      <div className="ml-12">
        {/* Time card */}
        <div className="inline-block px-4 py-2 mb-4 text-sm font-medium text-amber-900 bg-gradient-to-r from-amber-100 to-amber-50 rounded-lg shadow-sm border border-amber-200">
          {time}
        </div>

        {/* Content card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl shadow-md border border-amber-100 p-6 hover:shadow-lg transition-shadow duration-200">
          {/* Title */}
          <h3 className="text-xl font-semibold text-amber-900 mb-2">{title}</h3>

          {/* Description */}
          <p className="text-amber-800 mb-4">{description}</p>

          {/* Location with Google Maps link */}
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <a 
              href={location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-700 hover:text-amber-800 text-sm font-medium"
            >
              {location.name}
            </a>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-amber-800">
              <span className="font-medium">{formatPrice(price)}</span>
              {price.notes && <span className="ml-1 text-amber-600">({price.notes})</span>}
            </div>
          </div>

          {/* Note */}
          {note && (
            <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-amber-100/50 to-orange-100/50 rounded-lg border border-amber-200/50">
              <svg className="w-4 h-4 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-amber-800">{note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 