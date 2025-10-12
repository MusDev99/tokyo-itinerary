import { h } from 'preact';

interface SkeletonProps {
  className?: string;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export function Skeleton({ className = '', height = 'h-4', width = 'w-full', rounded = true }: SkeletonProps) {
  return (
    <div 
      className={`bg-gradient-to-r from-secondary/20 to-bg/20 animate-pulse ${height} ${width} ${rounded ? 'rounded' : ''} ${className}`}
    />
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-6">
      {/* Day header skeleton */}
      <div className="space-y-2">
        <Skeleton height="h-8" width="w-64" />
        <Skeleton height="h-4" width="w-32" />
      </div>
      
      {/* Timeline items skeleton */}
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="relative mb-8">
          {/* Timeline dot */}
          <div className="absolute left-4 top-6 w-4 h-4 rounded-full bg-gradient-to-r from-secondary/20 to-bg/20 animate-pulse" />
          
          <div className="ml-14">
            {/* Time card skeleton */}
            <div className="inline-block mb-4">
              <Skeleton height="h-8" width="w-20" />
            </div>
            
            {/* Content card skeleton */}
            <div className="bg-gradient-to-br from-bg/30 to-secondary/10 rounded-xl p-6 space-y-4">
              {/* Image skeleton */}
              <Skeleton height="h-48" width="w-full" />
              
              {/* Title skeleton */}
              <Skeleton height="h-6" width="w-3/4" />
              
              {/* Description skeleton */}
              <div className="space-y-2">
                <Skeleton height="h-4" width="w-full" />
                <Skeleton height="h-4" width="w-5/6" />
              </div>
              
              {/* Location and price skeleton */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton height="h-4" width="w-4" />
                  <Skeleton height="h-4" width="w-48" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton height="h-4" width="w-4" />
                  <Skeleton height="h-4" width="w-24" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TabSkeleton() {
  return (
    <div className="w-full px-2 sm:px-4 py-3 sm:py-6">
      {/* Tab buttons skeleton */}
      <div className="flex space-x-1.5 pb-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} height="h-10" width="w-20" />
        ))}
      </div>
      
      {/* Progress bar skeleton */}
      <div className="mt-2 h-1 bg-bg/30 rounded-full overflow-hidden">
        <Skeleton height="h-full" width="w-1/7" />
      </div>
      
      {/* Content skeleton */}
      <div className="mt-3 sm:mt-6 bg-bg/50 rounded-lg sm:rounded-xl p-3 sm:p-6">
        <TimelineSkeleton />
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <header className="sticky top-0 z-50 bg-bg/80 backdrop-blur-sm border-b border-primary/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 sm:py-0 sm:h-16 gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <Skeleton height="h-6" width="w-6" />
            <Skeleton height="h-6" width="w-32" />
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <Skeleton height="h-4" width="w-24" />
            <div className="flex gap-1">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} height="h-8" width="w-8" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

