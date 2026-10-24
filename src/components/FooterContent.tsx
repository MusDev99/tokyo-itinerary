import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { animate, hover, press, inView, stagger } from 'motion';
import { prefersReducedMotion } from '../utils/motion';

interface Destination {
  slug: string;
  name: string;
  flag: string;
  href: string;
  days: number;
}

interface Props {
  destinations: Destination[];
  year: number;
  /** Only signed-in editors see the "Add new itinerary" call to action */
  canEdit?: boolean;
}

const TECHS = [
  { name: 'Astro', url: 'https://astro.build' },
  { name: 'TypeScript', url: 'https://www.typescriptlang.org' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
  { name: 'Preact', url: 'https://preactjs.com' },
  { name: 'Motion', url: 'https://motion.dev' },
];

const spring = { type: 'spring', stiffness: 420, damping: 22 } as const;

export default function FooterContent({ destinations, year, canEdit = false }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // Respect reduced motion: leave everything static and visible
    if (prefersReducedMotion()) return;

    const cleanups: Array<() => void> = [];

    // Scroll reveal: sections fade/slide in with a stagger when the footer enters view
    const reveals = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'));
    reveals.forEach((r) => {
      r.style.opacity = '0';
      r.style.transform = 'translateY(24px)';
    });
    const stopInView = inView(el, () => {
      animate(reveals, { opacity: 1, y: 0 }, { duration: 0.6, delay: stagger(0.08), ease: [0.22, 1, 0.36, 1] });
    }, { amount: 0.15 });
    cleanups.push(() => stopInView());

    // Hover lift + tap squish on interactive chips and links (Doherty: instant feedback)
    el.querySelectorAll<HTMLElement>('[data-lift]').forEach((node) => {
      cleanups.push(
        hover(node, () => {
          animate(node, { y: -4, scale: 1.04 }, spring);
          return () => animate(node, { y: 0, scale: 1 }, spring);
        })
      );
      cleanups.push(
        press(node, () => {
          animate(node, { scale: 0.94 }, spring);
          return () => animate(node, { scale: 1 }, spring);
        })
      );
    });

    // Magnetic CTA: button leans toward the pointer
    const cta = el.querySelector<HTMLElement>('[data-magnetic]');
    if (cta) {
      const move = (e: PointerEvent) => {
        const r = cta.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        animate(cta, { x: dx, y: dy }, { type: 'spring', stiffness: 250, damping: 18 });
      };
      const leave = () => animate(cta, { x: 0, y: 0 }, spring);
      cta.addEventListener('pointermove', move);
      cta.addEventListener('pointerleave', leave);
      cleanups.push(() => {
        cta.removeEventListener('pointermove', move);
        cta.removeEventListener('pointerleave', leave);
      });
      const arrow = cta.querySelector<HTMLElement>('[data-arrow]');
      if (arrow) {
        cleanups.push(
          hover(cta, () => {
            animate(arrow, { x: 6 }, spring);
            return () => animate(arrow, { x: 0 }, spring);
          })
        );
      }
    }

    // Floating globe: gentle idle bob
    const globe = el.querySelector<HTMLElement>('[data-globe]');
    if (globe) {
      const bob = animate(globe, { y: [0, -8, 0], rotate: [0, 8, 0] }, { duration: 4, repeat: Infinity, ease: 'easeInOut' });
      cleanups.push(() => bob.stop());
    }

    return () => cleanups.forEach((c) => c());
  }, [destinations.length]);

  const toTop = () => {
    const reduce = prefersReducedMotion();
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div ref={root} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-28 sm:py-14 space-y-10 sm:space-y-12">
      {/* Call-to-action card (Von Restorff: the one standout element) */}
      {canEdit && (
      <div
        data-reveal
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent text-white p-6 sm:p-10 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative flex items-center gap-4 min-w-0">
          <span data-globe className="text-4xl sm:text-5xl shrink-0" aria-hidden="true">🌏</span>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight">Planning the next trip?</h2>
            <p className="text-sm sm:text-base text-white/85 mt-1">
              Add a country and city, drop in your activities, and it lands in your sheet.
            </p>
          </div>
        </div>
        <a
          href="/add"
          data-magnetic
          className="touch-target relative inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-primary text-sm sm:text-base font-extrabold shadow-lg w-full md:w-auto shrink-0"
        >
          <span aria-hidden="true">＋</span>
          <span>Add new itinerary</span>
          <span data-arrow aria-hidden="true" className="inline-block">→</span>
        </a>
      </div>
      )}

      <div>
        {/* Destinations */}
        <section data-reveal>
          <h3 className="text-xs font-bold text-text uppercase tracking-wider mb-3">Destinations</h3>
          {destinations.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {destinations.map((d) => (
                <a
                  key={d.slug}
                  href={d.href}
                  data-lift
                  className="touch-target inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/45 border border-primary/20 text-sm font-semibold text-text/85 hover:text-primary hover:border-primary/40 shadow-sm"
                >
                  <span>{d.flag}</span>
                  <span>{d.name}</span>
                  {d.days > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{d.days}d</span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text/60">No destinations yet — add your first itinerary.</p>
          )}
        </section>
      </div>

      {/* Credits + "Built with" in one quiet bar (Law of Proximity: all the fine print together) */}
      <div data-reveal className="pt-6 border-t border-primary/15 flex flex-col sm:flex-row sm:items-end justify-between gap-5 text-center sm:text-left">
        <div className="space-y-2.5">
          <p className="text-sm text-text/80">
            Created by <span className="font-bold text-text">Muhammad Mustaqeem</span>
            <span className="text-text/40"> · </span>
            <span className="text-text/60">© {year}</span>
          </p>
          <p className="flex flex-wrap items-center justify-center sm:justify-start gap-x-1.5 gap-y-1 text-xs text-text/60">
            <span>Built with</span>
            {TECHS.map((t, i) => (
              <span key={t.name} className="inline-flex items-center gap-1.5">
                <a href={t.url} target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-text/75 hover:text-primary underline-offset-2 hover:underline py-1">
                  {t.name}
                </a>
                {i < TECHS.length - 1 && <span aria-hidden="true" className="text-text/30">·</span>}
              </span>
            ))}
          </p>
        </div>

        {/* Icon-only; the right margin keeps it clear of the floating season button (Fitts's Law: nothing overlaps the target) */}
        <button
          type="button"
          onClick={toTop}
          data-lift
          className="touch-target self-center sm:self-auto inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/45 text-primary border border-primary/25 sm:mr-20"
          aria-label="Back to top"
          title="Back to top"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.25" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
