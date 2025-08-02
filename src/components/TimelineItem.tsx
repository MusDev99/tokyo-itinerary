import { h } from 'preact';
import type { TimelineItem as TimelineItemType } from '../types/itinerary';

interface TimelineItemProps extends TimelineItemType {}

export default function TimelineItem({ time, title, description, location, price, note, images }: TimelineItemProps) {
  const formatPrice = (price: TimelineItemType['price']) => {
    if (price.amount === 0) return 'Free';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: price.currency,
    }).format(price.amount);
  };

  return (
    <div className="relative mb-8">
      {/* Timeline dot and connecting line */}
      <div className="absolute left-4 top-6 w-3 h-3 rounded-full bg-primary border-4 border-white shadow-sm" />
      <div className="absolute left-[1.375rem] top-9 bottom-0 w-0.5 bg-gradient-to-b from-primary to-secondary" />

      <div className="ml-12">
        {/* Time card */}
        <div className="inline-block px-4 py-2 mb-4 text-sm font-medium text-text bg-gradient-to-r from-secondary to-bg rounded-lg shadow-sm border border-primary/20">
          {time}
        </div>

        {/* Content card */}
        <div className="bg-gradient-to-br from-bg to-secondary/30 rounded-xl shadow-md border border-primary/20 p-6 hover:shadow-lg transition-shadow duration-200">
          {/* Image if exists */}
          {images && (
            <img src={images} alt={title} className="w-full max-h-56 object-cover rounded-lg mb-4 border border-primary/10 shadow-sm" loading="lazy" />
          )}
          {/* Title */}
          <h3 className="text-xl font-semibold text-text mb-2">{title}</h3>

          {/* Description */}
          <p className="text-text/80 mb-4">{description}</p>

          {/* Location with Google Maps link */}
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <a 
              href={location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text/70 hover:text-text text-sm font-medium"
            >
              {location.name}
            </a>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-text/80">
              <span className="font-medium">{formatPrice(price)}</span>
              {price.notes && <span className="ml-1 text-primary/80">({price.notes})</span>}
            </div>
          </div>

          {/* Note */}
          {note && (
            <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-secondary/30 to-bg rounded-lg border border-primary/20">
              <svg className="w-4 h-4 text-primary mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-text/80">{note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 