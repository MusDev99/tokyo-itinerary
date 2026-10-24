import { h } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import { prefersReducedMotion } from '../utils/motion';

interface Props {
  open: boolean;
  title: string;
  message: any;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Permission modal shown before any destructive action. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = true,
  busy,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const card = useRef<HTMLDivElement>(null);
  const cancelBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelBtn.current?.focus(); // safe default focus
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (card.current && !prefersReducedMotion()) {
      animate(card.current, { opacity: [0, 1], scale: [0.92, 1], y: [12, 0] }, { type: 'spring', stiffness: 380, damping: 26 });
    }
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [open, busy]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={card}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl bg-surface-solid shadow-2xl border border-primary/20 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${danger ? 'bg-red-500/15' : 'bg-primary/15'}`} aria-hidden="true">
            {danger ? '⚠️' : '❔'}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base sm:text-lg font-extrabold text-text">{title}</h2>
            <div className="text-sm text-text/75 mt-1 leading-relaxed break-words">{message}</div>
          </div>
        </div>
        {error && (
          <div role="alert" className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-800">{error}</div>
        )}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelBtn} type="button" onClick={onCancel} disabled={busy}
            className="touch-target px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-bold">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className={`touch-target px-4 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
