import { h } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate, stagger } from 'motion';

export interface NavState {
  name: string;
  href: string;
  days: number;
}
export interface NavCountry {
  slug: string;
  name: string;
  flag: string;
  days: number;
  hubHref: string;
  itineraryHref: string | null;
  states: NavState[];
}

interface Props {
  countries: NavCountry[];
  currentPath: string;
}

const spring = { type: 'spring', stiffness: 340, damping: 30 } as const;
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const isHere = (path: string, href: string) => path === href || path === `${href}/`;

/** Height-animated accordion body (Hick's Law: progressive disclosure of each country's pages). */
function Collapsible({ open, children }: { open: boolean; children: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current || reduced()) {
      first.current = false;
      el.style.height = open ? 'auto' : '0px';
      return;
    }
    if (open) {
      const target = el.scrollHeight;
      animate(el, { height: ['0px', `${target}px`] }, { duration: 0.28, ease: [0.22, 1, 0.36, 1] }).then(() => (el.style.height = 'auto'));
    } else {
      animate(el, { height: [`${el.scrollHeight}px`, '0px'] }, { duration: 0.22, ease: 'easeIn' });
    }
  }, [open]);

  return (
    <div ref={ref} style={{ overflow: 'hidden', height: open ? 'auto' : '0px' }} aria-hidden={!open}>
      {children}
    </div>
  );
}

