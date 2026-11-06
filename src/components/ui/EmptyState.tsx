import { h, type ComponentChildren } from 'preact';

/** Nothing here yet: an icon, one line of what it is, and the single next action (Hick's Law). */
export default function EmptyState({ icon, title, hint, children, className = '' }: { icon: string; title: string; hint?: string; children?: ComponentChildren; className?: string }) {
  return (
    <div role="status" className={`flex flex-col items-center text-center gap-2 py-8 px-4 ${className}`}>
      <span aria-hidden="true" className="text-4xl">{icon}</span>
      <p className="text-base font-extrabold text-text">{title}</p>
      {hint && <p className="text-sm text-text/70 max-w-xs">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
