import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from '../../utils/toast';

const TONE: Record<ToastItem['tone'], { icon: string; cls: string }> = {
  success: { icon: '✓', cls: 'border-success/40 text-success-strong' },
  error: { icon: '⚠', cls: 'border-danger/40 text-danger-strong' },
  info: { icon: 'ℹ', cls: 'border-primary/30 text-text' },
};

/** Mounted once in Layout (persisted across soft navigation). Sits above the tab dock and above sheets (z-95). */
export default function Toaster() {
  const [items, setItems] = useState<readonly ToastItem[]>(getToasts());
  useEffect(() => subscribeToasts(() => setItems([...getToasts()])), []);

  // One timer per toast; hovering is not a thing on phones, so a fixed lifetime
  useEffect(() => {
    const timers = items.map((t) => setTimeout(() => dismissToast(t.id), t.ms));
    return () => timers.forEach(clearTimeout);
  }, [items]);

  if (!items.length) return null;
  return (
    <div className="above-tabbar fixed inset-x-0 bottom-4 z-[95] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {items.map((t) => (
        <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
          className={`pointer-events-auto w-full max-w-sm flex items-center gap-3 rounded-2xl border bg-surface-solid px-4 py-3 shadow-xl ${TONE[t.tone].cls}`}>
          <span aria-hidden="true" className="font-extrabold">{TONE[t.tone].icon}</span>
          <span className="min-w-0 flex-1 text-sm font-bold">{t.text}</span>
          {t.action && (
            <button type="button" className="touch-target focus-ring shrink-0 px-3 rounded-lg text-sm font-extrabold text-primary"
              onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