export default function MobileNav({ countries, currentPath }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(
    countries.find((c) => currentPath === c.hubHref || currentPath.startsWith(`${c.hubHref}/`))?.slug ?? null
  );
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const bars = useRef<Array<HTMLSpanElement | null>>([]);
  const closing = useRef(false);

  const show = () => {
    setMounted(true);
    setOpen(true);
  };

  const hide = async () => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    if (!reduced() && panel.current && backdrop.current) {
      await Promise.all([
        animate(panel.current, { x: [0, '100%'], opacity: [1, 0.6] }, { duration: 0.22, ease: 'easeIn' }).finished,
        animate(backdrop.current, { opacity: [1, 0] }, { duration: 0.2 }).finished,
      ]);
    }
    setMounted(false);
    closing.current = false;
    toggle.current?.focus();
  };

  // Hamburger ↔ close morph
  useEffect(() => {
    const [a, b, c] = bars.current;
    if (!a || !b || !c || reduced()) return;
    animate(a, { y: open ? 7 : 0, rotate: open ? 45 : 0 }, spring);
    animate(b, { opacity: open ? 0 : 1, scaleX: open ? 0.3 : 1 }, { duration: 0.15 });
    animate(c, { y: open ? -7 : 0, rotate: open ? -45 : 0 }, spring);
  }, [open]);

  // Enter animation, scroll lock, Escape
  useEffect(() => {
    if (!mounted || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    document.addEventListener('keydown', key);
    if (!reduced() && panel.current && backdrop.current) {
      animate(backdrop.current, { opacity: [0, 1] }, { duration: 0.25 });
      animate(panel.current, { x: ['100%', 0], opacity: [0.6, 1] }, spring);
      animate(panel.current.querySelectorAll('[data-item]'), { opacity: [0, 1], y: [14, 0] }, { delay: stagger(0.045, { startDelay: 0.12 }), duration: 0.35, ease: [0.22, 1, 0.36, 1] });
    }
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', key);
    };
  }, [mounted, open]);

  const linkBase = 'touch-target flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors';

  return (
    <>
      <div className="flex items-center gap-1 lg:hidden">
        <button
          ref={toggle}
          type="button"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="mobile-nav-panel"
          onClick={() => (open ? hide() : show())}
          className="touch-target relative inline-flex items-center justify-center w-11 h-11 rounded-xl text-text hover:bg-primary/10 focus-ring"
        >
          <span className="relative block w-6 h-[18px]" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                ref={(el) => (bars.current[i] = el)}
                className="absolute left-0 w-6 h-0.5 rounded-full bg-current"
                style={{ top: `${i * 8 + 0}px` }}
              />
            ))}
          </span>
        </button>
      </div>

      {mounted &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-[70]">
            <div ref={backdrop} className="absolute inset-0 bg-black/40" onPointerDown={hide} aria-hidden="true" />
            <div
              ref={panel}
              id="mobile-nav-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-surface-solid shadow-2xl flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
              <div className="flex items-center justify-between h-16 px-4 border-b border-primary/15 shrink-0">
                <span className="flex items-center gap-2.5">
                  <img src="/logo.svg" alt="" width={32} height={32} className="w-8 h-8" />
                  <span className="text-base font-extrabold text-text tracking-tight">PlanTravel</span>
                </span>
                <button type="button" onClick={hide} aria-label="Close menu"
                  className="touch-target inline-flex items-center justify-center w-11 h-11 rounded-xl text-text hover:bg-primary/10">
                  ✕
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-2" aria-label="Main navigation">
                <a data-item href="/" aria-current={currentPath === '/' ? 'page' : undefined}
                  className={`${linkBase} text-base ${currentPath === '/' ? 'bg-primary text-white' : 'text-text hover:bg-primary/10'}`}>
                  <span aria-hidden="true">🌍</span> Global Dashboard
                </a>

                <div data-item className="pt-3 pb-1 px-2 text-xs font-bold uppercase tracking-wider text-text/50">
                  Destinations ({countries.length})
                </div>

                {countries.map((c) => {
                  const active = currentPath === c.hubHref || currentPath.startsWith(`${c.hubHref}/`);
                  const isOpen = expanded === c.slug;
                  return (
                    <div key={c.slug} data-item className={`rounded-2xl border ${active ? 'border-primary/40 bg-primary/5' : 'border-primary/15'}`}>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setExpanded(isOpen ? null : c.slug)}
                        className="touch-target w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left"
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xl shrink-0">{c.flag}</span>
                          <span className={`text-base font-bold truncate ${active ? 'text-primary' : 'text-text'}`}>{c.name}</span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${c.days > 0 ? 'bg-primary/15 text-primary' : 'bg-text/10 text-text/60'}`}>
                            {c.days > 0 ? `${c.days} ${c.days === 1 ? 'day' : 'days'}` : 'Planning'}
                          </span>
                          <svg className={`w-4 h-4 text-text/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </button>
                      <Collapsible open={isOpen}>
                        <div className="px-2.5 pb-2.5 grid gap-1">
                          <a href={c.hubHref} tabIndex={isOpen ? 0 : -1}
                            className={`${linkBase} ${isHere(currentPath, c.hubHref) ? 'bg-primary text-white' : 'text-text/85 hover:bg-primary/10'}`}>
                            <span aria-hidden="true">🧭</span> Overview
                          </a>
                          {c.itineraryHref && (
                            <a href={c.itineraryHref} tabIndex={isOpen ? 0 : -1}
                              className={`${linkBase} ${isHere(currentPath, c.itineraryHref) ? 'bg-primary text-white' : 'text-text/85 hover:bg-primary/10'}`}>
                              <span aria-hidden="true">🗓️</span> {c.states.length > 0 ? 'All timelines' : 'Interactive timeline'}
                            </a>
                          )}
                          {c.states.map((s) => (
                            <a key={s.href} href={s.href} tabIndex={isOpen ? 0 : -1}
                              className={`${linkBase} justify-between ${isHere(currentPath, s.href) ? 'bg-primary text-white' : 'text-text/85 hover:bg-primary/10'}`}>
                              <span className="flex items-center gap-2"><span aria-hidden="true">📍</span> {s.name}</span>
                              {s.days > 0 && <span className="text-[11px] opacity-75">{s.days}d</span>}
                            </a>
                          ))}
                        </div>
                      </Collapsible>
                    </div>
                  );
                })}
              </nav>

              <div data-item className="shrink-0 p-4 border-t border-primary/15" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <a href="/add" className="touch-target w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-extrabold shadow-md">
                  <span aria-hidden="true">＋</span> Add new itinerary
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
