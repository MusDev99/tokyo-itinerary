import { h } from 'preact';
import { useState } from 'preact/hooks';
import type { TimelineItem as TimelineItemType } from '../types/itinerary';

interface TimelineItemProps extends TimelineItemType {}

export default function TimelineItem({ time, title, description, location, price, note, images, youtubeUrl }: TimelineItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const formatPrice = (price: TimelineItemType['price']) => {
    if (price.amount === 0) return 'Free';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: price.currency,
    }).format(price.amount);
  };

  return (
    <div className="relative mb-8 group">
      {/* Enhanced Timeline dot and connecting line */}
      <div className="absolute left-4 top-6 w-4 h-4 rounded-full bg-gradient-to-br from-primary to-accent border-4 border-white shadow-lg group-hover:scale-110 transition-transform duration-300" />
      <div className="absolute left-[1.5rem] top-10 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-secondary opacity-60" />

      <div className="ml-14">
        {/* Enhanced Time card */}
        <div className="inline-block px-4 py-2 mb-4 text-sm font-medium text-text bg-gradient-to-r from-secondary to-bg rounded-lg shadow-sm border border-primary/20 hover:shadow-md transition-all duration-300">
          <span className="flex items-center gap-2">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            {time}
          </span>
        </div>

        {/* Enhanced Content card */}
        <div className="glass-effect rounded-xl shadow-lg border border-primary/20 p-6 card-hover group/card">
          {/* Image with loading state */}
          {images && (
            <div className="relative mb-4 overflow-hidden rounded-lg">
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gradient-to-r from-secondary/20 to-bg/20 animate-pulse rounded-lg" />
              )}
              <img 
                src={images} 
                alt={title} 
                className={`w-full max-h-56 object-cover rounded-lg border border-primary/10 shadow-sm transition-all duration-500 ${
                  imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                }`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
            </div>
          )}
          
          {/* Title with expand/collapse */}
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-xl font-semibold text-text group-hover/card:gradient-text transition-all duration-300">
              {title}
            </h3>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 p-1 rounded-full hover:bg-primary/10 transition-colors duration-200 touch-target touch-feedback focus-ring"
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              <svg 
                className={`w-4 h-4 text-primary transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Description */}
          <p className="text-text/80 mb-4 leading-relaxed">{description}</p>

          {/* Expandable details */}
          <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="space-y-3 pt-2">
              {/* Location with enhanced Google Maps link */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-secondary/20 to-bg/20 rounded-lg hover:from-secondary/30 hover:to-bg/30 transition-all duration-200">
                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <a 
                  href={location.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text/70 hover:text-primary text-sm font-medium transition-colors duration-200 flex items-center gap-1"
                >
                  {location.name}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              {/* Enhanced Price */}
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-secondary/20 to-bg/20 rounded-lg">
                <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-text/80">
                  <span className="font-medium text-lg">{formatPrice(price)}</span>
                  {price.notes && <span className="ml-2 text-primary/80 text-xs">({price.notes})</span>}
                </div>
              </div>

              {/* Enhanced Note */}
              {note && (
                <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-secondary/30 to-bg rounded-lg border border-primary/20">
                  <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-text/80 leading-relaxed">{note}</p>
                </div>
              )}

              {youtubeUrl && (
                <div className="mt-4">
                  <iframe
                    width="100%"
                    height="315"
                    src={youtubeUrl}
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="rounded-lg"
                  ></iframe>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 