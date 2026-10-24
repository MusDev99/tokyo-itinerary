import { h, type ComponentChildren, type RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { animate } from 'motion';
import { inputClass } from './inputClass';
import { useDismiss } from './useDismiss';
import { prefersReducedMotion } from '../utils/motion';
import { anchorPosition } from '../utils/popover';

/** Footer buttons shared by the pickers (Fitts's Law: 44px touch targets). */
export const pickerButton = {
  primary: 'touch-target px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary',
  secondary: 'touch-target px-4 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10 disabled:opacity-30',
};

/**
 * Open/close state for a field-style picker: positions the popover by its trigger, springs it in,
 * and closes on outside press or Escape (Escape and `close()` return focus to the trigger).
 */
export function usePickerPopover(opts: { width: number; height: number; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: opts.width });
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const show = () => {
    opts.onOpen?.();
    const width = Math.min(opts.width, window.innerWidth - 16);
    const at = anchorPosition(trigger.current!.getBoundingClientRect(), { width, height: opts.height },
      { width: window.innerWidth, height: window.innerHeight });
    setPos({ ...at, width });
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };

  useDismiss(open, [pop, trigger], (reason) => close(reason === 'escape'));

  useEffect(() => {
    if (!open || !pop.current || prefersReducedMotion()) return;
    animate(pop.current, { opacity: [0, 1], scale: [0.94, 1], y: [-6, 0] }, { type: 'spring', stiffness: 380, damping: 26 });
  }, [open]);

  return { open, pos, trigger, pop, show, close };
}

type Picker = ReturnType<typeof usePickerPopover>;

/** Input-looking button that opens the picker; shows `placeholder` until there is a value. */
export function PickerTrigger({ picker, id, display, placeholder, invalid, icon }: {
  picker: Picker;
  id: string;
  display: string;
  placeholder: string;
  invalid?: boolean;
  icon: ComponentChildren;
}) {
  return (
    <button
      ref={picker.trigger}
      id={id}
      type="button"
      onClick={picker.show}
      aria-haspopup="dialog"
      aria-expanded={picker.open}
      aria-invalid={invalid}
      className={`${inputClass} flex items-center justify-between gap-2 text-left`}
    >
      <span className={display ? 'text-text' : 'text-text/40'}>{display || placeholder}</span>
      <svg className="w-4 h-4 text-text/70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        {icon}
      </svg>
    </button>
  );
}

/** The floating card, portalled to <body> so it is never clipped by a scrolling form. */
export function PickerPopover({ picker, className = '', children, ...aria }: {
  picker: Picker;
  className?: string;
  children: ComponentChildren;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  if (!picker.open) return null;
  const { top, left, width } = picker.pos;
  return createPortal(
    <div
      ref={picker.pop as RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="false"
      {...aria}
      style={{ position: 'fixed', top: `${top}px`, left: `${left}px`, width: `${width}px`, zIndex: 100 }}
      className={`rounded-2xl bg-surface-solid shadow-2xl border border-primary/25 ${className}`}
    >
      {children}
    </div>,
    document.body
  );
}
