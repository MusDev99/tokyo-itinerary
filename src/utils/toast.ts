/**
 * Tiny toast store (no library): any component calls `toast.success('Saved')`; the single <Toaster> renders them.
 * Pure (no DOM, no timers) so it is unit-tested; the Toaster owns the dismiss timers.
 */
export type ToastTone = 'success' | 'error' | 'info';
export interface ToastAction { label: string; run: () => void }
export interface ToastItem { id: number; text: string; tone: ToastTone; action?: ToastAction; ms: number }
export interface ToastOptions { tone?: ToastTone; action?: ToastAction; ms?: number }

const MAX_VISIBLE = 3;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(text: string, o: ToastOptions = {}): number {
  const id = nextId++;
  // An undo toast stays longer: the person needs time to notice and tap it
  const ms = o.ms ?? (o.action ? 6000 : o.tone === 'error' ? 5000 : 2500);
  items = [...items, { id, text, tone: o.tone ?? 'info', action: o.action, ms }].slice(-MAX_VISIBLE);
  emit();
  return id;
}

export const toast = {
  success: (text: string, o: Omit<ToastOptions, 'tone'> = {}) => showToast(text, { ...o, tone: 'success' }),
  error: (text: string, o: Omit<ToastOptions, 'tone'> = {}) => showToast(text, { ...o, tone: 'error' }),
  info: (text: string, o: Omit<ToastOptions, 'tone'> = {}) => showToast(text, { ...o, tone: 'info' }),
};

export function dismissToast(id: number): void {
  const before = items.length;
  items = items.filter((t) => t.id !== id);
  if (items.length !== before) emit();
}

export const getToasts = (): readonly ToastItem[] => items;

export function subscribeToasts(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test helper */
export function resetToasts(): void { items = []; nextId = 1; listeners.clear(); }
