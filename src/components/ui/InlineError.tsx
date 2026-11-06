import { h } from 'preact';

/** The one error box: announced to screen readers, with an optional Retry (Nielsen: help users recover). */
export default function InlineError({ message, onRetry, className = '' }: { message?: string; onRetry?: () => void; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={`p-3 rounded-xl bg-danger/10 border border-danger/30 text-sm font-semibold text-danger-strong flex items-center justify-between gap-3 ${className}`}>
      <span className="min-w-0">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="touch-target focus-ring shrink-0 px-3 rounded-lg font-bold underline">Retry</button>
      )}
    </div>
  );
}
