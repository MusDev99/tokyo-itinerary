import { h } from 'preact';

/** A placeholder block (pass size/shape classes). One look everywhere: the `.skeleton` class in global.css. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/**
 * Rows shaped like our real list rows (icon + two lines), so the content replaces them without a layout jump
 * (Doherty Threshold: something is on screen at once; Aesthetic-Usability: same rhythm as the real thing).
 */
export function ListSkeleton({ rows = 3, label = 'Loading', className = '' }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={`space-y-3 py-1 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 min-h-[52px]">
          <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded opacity-70" />
          </div>
        </div>
      ))}
    </div>
  );
}
