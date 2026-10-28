import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { useDismiss } from './useDismiss';
import { prefersReducedMotion } from '../utils/motion';

interface Props {
  /** Feed path on this site, e.g. "/japan/tokyo/calendar.ics" */
  feedPath: string;
}

/**
 * "Add to calendar": subscribe (updates itself when the trip changes) or download a one-off .ics.
 * Three labelled choices behind one button (Hick's Law); the PDF stays the one primary action (Von Restorff).
 */
export default function CalendarExport({ feedPath }: Props) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => setOrigin(window.location.origin), []);
  useDismiss(open, [root], (reason) => {
    setOpen(false);
    if (reason === 'escape') trigger.current?.focus();
  });
  useEffect(() => {
    if (!open || !menu.current) return;
    // Opens below the button like any dropdown (Jakob's Law); bring it on screen when the button sits near the bottom
    menu.current.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    menu.current.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
    if (prefersReducedMotion()) return;
    animate(menu.current, { opacity: [0, 1], y: [-6, 0], scale: [0.97, 1] }, { type: 'spring', stiffness: 420, damping: 30 });
  }, [open]);

  const https = origin + feedPath;
  const webcal = https.replace(/^https?:/, 'webcal:');
  const options = [
    { href: webcal, label: 'Apple / Outlook', hint: 'Subscribe: updates when the trip changes', icon: '🍎' },
    { href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`, label: 'Google Calendar', hint: 'Subscribe: updates when the trip changes', icon: '📆', external: true },
    { href: `${feedPath}?download`, label: 'Download .ics', hint: 'One-time copy for any calendar app', icon: '⬇️', download: true },
  ];

  // Arrow keys move between the three choices (menu pattern)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const links = Array.from(menu.current?.querySelectorAll<HTMLElement>('a') ?? []);
    const i = links.indexOf(document.activeElement as HTMLElement);
    links[(i + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus();
  };

  return (
    <div ref={root} className="relative w-full sm:w-auto">
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="touch-target w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 sm:px-8 py-[13px] rounded-full text-sm sm:text-base font-semibold text-primary bg-white/55 border border-primary/30 hover:bg-primary/10 transition-colors focus-ring"
      >
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" strokeLinecap="round" />
        </svg>
        Add to calendar
      </button>

      {open && (
        <div
          ref={menu}
          role="menu"
          aria-label="Add trip to calendar"
          onKeyDown={onKey}
          className="absolute z-30 left-0 right-0 sm:left-auto sm:right-auto sm:w-72 top-full mt-2 p-1.5 rounded-2xl bg-surface-solid border border-primary/25 shadow-2xl origin-top"
        >
          {options.map((o) => (
            <a
              key={o.label}
              role="menuitem"
              href={o.href}
              {...(o.download ? { download: '' } : {})}
              {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              onClick={() => setOpen(false)}
              className="touch-target flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 focus:bg-primary/10 focus:outline-none"
            >
              <span className="text-xl leading-none mt-0.5" aria-hidden="true">{o.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-text">{o.label}</span>
                <span className="block text-xs text-text/60">{o.hint}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
