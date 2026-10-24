import { h, type ComponentChildren } from 'preact';

/** Label + control + inline error, the one field layout used by every form. */
export default function FormField({
  label,
  htmlFor,
  required,
  hideOptional,
  error,
  className = '',
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  /** Skip the "(optional)" hint, e.g. in forms where every field is required */
  hideOptional?: boolean;
  error?: string;
  className?: string;
  children: ComponentChildren;
}) {
  return (
    <div className={`flex flex-col gap-1 min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-bold text-text/80">
        {label}
        {required ? <span className="text-red-600"> *</span> : !hideOptional && <span className="text-text/40 font-medium"> (optional)</span>}
      </label>
      {children}
      {error && <span className="text-[11px] font-semibold text-red-600">{error}</span>}
    </div>
  );
}
