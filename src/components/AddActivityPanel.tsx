import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import AddItineraryForm from './AddItineraryForm';

interface Props {
  country: string;
  countrySlug: string;
  state: string;
  currency: string;
}

/**
 * "Add new activity" without leaving the page: the button opens the add form inline, fixed to this trip.
 * Progressive disclosure (Hick's Law) + stays in context (Law of Common Region).
 */
export default function AddActivityPanel({ country, countrySlug, state, currency }: Props) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !panel.current) return;
    panel.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animate(panel.current, { opacity: [0, 1], y: [-10, 0] }, { duration: 0.3, ease: [0.22, 1, 0.36, 1] });
    }
  }, [open]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="add-activity-panel"
        className="touch-target inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl bg-primary text-white text-sm font-extrabold shadow-sm hover:opacity-95 active:scale-[0.98] transition-all w-full sm:w-auto"
      >
        <svg className={`w-5 h-5 transition-transform duration-200 ${open ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
        </svg>
        {open ? 'Close' : 'Add new activity'}
      </button>

      {open && (
        <div ref={panel} id="add-activity-panel" className="glass-effect rounded-2xl p-3 sm:p-5">
          <AddItineraryForm
            embedded
            initialCountry={country}
            initialState={state}
            countries={[{ name: country, slug: countrySlug, flag: '', currency }]}
            onSaved={() => setTimeout(() => window.location.reload(), 900)}
          />
        </div>
      )}
    </div>
  );
}
