import { h, type ComponentChildren, type Ref } from 'preact';

type Variant = 'primary' | 'soft' | 'danger' | 'ghost';
type Size = 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'btn-primary bg-primary text-white shadow-md hover:brightness-110 font-extrabold',
  soft: 'bg-primary/10 text-primary hover:bg-primary/15 font-bold',
  danger: 'bg-danger-solid text-white hover:brightness-110 font-extrabold',
  ghost: 'text-text/80 hover:bg-primary/10 font-bold',
};
// Fitts's Law: 44px is the floor, 56px for the main action of a screen
const SIZE: Record<Size, string> = { md: 'min-h-11 px-4 text-sm', lg: 'min-h-14 px-6 text-base' };

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} motion-safe:animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
  );
}

interface Props {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, blocks a second press and tells assistive tech (Doherty: feedback right away) */
  busy?: boolean;
  /** Label while busy, e.g. "Saving…" */
  busyLabel?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
  onClick?: (e: MouseEvent) => void;
  buttonRef?: Ref<HTMLButtonElement>;
  onPointerEnter?: (e: PointerEvent) => void;
  onFocus?: (e: FocusEvent) => void;
  'aria-label'?: string;
  children: ComponentChildren;
}

/** The one button: variants, 44px+ target, focus ring, busy state. Replaces the per-component pill classes. */
export default function Button({ variant = 'primary', size = 'md', busy, busyLabel, type = 'button', disabled, className = '', children, buttonRef, ...rest }: Props) {
  return (
    <button
      ref={buttonRef}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`touch-target focus-ring inline-flex items-center justify-center gap-2 rounded-xl transition-[color,background-color,filter,opacity,transform] disabled:opacity-50 disabled:cursor-not-allowed ${SIZE[size]} ${VARIANT[variant]} ${className}`}
      {...rest}
    >
      {busy && <Spinner />}
      <span>{busy && busyLabel ? busyLabel : children}</span>
    </button>
  );
}
