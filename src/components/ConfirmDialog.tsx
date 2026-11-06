import { h } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { animate } from 'motion';
import { prefersReducedMotion } from '../utils/motion';
import { lockOverlay } from '../utils/overlay';
import InlineError from './ui/InlineError';
import Button from './ui/Button';

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
    const unlock = lockOverlay();
    if (card.current && !prefersReducedMotion()) {
      animate(card.current, { opacity: [0, 1], scale: [0.92, 1], y: [12, 0] }, { type: 'spring', stiffness: 380, damping: 26 });
    }
    return () => {
      document.removeEventListener('keydown', key);
      unlock();
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
          <span className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${danger ? 'bg-danger/15' : 'bg-primary/15'}`} aria-hidden="true">
            {danger ? '⚠️' : '❔'}
          </span>
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-base sm:text-lg font-extrabold text-text">{title}</h2>
            <div className="text-sm text-text/75 mt-1 leading-relaxed break-words">{message}</div>
          </div>
        </div>
        <InlineError className="mt-3" message={error} />
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button buttonRef={cancelBtn} variant="soft" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} busy={busy} busyLabel="Working…">{confirmLabel}</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
